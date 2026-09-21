# PowerShell script to safely run seed data (Provinces, Adjustment Periods, Customers, F-Sheets, Cascade) to Production.
# Usage:
#   .\scripts\run-seed-prod.ps1 -DryRun   # Preview data without writing to database
#   .\scripts\run-seed-prod.ps1           # Double confirmation + Backup DB + Apply seed data + Cascade prices
#   .\scripts\run-seed-prod.ps1 -Force    # Bypass confirmation prompt (for automated scripts)

param(
  [switch]$DryRun,
  [switch]$SkipBackup,
  [switch]$Force,
  [string]$ProdEnv = "backend\.env.remote.prod",
  [string]$LocalEnv = "backend\.env",
  [string]$BackupDir = "scripts\backups\prod"
)

$defaultProdEnv = "backend\.env.remote.prod"
$defaultLocalEnv = "backend\.env"

# 1. Phát hiện nếu cờ switch (--dry-run, --skip-backup, --force) bị PowerShell gán nhầm vào $ProdEnv do cơ chế positional parameter:
if ($ProdEnv -match "^--?dry[-_]?run$" -or $ProdEnv -eq "dryrun" -or $ProdEnv -eq "dry-run") {
  $DryRun = [switch]::new($true)
  $ProdEnv = $defaultProdEnv
} elseif ($ProdEnv -match "^--?skip[-_]?backup$" -or $ProdEnv -eq "skipbackup" -or $ProdEnv -eq "skip-backup") {
  $SkipBackup = [switch]::new($true)
  $ProdEnv = $defaultProdEnv
} elseif ($ProdEnv -match "^--?force$") {
  $Force = [switch]::new($true)
  $ProdEnv = $defaultProdEnv
}

# 2. Nhận diện triệt để cờ DryRun, SkipBackup, Force từ switch, $args hoặc biến môi trường
$hasDryArg = $false
$hasSkipBackupArg = $false
$hasForceArg = $false

foreach ($a in $args) {
  if ($a -match "^--?dry[-_]?run$" -or $a -eq "dryrun" -or $a -eq "dry-run") {
    $hasDryArg = $true
  }
  if ($a -match "^--?skip[-_]?backup$" -or $a -eq "skipbackup" -or $a -eq "skip-backup") {
    $hasSkipBackupArg = $true
  }
  if ($a -match "^--?force$") {
    $hasForceArg = $true
  }
}

if ($DryRun -or $hasDryArg -or $env:DRY_RUN -eq "true" -or $env:DRY_RUN -eq "1" -or $env:npm_config_dry_run -eq "true") {
  $DryRun = [switch]::new($true)
}
if ($SkipBackup -or $hasSkipBackupArg -or $env:SKIP_BACKUP -eq "true" -or $env:SKIP_BACKUP -eq "1") {
  $SkipBackup = [switch]::new($true)
}
if ($Force -or $hasForceArg -or $env:FORCE -eq "true" -or $env:FORCE -eq "1") {
  $Force = [switch]::new($true)
}

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# 3. Chuẩn hóa đường dẫn tương đối theo RepoRoot và hỗ trợ nếu người dùng truyền thiếu tiền tố backend/
if (-not (Test-Path $ProdEnv)) {
  $cands = @(
    (Join-Path $RepoRoot $ProdEnv),
    (Join-Path $RepoRoot "backend\$ProdEnv"),
    (Join-Path $RepoRoot "backend\.$ProdEnv")
  )
  foreach ($c in $cands) {
    if (Test-Path $c) { $ProdEnv = $c; break }
  }
}

if (-not (Test-Path $LocalEnv)) {
  $cands = @(
    (Join-Path $RepoRoot $LocalEnv),
    (Join-Path $RepoRoot "backend\$LocalEnv"),
    (Join-Path $RepoRoot "backend\.$LocalEnv")
  )
  foreach ($c in $cands) {
    if (Test-Path $c) { $LocalEnv = $c; break }
  }
}

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

# 1. Kiểm tra tồn tại và tính hợp lệ của file cấu hình
if (-not (Test-Path $ProdEnv)) {
  throw "Không tìm thấy file cấu hình Production: $ProdEnv"
}

$prodEnvItem = Get-Item $ProdEnv
if ($prodEnvItem.Length -eq 0) {
  throw "File cấu hình Production ($ProdEnv) đang rỗng (0 bytes)! Vui lòng điền cấu hình (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) trước khi chạy."
}

