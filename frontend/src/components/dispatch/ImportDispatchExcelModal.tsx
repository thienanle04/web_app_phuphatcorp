import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  X,
  AlertTriangle,
  CheckCircle2,
  Car,
  Truck,
  MapPin,
  Calendar,
  AlertCircle,
  UserX,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/useI18n';
import { cn } from '../../utils/cn';
import { useGetVehicles } from '../../hooks/useVehicleCatalog';
import { useGetDrivers } from '../../hooks/useDrivers';
import type { CreateDispatchScheduleBatchItem } from '../../api/dispatchApi';

type LoaiTuyen = 'Tuyến cố định' | 'Tuyến ngoài';
type LoaiXe = 'Xe lớn' | 'Xe nhỏ';

interface ImportDispatchExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  loaiTuyen: LoaiTuyen;
  loaiXe?: LoaiXe;
  onSubmit: (items: CreateDispatchScheduleBatchItem[]) => Promise<void>;
  isSubmitting: boolean;
}

interface ParsedDispatchRow {
  rowNumber: number;
  rawPlate: string;
  cleanPlate: string;
  diemNhan: string;
  tan: string;
  can: string;
  ghiChu: string;
  isValid: boolean;
  isMissingDriver: boolean;
  errorMessage?: string;
  vehicleId: number | null;
  driverId: number | null;
  driverName: string;
  isCompanyVehicle: boolean;
}

function formatPlateNumber(raw: string): string {
  if (!raw) return '';
  const cleaned = String(raw)
    .replace(/\u00a0/g, '')
    .replace(/^[^\d]*/, '')
    .replace(/[-,\s./\\_]/g, '')
    .replace(/\/.*$/, '')
    .toUpperCase()
    .trim();

  const match = cleaned.match(/(\d{2}[A-Z]\d{4,})/);
  if (match) {
    return match[1];
  }

  return cleaned;
}

function cleanPlateString(raw: string): string {
  return formatPlateNumber(raw);
}

function normalizePlateForMatch(raw: string): string {
  return formatPlateNumber(raw);
}

function normalizeHeader(val: unknown): string {
  if (val == null) return '';
  return String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .trim();
}

