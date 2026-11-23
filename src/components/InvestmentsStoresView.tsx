import React, { useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  AssetCategory,
  AssetItem,
  ComputedScenarioResult,
  DeploymentStatus,
  LocationItem,
  LocationType,
  ScenarioData,
} from '../types/finance';
import { formatNumber, formatVnd } from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import { NumericCell, StatusSelect, TextCell } from './EditableCell';

interface InvestmentsStoresViewProps {
  scenario: ScenarioData;
  result: ComputedScenarioResult;
  onUpdateScenario: (updater: (prev: ScenarioData) => ScenarioData) => void;
}

const ASSET_CATEGORIES: AssetCategory[] = [
  'Xây dựng, cải tạo văn phòng',
  'Nội thất văn phòng',
  'Thiết bị làm việc',
  'Xây dựng cửa hàng',
  'Kệ và quầy trưng bày',
  'Tủ mát, tủ đông',
  'Thiết bị bảo quản',
  'Máy đóng gói',
  'Kho lạnh',
  'Xe vận chuyển',
  'Thiết bị tại điểm bán',
  'Hạ tầng công nghệ',
  'Đầu tư khác',
];

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  store: 'Cửa hàng / Điểm bán',
  office: 'Văn phòng',
  warehouse: 'Kho bãi / Xưởng',
};

