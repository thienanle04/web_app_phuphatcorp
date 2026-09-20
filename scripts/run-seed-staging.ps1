# PowerShell script to safely run seed data (Customers, F-Sheets, Cascade) to Remote Staging.
# Usage:
#   .\scripts\run-seed-staging.ps1 -DryRun   # Preview data without writing to database
#   .\scripts\run-seed-staging.ps1           # Backup staging DB + Apply all seed data + Cascade prices

param(
  [switch]$DryRun,
  [switch]$SkipBackup,
  [string]$StagingEnv = "backend\.env.remote.staging",
  [string]$LocalEnv = "backend\.env",
  [string]$BackupDir = "scripts\backups"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Read-DotEnv {
  param([string]$Path)
  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $key = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

function Find-PgTool {
  param([string]$Name)
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "C:\Program Files\PostgreSQL\18\bin\$Name.exe",
    "C:\Program Files\PostgreSQL\17\bin\$Name.exe",
    "C:\Program Files\PostgreSQL\16\bin\$Name.exe",
    "C:\Program Files\PostgreSQL\15\bin\$Name.exe"
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { return $c }
  }
  throw "Không tìm thấy $Name. Vui lòng cài đặt PostgreSQL client tools hoặc thêm vào PATH."
}

# 1. Kiểm tra tồn tại file env
if (-not (Test-Path $StagingEnv)) {
  throw "Không tìm thấy file cấu hình Staging: $StagingEnv"
}
if (-not (Test-Path $LocalEnv)) {
  throw "Không tìm thấy file cấu hình Local: $LocalEnv"
}

$stagingMap = Read-DotEnv $StagingEnv

# 2. Backup Staging DB nếu không phải DryRun và không bật SkipBackup
if (-not $DryRun -and -not $SkipBackup) {
  Write-Host "==========================================================" -ForegroundColor Cyan
  Write-Host " [1/3] SAO LƯU DATABASE STAGING (pg_dump)" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Cyan

  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $backupFile = Join-Path $BackupDir "staging_backup_$timestamp.dump"

  $pgDump = Find-PgTool "pg_dump"
  $remoteHost = $stagingMap["DB_HOST"]
  $remotePort = $stagingMap["DB_PORT"]
  $remoteDb   = $stagingMap["DB_NAME"]
  $remoteUser = $stagingMap["DB_USER"]
  $remotePass = $stagingMap["DB_PASSWORD"]

  Write-Host "Đang sao lưu $remoteUser@$remoteHost`:$remotePort/$remoteDb -> $backupFile ..."
  $env:PGPASSWORD = $remotePass
  & $pgDump -h $remoteHost -p $remotePort -U $remoteUser -d $remoteDb `
    -Fc --no-owner --no-acl -f $backupFile
  if ($LASTEXITCODE -ne 0) {
    throw "Sao lưu pg_dump thất bại với mã lỗi $LASTEXITCODE. Đã hủy tiến trình seed."
  }
  Write-Host "==> Sao lưu thành công: $backupFile" -ForegroundColor Green
  Write-Host ""
}

# 3. Quản lý tráo đổi .env với try/finally
$envBak = "$LocalEnv.seed_temp.bak"
Copy-Item $LocalEnv $envBak -Force
Write-Host "==> Đã lưu tạm cấu hình local sang: $envBak" -ForegroundColor DarkGray

try {
  Write-Host "==> Tạm thời chuyển $LocalEnv sang cấu hình Staging..." -ForegroundColor Yellow
  Copy-Item $StagingEnv $LocalEnv -Force

  $modeLabel = if ($DryRun) { "DRY-RUN (CHỈ XEM - KHÔNG GHI DB)" } else { "APPLY (GHI THẬT VÀO STAGING DB)" }
  Write-Host "==========================================================" -ForegroundColor Cyan
  Write-Host " [2/3] BẮT ĐẦU CHẠY SEED DATA - CHẾ ĐỘ: $modeLabel" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Cyan

  # A. Customers T7
  Write-Host "`n>>> [1/9] Chạy seed-customers-t7.ts..." -ForegroundColor Magenta
  if ($DryRun) {
    & npx tsx scripts/seed-customers-t7.ts --dry-run
  } else {
    & npx tsx scripts/seed-customers-t7.ts
  }
  if ($LASTEXITCODE -ne 0) { throw "seed-customers-t7.ts gặp lỗi!" }

  # B. F-sheets
  $fSheets = @(
    "scripts/seed-clf-f.ts",
    "scripts/seed-clv-f.ts",
    "scripts/seed-mcc-gh-f.ts",
    "scripts/seed-mcc-tt-f.ts",
    "scripts/seed-ndfc-naic-f.ts",
    "scripts/seed-ndfc-tt-f.ts",
    "scripts/seed-vp-hiepphuoc-f.ts",
    "scripts/seed-vp-uni-f.ts"
  )

  $step = 2
  foreach ($sheet in $fSheets) {
    Write-Host "`n>>> [$step/9] Chạy $sheet..." -ForegroundColor Magenta
    if ($DryRun) {
      & npx tsx $sheet --dry-run
    } else {
      & npx tsx $sheet
    }
    if ($LASTEXITCODE -ne 0) { throw "$sheet gặp lỗi!" }
    $step++
  }

  # C. Cascade route pricing versions (chỉ chạy khi Apply)
  if (-not $DryRun) {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " [3/3] CASCADE PHIÊN BẢN BẢNG GIÁ" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
    & npx tsx scripts/cascade-route-pricing-versions.ts
    if ($LASTEXITCODE -ne 0) { throw "cascade-route-pricing-versions.ts gặp lỗi!" }
  } else {
    Write-Host "`n>>> [Bỏ qua cascade trong chế độ Dry-run]" -ForegroundColor DarkGray
  }

  Write-Host ""
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host " HOÀN TẤT THÀNH CÔNG!" -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Green
}
finally {
  # Luôn khôi phục lại backend/.env ban đầu dù thành công hay gặp lỗi
  if (Test-Path $envBak) {
    Copy-Item $envBak $LocalEnv -Force
    Remove-Item $envBak -Force
    Write-Host "==> ĐÃ KHÔI PHỤC LẠI FILE $LocalEnv BAN ĐẦU CỦA MÁY BẠN." -ForegroundColor Green
  }
}
