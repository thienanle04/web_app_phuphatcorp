import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Truck, Car, MapPin, Navigation, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { SearchableSelect, type SearchableSelectOption } from '../ui/SearchableSelect';
import { cn } from '../../utils/cn';
import { useGetVehicles } from '../../hooks/useVehicleCatalog';
import { useGetDeliveryPoints } from '../../hooks/useDeliveryPoints';
import { driverApi, type VehicleDriver } from '../../api/driverApi';
import type { CreateDispatchScheduleBatchItem } from '../../api/dispatchApi';

interface CreateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  onSubmit: (items: CreateDispatchScheduleBatchItem[]) => Promise<void>;
  isSubmitting: boolean;
  presetLoaiTuyen?: LoaiTuyen;
  presetLoaiXe?: LoaiXe;
}

type LoaiTuyen = 'Tuyến cố định' | 'Tuyến ngoài';
type LoaiXe = 'Xe lớn' | 'Xe nhỏ';

interface TripItem {
  id: string;
  bien_so: string;
  tai_xe: string;
  vehicle_id: number | null;
  driver_id: number | null;
  diem_nhan: string;
  tan: string;
  can: string;
  ghi_chu: string;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

const createEmptyTrip = (): TripItem => ({
  id: crypto.randomUUID(),
  bien_so: '',
  tai_xe: '',
  vehicle_id: null,
  driver_id: null,
  diem_nhan: '',
  tan: '',
  can: '',
  ghi_chu: '',
});

export function CreateScheduleModal({
  isOpen,
  onClose,
  selectedDate,
  onSubmit,
  isSubmitting,
  presetLoaiTuyen,
  presetLoaiXe,
}: CreateScheduleModalProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loai_tuyen, setLoaiTuyen] = useState<LoaiTuyen | null>(null);
  const [loai_xe, setLoaiXe] = useState<LoaiXe | null>(null);
  const [trips, setTrips] = useState<TripItem[]>([createEmptyTrip()]);
  const [errors, setErrors] = useState<FieldErrors>({});

  const { data: vehiclesData } = useGetVehicles('', 'active', undefined, 1, 200);
  const vehicles = vehiclesData?.vehicles ?? [];

  const { data: deliveryPointsData } = useGetDeliveryPoints('', 1, 200);
  const deliveryPoints = deliveryPointsData?.items ?? [];

  const [driversByVehicle, setDriversByVehicle] = useState<Map<number, VehicleDriver[]>>(new Map());

  const vehicleOptions: SearchableSelectOption[] = useMemo(
    () =>
      vehicles.map((v) => ({
        value: String(v.id),
        label: `${v.plate_number}${v.driver_name ? ` (${v.driver_name})` : ''}`,
      })),
    [vehicles],
  );

  const deliveryPointOptions: SearchableSelectOption[] = useMemo(
    () =>
      deliveryPoints.map((dp) => ({
        value: dp.code,
        label: dp.address ? `${dp.code} - ${dp.address}` : dp.code,
      })),
    [deliveryPoints],
  );

  useEffect(() => {
    if (isOpen) {
      setLoaiTuyen(presetLoaiTuyen ?? null);
      setLoaiXe(presetLoaiXe ?? null);
      setTrips([createEmptyTrip()]);
      setErrors({});
      if (presetLoaiTuyen && presetLoaiXe) {
        setStep(3);
      } else if (presetLoaiTuyen) {
        setStep(2);
      } else {
        setStep(1);
      }
    }
  }, [isOpen, presetLoaiTuyen, presetLoaiXe]);

  const handleClose = () => {
    setStep(1);
    setLoaiTuyen(null);
    setLoaiXe(null);
    setTrips([createEmptyTrip()]);
    setErrors({});
    onClose();
  };

  const handleSelectLoaiTuyen = (tuyen: LoaiTuyen) => {
    setLoaiTuyen(tuyen);
    setStep(2);
  };

  const handleSelectLoaiXe = (loai: LoaiXe) => {
    setLoaiXe(loai);
    setStep(3);
  };