export const InvestmentsStoresView: React.FC<InvestmentsStoresViewProps> = ({
  scenario,
  result,
  onUpdateScenario,
}) => {
  const [subTab, setSubTab] = useState<'assets' | 'locations'>('assets');
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'asset' | 'location';
    id: string;
    label: string;
  } | null>(null);

  const updateAsset = (id: string, patch: Partial<AssetItem>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      assets: prev.assets.map((a) =>
        a.id === id
          ? { ...a, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : a
      ),
    }));
  };

  const addAsset = () => {
    const newAsset: AssetItem = {
      id: `TS-${Date.now().toString().slice(-4)}`,
      name: 'Hạng mục đầu tư mới',
      category: 'Thiết bị tại điểm bán',
      locationId: scenario.locations[0]?.id || '',
      quantity: 1,
      unitPrice: 30000000,
      paymentMonth: 1,
      inServiceMonth: 1,
      depreciableMonths: 36,
      salvageValue: 0,
      isDepreciable: true,
      monthlyFixedOpCost: 0,
      monthlyMaintenanceCost: 200000,
      deploymentStatus: 'planned',
      status: 'assumed',
      source: 'Nhập mới',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Vận hành',
      note: '',
    };
    onUpdateScenario((prev) => ({
      ...prev,
      assets: [...prev.assets, newAsset],
    }));
  };

  const duplicateAsset = (a: AssetItem) => {
    const copy: AssetItem = {
      ...structuredClone(a),
      id: `${a.id}-CP-${Date.now().toString().slice(-3)}`,
      name: `${a.name} (Bản sao)`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onUpdateScenario((prev) => ({
      ...prev,
      assets: [...prev.assets, copy],
    }));
  };

  const updateLocation = (id: string, patch: Partial<LocationItem>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      locations: prev.locations.map((l) =>
        l.id === id
          ? { ...l, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : l
      ),
    }));
  };

  const addLocation = () => {
    const newLoc: LocationItem = {
      id: `LOC-${Date.now().toString().slice(-4)}`,
      name: 'Cửa hàng Organic mới',
      type: 'store',
      isActive: true,
      openMonth: 1,
      monthlyRent: 20000000,
      monthlyFixedPayroll: 15000000,
      monthlyUtilities: 2500000,
      monthlyInternet: 400000,
      monthlyMaintenance: 500000,
      monthlyOtherFixed: 800000,
      allocatedSharedCostPct: 5,
      storeRevenueSharePct: 0,
      status: 'assumed',
      source: 'Nhập mới',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Bán lẻ',
      note: '',
    };
    onUpdateScenario((prev) => ({
      ...prev,
      locations: [...prev.locations, newLoc],
    }));
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'asset') {
      onUpdateScenario((prev) => ({
        ...prev,
        assets: prev.assets.filter((a) => a.id !== deleteTarget.id),
      }));
    } else {
      onUpdateScenario((prev) => ({
        ...prev,
        locations: prev.locations.filter((l) => l.id !== deleteTarget.id),
      }));
    }
    setDeleteTarget(null);
  };

  const totalAnnualDepr = result.monthlyPnl.reduce(
    (s, m) => s + m.depreciationCost,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Đầu tư, văn phòng, kho và điểm bán
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Vốn đầu tư (CapEx) ghi nhận vào Dòng tiền đầu tư tại tháng thanh toán; khấu hao mô phỏng phân bổ vào P&L từ tháng đưa vào sử dụng (Công thức 31–35).
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('assets')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'assets'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tài sản & Vốn đầu tư (CapEx)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('locations')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'locations'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Văn phòng & Điểm bán (P&L cửa hàng)
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Tổng vốn đầu tư (Công thức 31)</div>
          <div className="mt-1 font-num text-xl font-semibold text-slate-900">
            {formatVnd(result.totalCapex)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Tổng khấu hao mô phỏng năm (Công thức 32)</div>
          <div className="mt-1 font-num text-xl font-semibold text-slate-900">
            {formatVnd(totalAnnualDepr)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Số điểm bán / Văn phòng / Kho</div>
          <div className="mt-1 font-num text-xl font-semibold text-emerald-700">
            {scenario.locations.filter((l) => l.isActive).length} đang hoạt động /{' '}
            {scenario.locations.length} tổng
          </div>
        </div>
      </div>

      {subTab === 'assets' && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Danh mục tài sản & hạng mục đầu tư (13 nhóm tài sản)
            </h3>
            <button
              type="button"
              onClick={addAsset}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm hạng mục đầu tư
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="px-2.5 py-2.5 whitespace-nowrap">Mã</th>
                  <th className="px-2 py-2.5 w-[175px] max-w-[175px]">Tên hạng mục</th>
                  <th className="px-2 py-2.5 w-[130px] max-w-[130px]">Nhóm TS</th>
                  <th className="px-2 py-2.5 w-[135px] max-w-[135px]">Địa điểm</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">SL</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Đơn giá</th>
                  <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap">Tổng vốn ĐT</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap" title="Tháng thanh toán">Th.TT</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap" title="Tháng đưa vào sử dụng">Th.SD</th>
                  <th className="px-2 py-2.5 text-center whitespace-nowrap" title="Đủ điều kiện khấu hao">KH?</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap" title="Số tháng khấu hao">Tháng KH</th>
                  <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap">KH/tháng</th>
                  <th className="px-2 py-2.5 whitespace-nowrap">Triển khai</th>
                  <th className="px-2 py-2.5 whitespace-nowrap">Trạng thái</th>
                  <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scenario.assets.map((a) => {
                  const total = a.quantity * a.unitPrice;
                  const monthlyDepr =
                    a.isDepreciable && a.depreciableMonths > 0
                      ? Math.max(0, total - a.salvageValue) / a.depreciableMonths
                      : 0;
                  const locName =
                    scenario.locations.find((l) => l.id === a.locationId)?.name || '';
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="px-2.5 py-2 font-num text-[11px] text-slate-500 whitespace-nowrap">
                        {a.id}
                      </td>
                      <td className="px-1.5 py-1.5 w-[175px] max-w-[175px]">
                        <TextCell
                          value={a.name}
                          onChange={(v) => updateAsset(a.id, { name: v })}
                        />
                      </td>
                      <td className="px-1.5 py-1.5 w-[130px] max-w-[130px]">
                        <select
                          value={a.category}
                          title={a.category}
                          onChange={(e) =>
                            updateAsset(a.id, {
                              category: e.target.value as AssetCategory,
                            })
                          }
                          className="w-full max-w-[125px] truncate rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        >
                          {ASSET_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5 w-[135px] max-w-[135px]">
                        <select
                          value={a.locationId}
                          title={locName}
                          onChange={(e) =>
                            updateAsset(a.id, { locationId: e.target.value })
                          }
                          className="w-full max-w-[130px] truncate rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        >
                          {scenario.locations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={a.quantity}
                          mode="number"
                          min={0}
                          onChange={(v) => updateAsset(a.id, { quantity: Math.round(v) })}
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={a.unitPrice}
                          mode="currency"
                          min={0}
                          onChange={(v) => updateAsset(a.id, { unitPrice: v })}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-num bg-slate-50 font-semibold text-slate-900 whitespace-nowrap">
                        {formatVnd(total, true)}
                      </td>
                      <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={a.paymentMonth}
                          onChange={(e) =>
                            updateAsset(a.id, {
                              paymentMonth: Math.max(
                                1,
                                Math.min(12, Number(e.target.value) || 1)
                              ),
                            })
                          }
                          className="w-11 rounded border border-slate-200 px-1 py-0.5 text-center font-num text-xs"
                        />
                      </td>
                      <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={a.inServiceMonth}
                          onChange={(e) =>
                            updateAsset(a.id, {
                              inServiceMonth: Math.max(
                                1,
                                Math.min(12, Number(e.target.value) || 1)
                              ),
                            })
                          }
                          className="w-11 rounded border border-slate-200 px-1 py-0.5 text-center font-num text-xs"
                        />
                      </td>
                      <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={a.isDepreciable}
                          onChange={(e) =>
                            updateAsset(a.id, { isDepreciable: e.target.checked })
                          }
                          aria-label="Đủ điều kiện khấu hao"
                          className="h-4 w-4 accent-emerald-700"
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={a.depreciableMonths}
                          mode="number"
                          min={1}
                          onChange={(v) =>
                            updateAsset(a.id, { depreciableMonths: Math.round(v) })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-num bg-slate-50 font-medium text-emerald-700 whitespace-nowrap">
                        {formatVnd(monthlyDepr)}
                      </td>
                      <td className="px-1.5 py-1.5 whitespace-nowrap">
                        <select
                          value={a.deploymentStatus}
                          onChange={(e) =>
                            updateAsset(a.id, {
                              deploymentStatus: e.target.value as DeploymentStatus,
                            })
                          }
                          className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs whitespace-nowrap"
                        >
                          <option value="planned">Dự kiến</option>
                          <option value="purchasing">Đang mua</option>
                          <option value="in_service">Đang dùng</option>
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5 whitespace-nowrap">
                        <StatusSelect
                          value={a.status}
                          onChange={(s) => updateAsset(a.id, { status: s })}
                        />
                      </td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateAsset(a)}
                            title="Nhân bản"
                            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'asset',
                                id: a.id,
                                label: a.name,
                              })
                            }
                            title="Xóa"
                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'locations' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Cấu hình chi phí vận hành Văn phòng, Kho & Cửa hàng (Công thức 33)
              </h3>
              <button
                type="button"
                onClick={addLocation}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm địa điểm / điểm bán
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="px-2.5 py-2.5 text-center whitespace-nowrap">HĐ?</th>
                    <th className="px-2 py-2.5 w-[180px] max-w-[180px]">Tên địa điểm</th>
                    <th className="px-2 py-2.5 w-[135px] max-w-[135px]">Loại</th>
                    <th className="px-2 py-2.5 text-center whitespace-nowrap">Mở từ</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Thuê MB/tháng</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Lương ĐB/tháng</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Điện nước + BT</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap" title="Tỷ trọng doanh thu cửa hàng (%)">Tỷ trọng DT (%)</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap" title="Phân bổ chi phí chung (%)">CP chung (%)</th>
                    <th className="px-2 py-2.5 whitespace-nowrap">Trạng thái</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scenario.locations.map((loc) => (
                    <tr key={loc.id} className="hover:bg-slate-50/70">
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={loc.isActive}
                          onChange={(e) =>
                            updateLocation(loc.id, { isActive: e.target.checked })
                          }
                          className="h-4 w-4 accent-emerald-700"
                        />
                      </td>
                      <td className="px-1.5 py-1.5 w-[180px] max-w-[180px]">
                        <TextCell
                          value={loc.name}
                          onChange={(v) => updateLocation(loc.id, { name: v })}
                        />
                      </td>
                      <td className="px-1.5 py-1.5 w-[135px] max-w-[135px]">
                        <select
                          value={loc.type}
                          title={LOCATION_TYPE_LABELS[loc.type]}
                          onChange={(e) =>
                            updateLocation(loc.id, {
                              type: e.target.value as LocationType,
                            })
                          }
                          className="w-full max-w-[130px] truncate rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        >
                          {(Object.keys(LOCATION_TYPE_LABELS) as LocationType[]).map(
                            (lt) => (
                              <option key={lt} value={lt}>
                                {LOCATION_TYPE_LABELS[lt]}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={loc.openMonth}
                          onChange={(e) =>
                            updateLocation(loc.id, {
                              openMonth: Math.max(
                                1,
                                Math.min(12, Number(e.target.value) || 1)
                              ),
                            })
                          }
                          className="w-11 rounded border border-slate-200 px-1 py-0.5 text-center font-num text-xs"
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={loc.monthlyRent}
                          mode="currency"
                          min={0}
                          onChange={(v) => updateLocation(loc.id, { monthlyRent: v })}
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={loc.monthlyFixedPayroll}
                          mode="currency"
                          min={0}
                          onChange={(v) =>
                            updateLocation(loc.id, { monthlyFixedPayroll: v })
                          }
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={
                            loc.monthlyUtilities +
                            loc.monthlyInternet +
                            loc.monthlyMaintenance +
                            loc.monthlyOtherFixed
                          }
                          mode="currency"
                          min={0}
                          onChange={(v) =>
                            updateLocation(loc.id, {
                              monthlyUtilities: v,
                              monthlyInternet: 0,
                              monthlyMaintenance: 0,
                              monthlyOtherFixed: 0,
                            })
                          }
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={loc.storeRevenueSharePct}
                          mode="number"
                          decimals={0}
                          min={0}
                          max={100}
                          onChange={(v) =>
                            updateLocation(loc.id, { storeRevenueSharePct: v })
                          }
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={loc.allocatedSharedCostPct}
                          mode="number"
                          decimals={0}
                          min={0}
                          max={100}
                          onChange={(v) =>
                            updateLocation(loc.id, { allocatedSharedCostPct: v })
                          }
                        />
                      </td>
                      <td className="px-1.5 py-1.5 whitespace-nowrap">
                        <StatusSelect
                          value={loc.status}
                          onChange={(s) => updateLocation(loc.id, { status: s })}
                        />
                      </td>
                      <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'location',
                              id: loc.id,
                              label: loc.name,
                            })
                          }
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Store P&L Before & After Shared Cost Allocation (Formulas 34-35) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Báo cáo hiệu quả điểm bán (Trước & Sau phân bổ chi phí chung – Công thức 34 & 35)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Chi phí chung phân bổ chỉ phục vụ đánh giá hiệu quả từng điểm bán, không làm tăng tổng chi phí P&L toàn công ty.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 pr-3 max-w-[200px]">Địa điểm</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Lãi đóng góp (CM)</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">CP cố định trực tiếp</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Khấu hao tài sản</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">LN trước phân bổ</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">CP chung phân bổ</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">LN sau phân bổ</th>
                    <th className="py-2 pl-3 text-right whitespace-nowrap">Hòa vốn/tháng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.storeSummaries.map((st) => (
                    <tr key={st.locationId}>
                      <td
                        className="py-2 pr-3 max-w-[200px] truncate font-medium text-slate-900"
                        title={st.name}
                      >
                        {st.name}
                      </td>
                      <td className="py-2 px-3 text-right font-num whitespace-nowrap">
                        {formatVnd(st.annualContributionMargin, true)}
                      </td>
                      <td className="py-2 px-3 text-right font-num whitespace-nowrap">
                        {formatVnd(st.annualDirectFixedCost, true)}
                      </td>
                      <td className="py-2 px-3 text-right font-num whitespace-nowrap">
                        {formatVnd(st.annualAssetDepreciation, true)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-num font-semibold whitespace-nowrap ${
                          st.annualProfitBeforeAlloc >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {formatVnd(st.annualProfitBeforeAlloc, true)}
                      </td>
                      <td className="py-2 px-3 text-right font-num text-slate-600 whitespace-nowrap">
                        {formatVnd(st.annualAllocatedSharedCost, true)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-num font-semibold whitespace-nowrap ${
                          st.annualProfitAfterAlloc >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {formatVnd(st.annualProfitAfterAlloc, true)}
                      </td>
                      <td className="py-2 pl-3 text-right font-num whitespace-nowrap">
                        {st.breakEvenUnitsMonthly !== null
                          ? `${formatNumber(Math.round(st.breakEvenUnitsMonthly))} đv`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Xác nhận xóa"
        description={`Bạn có chắc muốn xóa "${deleteTarget?.label}"?`}
        confirmLabel="Xóa"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