if (-not (Test-Path $LocalEnv)) {
  throw "Không tìm thấy file cấu hình Local: $LocalEnv"
}

$prodMap = Read-DotEnv $ProdEnv
$requiredKeys = @("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD")
$missingKeys = @()
foreach ($k in $requiredKeys) {
  if (-not $prodMap[$k] -or $prodMap[$k].Trim() -eq "") {
    $missingKeys += $k
  }
}
if ($missingKeys.Count -gt 0) {
  throw "File $ProdEnv thiếu thông tin kết nối quan trọng: $($missingKeys -join ', '). Vui lòng bổ sung trước khi chạy."
}

$targetHost = $prodMap["DB_HOST"]
$targetPort = if ($prodMap["DB_PORT"]) { $prodMap["DB_PORT"] } else { "5432" }
$targetDb   = $prodMap["DB_NAME"]
$targetUser = $prodMap["DB_USER"]
$targetPass = $prodMap["DB_PASSWORD"]

# 2. Cơ chế an toàn xác nhận kép khi chạy APPLY (ghi thật vào DB Prod)
if (-not $DryRun -and -not $Force) {
  Write-Host ""
  Write-Host "==========================================================" -ForegroundColor Red
  Write-Host " ⚠️  CẢNH BÁO: BẠN ĐANG CHUẨN BỊ GHI DỮ LIỆU VÀO PRODUCTION!" -ForegroundColor Red
  Write-Host "==========================================================" -ForegroundColor Red
  Write-Host "  Target Host:     $targetHost" -ForegroundColor Yellow
  Write-Host "  Target Port:     $targetPort" -ForegroundColor Yellow
  Write-Host "  Target Database: $targetDb" -ForegroundColor Yellow
  Write-Host "  Target User:     $targetUser" -ForegroundColor Yellow
  Write-Host "==========================================================" -ForegroundColor Red
  Write-Host "Thao tác này sẽ cập nhật trực tiếp dữ liệu trên hệ thống Production."
  Write-Host "Để tiếp tục, vui lòng gõ chính xác: CONFIRM_PROD" -ForegroundColor Yellow
  Write-Host "(Hoặc nhấn Ctrl+C để hủy bỏ ngay lập tức)"
  Write-Host ""

  $confirmation = Read-Host "Xác nhận thực hiện (CONFIRM_PROD)"
  if ($confirmation -ne "CONFIRM_PROD") {
    Write-Host "==> HỦY TIẾN TRÌNH: Chuỗi xác nhận không khớp ($confirmation != CONFIRM_PROD). Không có thay đổi nào được thực hiện." -ForegroundColor Yellow
    exit 0
  }
}