  const handleVehicleSelect = async (tripId: string, vehicleId: number | null) => {
    setTrips((prev) =>
      prev.map((trip) => {
        if (trip.id !== tripId) return trip;
        if (vehicleId === null) {
          return { ...trip, vehicle_id: null, bien_so: '', tai_xe: '', driver_id: null };
        }
        const vehicle = vehicles.find((v) => v.id === vehicleId);
        if (vehicle) {
          return {
            ...trip,
            vehicle_id: vehicleId,
            bien_so: vehicle.plate_number,
            tai_xe: vehicle.driver_name,
            driver_id: null,
          };
        }
        return trip;
      }),
    );

    if (vehicleId) {
      if (!driversByVehicle.has(vehicleId)) {
        try {
          const drivers = await driverApi.getDriversByVehicle(vehicleId);
          setDriversByVehicle((prev) => new Map(prev).set(vehicleId, drivers));
          if (drivers.length > 0) {
            const firstDriver = drivers[0];
            setTrips((prev) =>
              prev.map((trip) => {
                if (trip.id !== tripId) return trip;
                return {
                  ...trip,
                  tai_xe: firstDriver.full_name,
                  driver_id: firstDriver.user_id,
                };
              }),
            );
          }
        } catch {
          setDriversByVehicle((prev) => new Map(prev).set(vehicleId, []));
        }
      } else {
        const drivers = driversByVehicle.get(vehicleId);
        if (drivers && drivers.length > 0) {
          const firstDriver = drivers[0];
          setTrips((prev) =>
            prev.map((trip) => {
              if (trip.id !== tripId) return trip;
              return {
                ...trip,
                tai_xe: firstDriver.full_name,
                driver_id: firstDriver.user_id,
              };
            }),
          );
        }
      }
    }
  };

  const handleTripFieldChange = (tripId: string, field: keyof TripItem, value: string) => {
    setTrips((prev) =>
      prev.map((trip) => {
        if (trip.id !== tripId) return trip;
        return { ...trip, [field]: value };
      }),
    );
  };

  const addTrip = () => {
    setTrips((prev) => [...prev, createEmptyTrip()]);
  };