export function ImportDispatchExcelModal({
  isOpen,
  onClose,
  selectedDate,
  loaiTuyen,
  loaiXe: initialLoaiXe = 'Xe nhỏ',
  onSubmit,
  isSubmitting,
}: ImportDispatchExcelModalProps) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [selectedLoaiXe, setSelectedLoaiXe] = useState<LoaiXe>(initialLoaiXe);
  const [parsedRows, setParsedRows] = useState<ParsedDispatchRow[]>([]);
  const [fileError, setFileError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: vehiclesData } = useGetVehicles('', 'active', undefined, 1, 300);
  const vehicles = vehiclesData?.vehicles ?? [];

  const { data: driversData } = useGetDrivers({ status: 'active', limit: 500 });
  const activeDrivers = driversData?.drivers ?? [];

  // Vehicle plate lookup map
  const vehicleMap = useMemo(() => {
    const map = new Map<string, (typeof vehicles)[0]>();
    vehicles.forEach((v) => {
      const key = normalizePlateForMatch(v.plate_number);
      if (key) map.set(key, v);
    });
    return map;
  }, [vehicles]);

  // Driver by vehicle plate lookup map
  const driverByPlateMap = useMemo(() => {
    const map = new Map<string, { driverUserId: number; driverName: string; vehicleId: number }>();
    activeDrivers.forEach((d) => {
      (d.vehicles || []).forEach((v) => {
        const key = normalizePlateForMatch(v.plate_number);
        if (key && !map.has(key)) {
          map.set(key, {
            driverUserId: d.user_id,
            driverName: d.full_name,
            vehicleId: v.id,
          });
        }
      });
    });
    return map;
  }, [activeDrivers]);

  const handleClose = () => {
    setFile(null);
    setParsedRows([]);
    setFileError('');
    setIsDragOver(false);
    onClose();
  };

  const parseExcel = async (f: File) => {
    try {
      setFileError('');
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setFileError('File Excel không có sheet dữ liệu nào.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

      if (!rawData || rawData.length === 0) {
        setFileError('File Excel không có dữ liệu.');
        return;
      }

      // Find header row (looks for "STT" or "NOI GIAO" or "SO XE")
      let headerRowIndex = -1;
      let colNoiGiao = -1;
      let colTan = -1;
      let colSoXe = -1;
      let colCan = -1;
      let colGhiChu = -1;

      for (let r = 0; r < Math.min(rawData.length, 10); r++) {
        const row = rawData[r];
        if (!Array.isArray(row)) continue;

        const normalizedCols = row.map(normalizeHeader);

        const idxSoXe = normalizedCols.findIndex(
          (c) => c.includes('SO XE') || c.includes('BIEN SO') || c === 'XE',
        );
        const idxNoiGiao = normalizedCols.findIndex(
          (c) => c.includes('NOI GIAO') || c.includes('DIEM NHAN') || c.includes('KHACH HANG'),
        );

        if (idxSoXe !== -1 || idxNoiGiao !== -1) {
          headerRowIndex = r;
          colSoXe = idxSoXe;
          colNoiGiao = idxNoiGiao;
          colTan = normalizedCols.findIndex((c) => c.includes('TAN') || c.includes('TRONG LUONG'));
          colCan = normalizedCols.findIndex((c) => c.includes('CAN'));
          colGhiChu = normalizedCols.findIndex((c) => c.includes('GHI CHU') || c.includes('NOTE'));
          break;
        }
      }

      // Fallback to standard columns if header is row 2
      if (headerRowIndex === -1) {
        // Fallback default index: STT=0, NƠI GIAO=1, TẤN=2, SỐ XE=3, CAN=4, GHI CHÚ=5
        headerRowIndex = 1;
        colNoiGiao = 1;
        colTan = 2;
        colSoXe = 3;
        colCan = 4;
        colGhiChu = 5;
      }

      const rows: ParsedDispatchRow[] = [];

      for (let r = headerRowIndex + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!Array.isArray(row)) continue;

        // Skip completely empty row
        const hasContent = row.some((cell) => cell != null && String(cell).trim() !== '');
        if (!hasContent) continue;

        const rawPlate = colSoXe !== -1 && row[colSoXe] != null ? String(row[colSoXe]) : '';
        const cleanPlate = cleanPlateString(rawPlate);
        const normPlate = normalizePlateForMatch(cleanPlate);

        const rawNoiGiao = colNoiGiao !== -1 && row[colNoiGiao] != null ? String(row[colNoiGiao]) : '';
        const rawTan = colTan !== -1 && row[colTan] != null ? String(row[colTan]) : '';
        const rawCan = colCan !== -1 && row[colCan] != null ? String(row[colCan]) : '';
        const rawGhiChu = colGhiChu !== -1 && row[colGhiChu] != null ? String(row[colGhiChu]) : '';

        const isPlateMissing = !cleanPlate;
        const isDiemNhanMissing = !rawNoiGiao.trim();

        // Check against driver mapping and vehicle catalog
        const driverInfo = normPlate ? driverByPlateMap.get(normPlate) : undefined;
        const matchedVehicle = normPlate ? vehicleMap.get(normPlate) : undefined;

        const vehicleId = driverInfo?.vehicleId ?? (matchedVehicle ? matchedVehicle.id : null);
        const driverId = driverInfo?.driverUserId ?? null;
        const driverName = driverInfo?.driverName ?? (matchedVehicle?.driver_name && matchedVehicle.driver_name !== 'Chưa có tên' ? matchedVehicle.driver_name : '');
        const isCompanyVehicle = Boolean(vehicleId);

        let errorMessage: string | undefined;
        let isValid = true;
        let isMissingDriver = false;

        if (isPlateMissing) {
          isValid = false;
          errorMessage = t('dispatch.importModal.errorMissingPlate' as never) || 'Thiếu biển số xe (bắt buộc)';
        } else if (isDiemNhanMissing) {
          isValid = false;
          errorMessage = 'Thiếu nơi giao / điểm nhận hàng';
        } else if (!driverId) {
          isValid = false;
          isMissingDriver = true;
          errorMessage = `Chưa có tài xế (driver_id) được phân công trong hệ thống`;
        }

        rows.push({
          rowNumber: r + 1,
          rawPlate,
          cleanPlate,
          diemNhan: rawNoiGiao.trim(),
          tan: rawTan.trim(),
          can: rawCan.trim(),
          ghiChu: rawGhiChu.trim(),
          isValid,
          isMissingDriver,
          errorMessage,
          vehicleId,
          driverId,
          driverName,
          isCompanyVehicle,
        });
      }

      if (rows.length === 0) {
        setFileError(t('dispatch.importModal.noValidData' as never) || 'Không tìm thấy dòng dữ liệu nào.');
      }

      setParsedRows(rows);
    } catch (err) {
      console.error('Failed to parse excel:', err);
      setFileError('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file.');
    }
  };

  const handleFileChange = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setFileError('Chỉ chấp nhận file .xlsx hoặc .xls');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileError('Kích thước file không được vượt quá 10MB');
      return;
    }
    setFile(f);
    parseExcel(f);
  };

  const validRows = useMemo(() => parsedRows.filter((r) => r.isValid), [parsedRows]);
  const errorRows = useMemo(() => parsedRows.filter((r) => !r.isValid), [parsedRows]);

  // List of unique plate numbers that cannot be inserted due to missing driver
  const uniqueMissingDriverPlates = useMemo(() => {
    const plates = new Set<string>();
    parsedRows.forEach((r) => {
      if (r.isMissingDriver && r.cleanPlate) {
        plates.add(r.cleanPlate);
      }
    });
    return Array.from(plates);
  }, [parsedRows]);

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;

    const items: CreateDispatchScheduleBatchItem[] = validRows.map((r) => ({
      ngay: selectedDate,
      loai_tuyen: loaiTuyen,
      loai_xe: loaiTuyen === 'Tuyến ngoài' ? selectedLoaiXe : initialLoaiXe,
      bien_so: r.cleanPlate,
      tai_xe: r.driverName || null,
      vehicle_id: r.vehicleId,
      driver_id: r.driverId,
      diem_nhan: r.diemNhan,
      tan: r.tan || null,
      can: r.can || null,
      ghi_chu: r.ghiChu || null,
    }));

    await onSubmit(items);
    handleClose();
  };

  const tabTitle =
    loaiTuyen === 'Tuyến ngoài'
      ? t('dispatch.schedule.tableTuyenNgoai' as never) || 'Lịch ngoài tuyến'
      : initialLoaiXe === 'Xe nhỏ'
        ? t('dispatch.schedule.tableXeNho' as never) || 'Lịch xe nhỏ'
        : t('dispatch.schedule.tableXeLon' as never) || 'Lịch xe lớn';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${t('dispatch.importModal.title' as never) || 'Import Excel Lịch Điều Phối'} — ${tabTitle}`}
      size="full"
    >
      <div className="space-y-4">
        {/* Context metadata banner */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
            <Calendar className="w-4 h-4 text-sky-500" />
            <span className="font-medium text-neutral-500">Ngày điều phối:</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{selectedDate}</span>
          </div>

          <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span className="font-medium text-neutral-500">Loại tuyến:</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{loaiTuyen}</span>
          </div>

          <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
            {selectedLoaiXe === 'Xe lớn' ? (
              <Truck className="w-4 h-4 text-amber-500" />
            ) : (
              <Car className="w-4 h-4 text-sky-500" />
            )}
            <span className="font-medium text-neutral-500">Cỡ xe:</span>
            {loaiTuyen === 'Tuyến ngoài' ? (
              <select
                value={selectedLoaiXe}
                onChange={(e) => setSelectedLoaiXe(e.target.value as LoaiXe)}
                className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 font-semibold text-neutral-900 dark:text-neutral-100 text-xs"
              >
                <option value="Xe nhỏ">Xe nhỏ</option>
                <option value="Xe lớn">Xe lớn</option>
              </select>
            ) : (
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{initialLoaiXe}</span>
            )}
          </div>
        </div>

        {/* Upload dropzone area */}
        {!file ? (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center',
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/20',
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-xs">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <p className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                {t('dispatch.importModal.dropzone' as never) || 'Kéo thả file .xlsx hoặc click để chọn'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('dispatch.importModal.accepts' as never) || 'Chỉ chấp nhận file .xlsx hoặc .xls (Tối đa 10MB)'}
              </p>
            </div>

            {fileError && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs sm:text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info bar */}
            <div className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <div className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {file.name}
                </span>
                <span className="text-xs text-neutral-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                  setFileError('');
                }}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                title="Chọn file khác"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Parsing summary badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {validRows.length} chuyến hợp lệ (sẵn sàng insert)
              </span>

              {uniqueMissingDriverPlates.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                  <UserX className="w-3.5 h-3.5" />
                  {uniqueMissingDriverPlates.length} biển số thiếu tài xế ({parsedRows.filter((r) => r.isMissingDriver).length} dòng)
                </span>
              )}

              {errorRows.length > 0 && uniqueMissingDriverPlates.length === 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {errorRows.length} dòng lỗi
                </span>
              )}
            </div>

            {/* Prominent Warning for Missing Drivers */}
            {uniqueMissingDriverPlates.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800/80 rounded-xl space-y-2.5">
                <div className="flex items-start gap-2 text-xs sm:text-sm font-bold text-red-800 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>
                    CẢNH BÁO: Không tìm thấy tài xế (driver_id) cho {uniqueMissingDriverPlates.length} biển số xe dưới đây — Các chuyến xe này KHÔNG THỂ insert vào database:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  {uniqueMissingDriverPlates.map((plate) => (
                    <span
                      key={plate}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-xs font-bold bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 shadow-2xs"
                    >
                      {plate}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 pl-6 leading-relaxed">
                  💡 <em>Hướng dẫn:</em> Vui lòng truy cập <strong>Quản lý danh mục ➔ Danh mục tài xế</strong> để phân công tài xế tương ứng cho các xe trên trước khi import, hoặc tiếp tục import để chỉ lưu các chuyến xe hợp lệ.
                </p>
              </div>
            )}

            {/* Preview table */}
            <div className="overflow-x-auto max-h-[380px] rounded-xl border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/80 sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-700">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      Dòng
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      Biển số xe *
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      Tài xế (Nhận diện)
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      Nơi giao / Điểm nhận
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      Tấn
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      CAN
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      Ghi chú
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-neutral-500 uppercase whitespace-nowrap">
                      Trạng thái Insert
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {parsedRows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={cn(
                        'transition-colors',
                        r.isValid
                          ? 'hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40'
                          : 'bg-red-50/50 dark:bg-red-950/25',
                      )}
                    >
                      <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-semibold">
                        {r.cleanPlate ? (
                          <div className="flex items-center gap-1.5">
                            <span className={cn(r.isMissingDriver && 'text-red-700 dark:text-red-300 font-bold')}>{r.cleanPlate}</span>
                            {r.isCompanyVehicle ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-medium">
                                Xe nhà
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                                Xe ngoài
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-500 font-bold italic">Trống</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.driverName ? (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">
                            {r.driverName}
                          </span>
                        ) : (
                          <span className="text-red-500 dark:text-red-400 font-semibold text-xs italic">
                            Chưa có tài xế
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                        {r.diemNhan || <span className="text-red-500 italic">Trống</span>}
                      </td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300 font-mono text-xs">
                        {r.tan || '—'}
                      </td>
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300 font-mono text-xs">
                        {r.can || '—'}
                      </td>
                      <td className="px-3 py-2 text-neutral-500 max-w-[200px] truncate">{r.ghiChu || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            Sẽ insert ({r.driverName})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            {r.errorMessage}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                  setFileError('');
                }}
                disabled={isSubmitting}
                className="w-full sm:w-auto h-11 sm:h-10 text-xs sm:text-sm"
              >
                Chọn file khác
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 sm:h-10 text-xs sm:text-sm"
                >
                  {t('dispatch.importModal.cancel' as never) || 'Hủy'}
                </Button>
                <Button
                  onClick={handleConfirmImport}
                  isLoading={isSubmitting}
                  disabled={isSubmitting || validRows.length === 0}
                  className="w-full sm:w-auto h-11 sm:h-10 font-semibold text-xs sm:text-sm justify-center"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  {isSubmitting
                    ? t('dispatch.importModal.submitting' as never) || 'Đang import...'
                    : errorRows.length > 0
                      ? `Xác nhận Import (${validRows.length} chuyến hợp lệ) — Bỏ qua ${errorRows.length} lỗi`
                      : `Xác nhận Import (${validRows.length} chuyến)`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