# 3. Sao lưu Database Production nếu không phải DryRun và không SkipBackup
$lastBackupFile = $null
if (-not $DryRun -and -not $SkipBackup) {
  Write-Host "==========================================================" -ForegroundColor Cyan
  Write-Host " [0/12] SAO LƯU DATABASE PRODUCTION (pg_dump)" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Cyan

  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $lastBackupFile = Join-Path $BackupDir "prod_backup_$timestamp.dump"

  $pgDump = Find-PgTool "pg_dump"

  Write-Host "Đang sao lưu $targetUser@$targetHost`:$targetPort/$targetDb -> $lastBackupFile ..."
  $env:PGPASSWORD = $targetPass
  & $pgDump -h $targetHost -p $targetPort -U $targetUser -d $targetDb `
    -Fc --no-owner --no-acl -f $lastBackupFile
  if ($LASTEXITCODE -ne 0) {
    throw "Sao lưu pg_dump thất bại với mã lỗi $LASTEXITCODE. Đã hủy tiến trình seed."
  }
  Write-Host "==> Sao lưu thành công: $lastBackupFile" -ForegroundColor Green
  Write-Host ""
} elseif (-not $DryRun -and $SkipBackup) {
  Write-Host "⚠️  CẢNH BÁO: ĐÃ BẬT -SkipBackup. KHÔNG SAO LƯU DATABASE PRODUCTION TRƯỚC KHI GHI!" -ForegroundColor Yellow
  Write-Host ""
}

# 4. Quản lý tráo đổi .env với try/catch/finally
$envBak = "$LocalEnv.seed_temp.bak"
Copy-Item $LocalEnv $envBak -Force
Write-Host "==> Đã lưu tạm cấu hình local sang: $envBak" -ForegroundColor DarkGray

try {
  Write-Host "==> Tạm thời chuyển $LocalEnv sang cấu hình Production..." -ForegroundColor Yellow
  Copy-Item $ProdEnv $LocalEnv -Force

  $modeLabel = if ($DryRun) { "DRY-RUN (CHỈ XEM - KHÔNG GHI DB)" } else { "APPLY (GHI THẬT VÀO PRODUCTION DB)" }
  Write-Host "==========================================================" -ForegroundColor Cyan
  Write-Host " BẮT ĐẦU CHẠY SEED DATA - CHẾ ĐỘ: $modeLabel" -ForegroundColor Cyan
  Write-Host "==========================================================" -ForegroundColor Cyan

  # 1/12: Import VN Provinces
  Write-Host "`n>>> [1/12] Chạy backend/src/scripts/import-vn-provinces.ts..." -ForegroundColor Magenta
  if ($DryRun) {
    & npx tsx backend/src/scripts/import-vn-provinces.ts --dry-run
  } else {
    & npx tsx backend/src/scripts/import-vn-provinces.ts
  }
  if ($LASTEXITCODE -ne 0) { throw "import-vn-provinces.ts gặp lỗi!" }

  # 2/12: Seed Adjustment Periods
  Write-Host "`n>>> [2/12] Chạy scripts/seed-adjustment-periods.ts..." -ForegroundColor Magenta
  if ($DryRun) {
    & npx tsx scripts/seed-adjustment-periods.ts --dry-run
  } else {
    & npx tsx scripts/seed-adjustment-periods.ts
  }
  if ($LASTEXITCODE -ne 0) { throw "seed-adjustment-periods.ts gặp lỗi!" }

  # 3/12: Customers T7
  Write-Host "`n>>> [3/12] Chạy scripts/seed-customers-t7.ts..." -ForegroundColor Magenta
  if ($DryRun) {
    & npx tsx scripts/seed-customers-t7.ts --dry-run
  } else {
    & npx tsx scripts/seed-customers-t7.ts
  }
  if ($LASTEXITCODE -ne 0) { throw "seed-customers-t7.ts gặp lỗi!" }

  # 4-11/12: F-sheets
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

  $step = 4
  foreach ($sheet in $fSheets) {
    Write-Host "`n>>> [$step/12] Chạy $sheet..." -ForegroundColor Magenta
    if ($DryRun) {
      & npx tsx $sheet --dry-run
    } else {
      & npx tsx $sheet
    }
    if ($LASTEXITCODE -ne 0) { throw "$sheet gặp lỗi!" }
    $step++
  }

  # 12/12: Cascade route pricing versions (chỉ chạy khi Apply)
  if (-not $DryRun) {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " [12/12] CASCADE PHIÊN BẢN BẢNG GIÁ" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
    & npx tsx scripts/cascade-route-pricing-versions.ts
    if ($LASTEXITCODE -ne 0) { throw "cascade-route-pricing-versions.ts gặp lỗi!" }
  } else {
    Write-Host "`n>>> [12/12] [Bỏ qua cascade trong chế độ Dry-run]" -ForegroundColor DarkGray
  }

  Write-Host ""
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host " HOÀN TẤT SEED PRODUCTION THÀNH CÔNG!" -ForegroundColor Green
  Write-Host "==========================================================" -ForegroundColor Green
}
catch {
  Write-Host ""
  Write-Host "==========================================================" -ForegroundColor Red
  Write-Host " ❌ ĐÃ XẢY RA LỖI TRONG TIẾN TRÌNH SEED PRODUCTION!" -ForegroundColor Red
  Write-Host "==========================================================" -ForegroundColor Red
  Write-Host "Chi tiết lỗi: $_" -ForegroundColor Red

  if ($lastBackupFile -and (Test-Path $lastBackupFile)) {
    Write-Host ""
    Write-Host "HƯỚNG DẪN KHÔI PHỤC DATABASE KHẨN CẤP TỪ BẢN SAO LƯU:" -ForegroundColor Yellow
    Write-Host "  pg_restore -h $targetHost -p $targetPort -U $targetUser -d $targetDb --clean --if-exists `"$lastBackupFile`"" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Red
  }

  throw $_
}
finally {
  # Luôn khôi phục lại backend/.env ban đầu dù thành công hay gặp lỗi
  if (Test-Path $envBak) {
    Copy-Item $envBak $LocalEnv -Force
    Remove-Item $envBak -Force
    Write-Host "==> ĐÃ KHÔI PHỤC LẠI FILE $LocalEnv BAN ĐẦU CỦA MÁY BẠN." -ForegroundColor Green
  }
}