  const removeTrip = (tripId: string) => {
    if (trips.length === 1) return;
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
  };

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};
    let hasError = false;

    trips.forEach((trip, index) => {
      const prefix = `trip-${index}`;
      if (!trip.bien_so.trim()) {
        newErrors[`${prefix}-bien_so`] = t('dispatch.validation.bienSoRequired' as never);
        hasError = true;
      }
      if (!trip.diem_nhan.trim()) {
        newErrors[`${prefix}-diem_nhan`] = t('dispatch.validation.diemNhanRequired' as never);
        hasError = true;
      }
    });

    setErrors(newErrors);
    return !hasError;
  };

  const handleSubmit = async () => {
    if (!validate() || !loai_tuyen || !loai_xe) return;

    const items: CreateDispatchScheduleBatchItem[] = trips.map((trip) => ({
      ngay: selectedDate,
      loai_tuyen,
      loai_xe,
      bien_so: trip.bien_so,
      tai_xe: trip.tai_xe || null,
      vehicle_id: trip.vehicle_id,
      driver_id: trip.driver_id,
      diem_nhan: trip.diem_nhan,
      tan: trip.tan || null,
      can: trip.can || null,
      ghi_chu: trip.ghi_chu || null,
    }));

    await onSubmit(items);
  };

  const stepTitle =
    step === 1
      ? t('dispatch.createModal.step1Title' as never)
      : step === 2
        ? t('dispatch.createModal.step2Title' as never)
        : t('dispatch.createModal.step3Title' as never);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('dispatch.createModal.title' as never)}
      size="2/3"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-100 dark:border-neutral-800">
        <p className="text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-400">{stepTitle}</p>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", step >= 1 ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-700")} />
          <span className={cn("w-2 h-2 rounded-full", step >= 2 ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-700")} />
          <span className={cn("w-2 h-2 rounded-full", step >= 3 ? "bg-primary" : "bg-neutral-300 dark:bg-neutral-700")} />
        </div>
      </div>

      {/* Step 1 — Tuyến cố định / Tuyến ngoài */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <button
            onClick={() => handleSelectLoaiTuyen('Tuyến cố định')}
            className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl hover:border-primary dark:hover:border-primary hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
              {t('dispatch.createModal.tuyenCoDinh' as never)}
            </span>
          </button>
          <button
            onClick={() => handleSelectLoaiTuyen('Tuyến ngoài')}
            className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl hover:border-primary dark:hover:border-primary hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-all text-center"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Navigation className="w-6 h-6" />
            </div>
            <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
              {t('dispatch.createModal.tuyenNgoai' as never)}
            </span>
          </button>
        </div>
      )}

      {/* Step 2 — Xe nhỏ / Xe lớn */}
      {step === 2 && (
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => handleSelectLoaiXe('Xe nhỏ')}
              className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl hover:border-primary dark:hover:border-primary hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-all text-center"
            >
              <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Car className="w-6 h-6" />
              </div>
              <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                {t('dispatch.createModal.xeNho' as never)}
              </span>
            </button>
            <button
              onClick={() => handleSelectLoaiXe('Xe lớn')}
              className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl hover:border-primary dark:hover:border-primary hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-all text-center"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Truck className="w-6 h-6" />
              </div>
              <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                {t('dispatch.createModal.xeLon' as never)}
              </span>
            </button>
          </div>
          <div className="flex justify-start pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="h-11 sm:h-10">
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('dispatch.createModal.back' as never)}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Form nhập chuyến (Cards on Mobile / Table on Desktop) */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Badge Summary info */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
              {loai_tuyen}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
              {loai_xe}
            </span>
            <span className="text-neutral-400 ml-auto">{trips.length} chuyến</span>
          </div>

          {/* Mobile View: Trip Cards (< md) */}
          <div className="md:hidden space-y-3">
            {trips.map((trip, index) => (
              <div
                key={trip.id}
                className="p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs px-2 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                    Chuyến #{index + 1}
                  </span>
                  {trips.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTrip(trip.id)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                      title="Xóa chuyến"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('dispatch.createModal.bienSo' as never)} <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={vehicleOptions}
                      value={trip.vehicle_id ? String(trip.vehicle_id) : ''}
                      onChange={(val) => handleVehicleSelect(trip.id, val ? Number(val) : null)}
                      placeholder={t('dispatch.createModal.bienSoPlaceholder' as never)}
                      searchPlaceholder="Tìm biển số xe..."
                      clearable
                      error={errors[`trip-${index}-bien_so`]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('dispatch.createModal.taiXe' as never)}
                    </label>
                    {trip.vehicle_id ? (
                      <SearchableSelect
                        options={(driversByVehicle.get(trip.vehicle_id) || []).map((d) => ({
                          value: String(d.user_id),
                          label: d.full_name,
                        }))}
                        value={trip.driver_id ? String(trip.driver_id) : ''}
                        onChange={(val) => {
                          const driverUserId = val ? Number(val) : null;
                          const drivers = driversByVehicle.get(trip.vehicle_id!) || [];
                          const selectedDriver = drivers.find((d) => d.user_id === driverUserId);
                          setTrips((prev) =>
                            prev.map((t) => {
                              if (t.id !== trip.id) return t;
                              return {
                                ...t,
                                driver_id: driverUserId,
                                tai_xe: selectedDriver ? selectedDriver.full_name : '',
                              };
                            }),
                          );
                        }}
                        placeholder={t('dispatch.createModal.taiXePlaceholder' as never)}
                        searchPlaceholder="Tìm tài xế..."
                        clearable
                      />
                    ) : (
                      <input
                        type="text"
                        value={trip.tai_xe}
                        onChange={(e) => handleTripFieldChange(trip.id, 'tai_xe', e.target.value)}
                        placeholder={t('dispatch.createModal.taiXePlaceholder' as never)}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-base sm:text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none h-11"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('dispatch.createModal.diemNhan' as never)} <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={deliveryPointOptions}
                      value={trip.diem_nhan}
                      onChange={(val) => handleTripFieldChange(trip.id, 'diem_nhan', val)}
                      placeholder={t('dispatch.createModal.diemNhanPlaceholder' as never)}
                      searchPlaceholder="Tìm điểm nhận hàng..."
                      clearable
                      error={errors[`trip-${index}-diem_nhan`]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        {t('dispatch.createModal.tan' as never)}
                      </label>
                      <input
                        type="text"
                        value={trip.tan}
                        onChange={(e) => handleTripFieldChange(trip.id, 'tan', e.target.value)}
                        placeholder="Số tấn"
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-base sm:text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none h-11"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                        {t('dispatch.createModal.can' as never)}
                      </label>
                      <input
                        type="text"
                        value={trip.can}
                        onChange={(e) => handleTripFieldChange(trip.id, 'can', e.target.value)}
                        placeholder="Cán"
                        className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-base sm:text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none h-11"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('dispatch.createModal.ghiChu' as never)}
                    </label>
                    <input
                      type="text"
                      value={trip.ghi_chu}
                      onChange={(e) => handleTripFieldChange(trip.id, 'ghi_chu', e.target.value)}
                      placeholder={t('dispatch.createModal.ghiChuPlaceholder' as never)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-base sm:text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none h-11"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table (>= md) */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                    {t('dispatch.createModal.bienSo' as never)} <span className="text-red-500">*</span>
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                    {t('dispatch.createModal.taiXe' as never)}
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                    {t('dispatch.createModal.diemNhan' as never)} <span className="text-red-500">*</span>
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                    {t('dispatch.createModal.tan' as never)}
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap">
                    {t('dispatch.createModal.can' as never)}
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase whitespace-nowrap min-w-[120px]">
                    {t('dispatch.createModal.ghiChu' as never)}
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {trips.map((trip, index) => (
                  <tr key={trip.id} className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0">
                    <td className="px-2 py-2 min-w-[200px]">
                      <SearchableSelect
                        options={vehicleOptions}
                        value={trip.vehicle_id ? String(trip.vehicle_id) : ''}
                        onChange={(val) => handleVehicleSelect(trip.id, val ? Number(val) : null)}
                        placeholder={t('dispatch.createModal.bienSoPlaceholder' as never)}
                        searchPlaceholder="Tìm biển số xe..."
                        clearable
                        error={errors[`trip-${index}-bien_so`]}
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[160px]">
                      {trip.vehicle_id ? (
                        <SearchableSelect
                          options={(driversByVehicle.get(trip.vehicle_id) || []).map((d) => ({
                            value: String(d.user_id),
                            label: d.full_name,
                          }))}
                          value={trip.driver_id ? String(trip.driver_id) : ''}
                          onChange={(val) => {
                            const driverUserId = val ? Number(val) : null;
                            const drivers = driversByVehicle.get(trip.vehicle_id!) || [];
                            const selectedDriver = drivers.find((d) => d.user_id === driverUserId);
                            setTrips((prev) =>
                              prev.map((t) => {
                                if (t.id !== trip.id) return t;
                                return {
                                  ...t,
                                  driver_id: driverUserId,
                                  tai_xe: selectedDriver ? selectedDriver.full_name : '',
                                };
                              }),
                            );
                          }}
                          placeholder={t('dispatch.createModal.taiXePlaceholder' as never)}
                          searchPlaceholder="Tìm tài xế..."
                          clearable
                        />
                      ) : (
                        <input
                          type="text"
                          value={trip.tai_xe}
                          onChange={(e) => handleTripFieldChange(trip.id, 'tai_xe', e.target.value)}
                          placeholder={t('dispatch.createModal.taiXePlaceholder' as never)}
                          className="w-full px-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-500 dark:focus:border-neutral-400 transition-colors"
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 min-w-[200px]">
                      <SearchableSelect
                        options={deliveryPointOptions}
                        value={trip.diem_nhan}
                        onChange={(val) => handleTripFieldChange(trip.id, 'diem_nhan', val)}
                        placeholder={t('dispatch.createModal.diemNhanPlaceholder' as never)}
                        searchPlaceholder="Tìm điểm nhận..."
                        clearable
                        error={errors[`trip-${index}-diem_nhan`]}
                      />
                    </td>
                    <td className="px-2 py-2 w-[100px]">
                      <input
                        type="text"
                        value={trip.tan}
                        onChange={(e) => handleTripFieldChange(trip.id, 'tan', e.target.value)}
                        placeholder="Tấn"
                        className="w-full px-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-500 dark:focus:border-neutral-400 transition-colors"
                      />
                    </td>
                    <td className="px-2 py-2 w-[100px]">
                      <input
                        type="text"
                        value={trip.can}
                        onChange={(e) => handleTripFieldChange(trip.id, 'can', e.target.value)}
                        placeholder="CAN"
                        className="w-full px-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-500 dark:focus:border-neutral-400 transition-colors"
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[140px]">
                      <input
                        type="text"
                        value={trip.ghi_chu}
                        onChange={(e) => handleTripFieldChange(trip.id, 'ghi_chu', e.target.value)}
                        placeholder={t('dispatch.createModal.ghiChuPlaceholder' as never)}
                        className="w-full px-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-500 dark:focus:border-neutral-400 transition-colors"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {trips.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTrip(trip.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Xóa chuyến"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" onClick={addTrip} className="w-full h-11 sm:h-10 text-sm font-medium">
            <Plus className="w-4 h-4 mr-1" />
            {t('dispatch.createModal.addTrip' as never)}
          </Button>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <Button variant="outline" onClick={() => setStep(2)} className="w-full sm:w-auto h-11 sm:h-10">
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('dispatch.createModal.back' as never)}
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-11 sm:h-10 font-medium"
            >
              {isSubmitting
                ? t('dispatch.createModal.submitting' as never)
                : t('dispatch.createModal.submit' as never)}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
