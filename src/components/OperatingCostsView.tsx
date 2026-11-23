import React, { useState } from 'react';
import { Copy, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  AccountingClass,
  ComputedScenarioResult,
  CostBehavior,
  CostFrequency,
  CostGroup,
  MarketingCampaign,
  MarketingPillar,
  OperatingCostItem,
  ScenarioData,
} from '../types/finance';
import {
  PILLAR_LABELS,
  formatNumber,
  formatPct,
  formatVnd,
} from '../utils/format';
import { getCampaignCost } from '../engine/calculator';
import { ConfirmModal } from './ConfirmModal';
import { NumericCell, StatusSelect, TextCell } from './EditableCell';

interface OperatingCostsViewProps {
  scenario: ScenarioData;
  result: ComputedScenarioResult;
  onUpdateScenario: (updater: (prev: ScenarioData) => ScenarioData) => void;
}

const COST_GROUPS: CostGroup[] = [
  'Sản xuất và giá vốn',
  'Giết mổ và sơ chế',
  'Bao bì và đóng gói',
  'Kho và bảo quản',
  'Logistics và giao hàng',
  'Nhân sự',
  'CTV và đại lý',
  'Marketing',
  'Truyền thông',
  'Văn phòng',
  'Cửa hàng và điểm bán',
  'Công nghệ và quản lý',
  'Chi phí tài chính',
  'Dự phòng và chi phí khác',
];

const ACCOUNTING_LABELS: Record<AccountingClass, string> = {
  cogs: 'Giá vốn (COGS)',
  selling_fixed: 'BH cố định',
  marketing: 'Marketing',
  media: 'Truyền thông',
  admin: 'Quản lý DN',
  other_op_fixed: 'Vận hành cố định khác',
  financial: 'Chi phí tài chính',
};

const FREQUENCY_LABELS: Record<CostFrequency, string> = {
  once: 'Một lần',
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  yearly: 'Hàng năm',
};

export const OperatingCostsView: React.FC<OperatingCostsViewProps> = ({
  scenario,
  result,
  onUpdateScenario,
}) => {
  const [subTab, setSubTab] = useState<'opex' | 'marketing'>('opex');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'opex' | 'mkt';
    id: string;
    label: string;
  } | null>(null);

  const updateCost = (id: string, patch: Partial<OperatingCostItem>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      operatingCosts: prev.operatingCosts.map((c) =>
        c.id === id
          ? { ...c, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : c
      ),
    }));
  };

  const addCost = () => {
    const newItem: OperatingCostItem = {
      id: `CP-${Date.now().toString().slice(-4)}`,
      group: 'Văn phòng',
      name: 'Khoản chi phí mới',
      department: 'Vận hành',
      costCenter: 'CC-GEN',
      linkedTarget: 'Toàn công ty',
      costBehavior: 'fixed',
      accountingClass: 'admin',
      quantity: 1,
      unitPrice: 5000000,
      variableRatePerUnit: 0,
      frequency: 'monthly',
      startMonth: 1,
      endMonth: 12,
      allocationPct: 100,
      isMemoAllocationOnly: false,
      includeInPnl: true,
      monthlyBudgetLimit: 6000000,
      status: 'assumed',
      source: 'Nhập mới',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Tài chính',
      note: '',
    };
    onUpdateScenario((prev) => ({
      ...prev,
      operatingCosts: [...prev.operatingCosts, newItem],
    }));
  };

  const duplicateCost = (c: OperatingCostItem) => {
    const copy: OperatingCostItem = {
      ...structuredClone(c),
      id: `${c.id}-CP-${Date.now().toString().slice(-3)}`,
      name: `${c.name} (Bản sao)`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onUpdateScenario((prev) => ({
      ...prev,
      operatingCosts: [...prev.operatingCosts, copy],
    }));
  };

  const updateCampaign = (id: string, patch: Partial<MarketingCampaign>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      marketingCampaigns: prev.marketingCampaigns.map((m) =>
        m.id === id
          ? { ...m, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : m
      ),
    }));
  };

  const addCampaign = () => {
    const newMc: MarketingCampaign = {
      id: `MKT-${Date.now().toString().slice(-4)}`,
      month: 0,
      name: 'Chiến dịch Marketing mới',
      pillar: 'conversion',
      totalBudget: 10000000,
      allocatedBudget: 10000000,
      adSpend: 6000000,
      contentCost: 2000000,
      videoCost: 1000000,
      designCost: 1000000,
      posmCost: 0,
      samplingCost: 0,
      posDevCost: 0,
      leads: 250,
      newCustomers: 70,
      orders: 120,
      attributedRevenue: 40000000,
      attributedCmBeforeMkt: 14000000,
      includeInPnl: true,
      status: 'assumed',
      source: 'Nhập mới',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Marketing',
      note: '',
    };
    onUpdateScenario((prev) => ({
      ...prev,
      marketingCampaigns: [...prev.marketingCampaigns, newMc],
    }));
  };

  const filteredCosts =
    groupFilter === 'ALL'
      ? scenario.operatingCosts
      : scenario.operatingCosts.filter((c) => c.group === groupFilter);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'opex') {
      onUpdateScenario((prev) => ({
        ...prev,
        operatingCosts: prev.operatingCosts.filter((c) => c.id !== deleteTarget.id),
      }));
    } else {
      onUpdateScenario((prev) => ({
        ...prev,
        marketingCampaigns: prev.marketingCampaigns.filter(
          (m) => m.id !== deleteTarget.id
        ),
      }));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Chi phí hoạt động & Marketing
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Quản lý 14 nhóm chi phí theo lịch phát sinh thực tế (Công thức 26–30), tách biệt 3 trụ cột Marketing & Truyền thông (Công thức 36–40).
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('opex')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'opex'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chi phí hoạt động (14 nhóm)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('marketing')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'marketing'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Marketing & Truyền thông
          </button>
        </div>
      </div>

      {subTab === 'opex' && (
        <div className="space-y-4">
          {/* Anti-Double Counting Banner */}
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <div>
              <strong className="text-slate-900">
                Nguyên tắc chống tính trùng (Mục XV):
              </strong>{' '}
              Khoản chi đánh dấu <em>"Chỉ phân bổ tham khảo"</em> sẽ không cộng lại vào P&L tổng công ty. Chi phí phát sinh <em>Một lần</em> chỉ ghi nhận đúng tháng bắt đầu, không tự chia đều 12 tháng.
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Bảng chi tiết chi phí hoạt động
                </h3>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800"
                >
                  <option value="ALL">Tất cả 14 nhóm ({scenario.operatingCosts.length})</option>
                  {COST_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={addCost}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm khoản chi phí
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="px-3 py-2.5">Mã</th>
                    <th className="px-2 py-2.5">Nhóm chi phí</th>
                    <th className="px-2 py-2.5 min-w-[190px]">Hạng mục</th>
                    <th className="px-2 py-2.5">Phân loại P&L</th>
                    <th className="px-2 py-2.5">Loại</th>
                    <th className="px-2 py-2.5">Tần suất</th>
                    <th className="px-2 py-2.5 text-center">BĐ – KT</th>
                    <th className="px-2 py-2.5 text-right">SL</th>
                    <th className="px-2 py-2.5 text-right">Đơn giá / Định mức</th>
                    <th className="px-2 py-2.5 text-right bg-slate-100">Thành tiền kỳ</th>
                    <th className="px-2 py-2.5 text-center">Tính vào P&L</th>
                    <th className="px-2 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCosts.map((c) => {
                    const lineTotal =
                      c.costBehavior === 'fixed'
                        ? c.quantity * c.unitPrice
                        : c.variableRatePerUnit * (result.annualPnl.soldVolumeTotal / 12);
                    const isOverBudget =
                      c.monthlyBudgetLimit > 0 && c.quantity * c.unitPrice > c.monthlyBudgetLimit;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-num text-[11px] text-slate-500">
                          {c.id}
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={c.group}
                            onChange={(e) =>
                              updateCost(c.id, { group: e.target.value as CostGroup })
                            }
                            className="max-w-[155px] rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                          >
                            {COST_GROUPS.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <TextCell
                            value={c.name}
                            onChange={(v) => updateCost(c.id, { name: v })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={c.accountingClass}
                            onChange={(e) =>
                              updateCost(c.id, {
                                accountingClass: e.target.value as AccountingClass,
                              })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                          >
                            {(Object.keys(ACCOUNTING_LABELS) as AccountingClass[]).map(
                              (ac) => (
                                <option key={ac} value={ac}>
                                  {ACCOUNTING_LABELS[ac]}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={c.costBehavior}
                            onChange={(e) =>
                              updateCost(c.id, {
                                costBehavior: e.target.value as CostBehavior,
                              })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                          >
                            <option value="fixed">Cố định</option>
                            <option value="variable">Biến đổi/SL</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={c.frequency}
                            onChange={(e) =>
                              updateCost(c.id, {
                                frequency: e.target.value as CostFrequency,
                              })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                          >
                            {(Object.keys(FREQUENCY_LABELS) as CostFrequency[]).map(
                              (fr) => (
                                <option key={fr} value={fr}>
                                  {FREQUENCY_LABELS[fr]}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="inline-flex items-center gap-1 font-num">
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={c.startMonth}
                              onChange={(e) =>
                                updateCost(c.id, {
                                  startMonth: Math.max(
                                    1,
                                    Math.min(12, Number(e.target.value) || 1)
                                  ),
                                })
                              }
                              className="w-10 rounded border border-slate-200 px-1 py-0.5 text-center text-xs"
                            />
                            <span>–</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={c.endMonth}
                              onChange={(e) =>
                                updateCost(c.id, {
                                  endMonth: Math.max(
                                    c.startMonth,
                                    Math.min(12, Number(e.target.value) || 12)
                                  ),
                                })
                              }
                              className="w-10 rounded border border-slate-200 px-1 py-0.5 text-center text-xs"
                            />
                          </div>
                        </td>
                        <td className="px-1 py-1.5 w-16">
                          <NumericCell
                            value={c.quantity}
                            mode="number"
                            min={0}
                            onChange={(v) => updateCost(c.id, { quantity: v })}
                          />
                        </td>
                        <td className="px-1 py-1.5 w-28">
                          {c.costBehavior === 'fixed' ? (
                            <NumericCell
                              value={c.unitPrice}
                              mode="currency"
                              min={0}
                              onChange={(v) => updateCost(c.id, { unitPrice: v })}
                            />
                          ) : (
                            <NumericCell
                              value={c.variableRatePerUnit}
                              mode="currency"
                              min={0}
                              onChange={(v) =>
                                updateCost(c.id, { variableRatePerUnit: v })
                              }
                            />
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-num bg-slate-50">
                          <span
                            className={`font-semibold ${
                              isOverBudget ? 'text-amber-700' : 'text-slate-900'
                            }`}
                          >
                            {formatVnd(lineTotal)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={c.includeInPnl && !c.isMemoAllocationOnly}
                            onChange={(e) =>
                              updateCost(c.id, {
                                includeInPnl: e.target.checked,
                                isMemoAllocationOnly: !e.target.checked,
                              })
                            }
                            aria-label="Tính vào P&L tổng công ty"
                            className="h-4 w-4 accent-emerald-700"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <StatusSelect
                            value={c.status}
                            onChange={(s) => updateCost(c.id, { status: s })}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateCost(c)}
                              title="Nhân bản"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'opex',
                                  id: c.id,
                                  label: c.name,
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
        </div>
      )}

      {subTab === 'marketing' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Ngân sách Marketing & Truyền thông (3 trụ cột tách biệt)
                </h3>
                <p className="text-xs text-slate-500">
                  Tháng = 0 áp dụng đều cho mỗi tháng trong năm. ROAS không phải lợi nhuận; hiệu quả được đánh giá bằng Lãi đóng góp sau chi phí Marketing (Công thức 40).
                </p>
              </div>
              <button
                type="button"
                onClick={addCampaign}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm chiến dịch
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="px-3 py-2.5 min-w-[180px]">Chiến dịch</th>
                    <th className="px-2 py-2.5">Trụ cột</th>
                    <th className="px-2 py-2.5 text-center">Tháng</th>
                    <th className="px-2 py-2.5 text-right">Quảng cáo</th>
                    <th className="px-2 py-2.5 text-right">Nội dung/Video/TK</th>
                    <th className="px-2 py-2.5 text-right">POSM/Dùng thử</th>
                    <th className="px-2 py-2.5 text-right">KH tiềm năng</th>
                    <th className="px-2 py-2.5 text-right">KH mới</th>
                    <th className="px-2 py-2.5 text-right">Đơn hàng</th>
                    <th className="px-2 py-2.5 text-right">DT quy thuộc</th>
                    <th className="px-2 py-2.5 text-right">CM trước MKT</th>
                    <th className="px-2 py-2.5 text-right bg-slate-100">Tổng CP/kỳ</th>
                    <th className="px-2 py-2.5">Trạng thái</th>
                    <th className="px-3 py-2.5 text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scenario.marketingCampaigns.map((mc) => {
                    const mCost = getCampaignCost(mc);
                    return (
                      <tr key={mc.id} className="hover:bg-slate-50/70">
                        <td className="px-2 py-1.5">
                          <TextCell
                            value={mc.name}
                            onChange={(v) => updateCampaign(mc.id, { name: v })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={mc.pillar}
                            onChange={(e) =>
                              updateCampaign(mc.id, {
                                pillar: e.target.value as MarketingPillar,
                              })
                            }
                            className="max-w-[175px] rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
                          >
                            {(Object.keys(PILLAR_LABELS) as MarketingPillar[]).map(
                              (pl) => (
                                <option key={pl} value={pl}>
                                  {PILLAR_LABELS[pl]}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <select
                            value={mc.month}
                            onChange={(e) =>
                              updateCampaign(mc.id, { month: Number(e.target.value) })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs font-num"
                          >
                            <option value={0}>Hàng tháng</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <option key={m} value={m}>
                                T{m}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1.5 w-24">
                          <NumericCell
                            value={mc.adSpend}
                            mode="currency"
                            min={0}
                            onChange={(v) => updateCampaign(mc.id, { adSpend: v })}
                          />
                        </td>
                        <td className="px-1 py-1.5 w-24">
                          <NumericCell
                            value={mc.contentCost + mc.videoCost + mc.designCost}
                            mode="currency"
                            min={0}
                            onChange={(v) =>
                              updateCampaign(mc.id, {
                                contentCost: v,
                                videoCost: 0,
                                designCost: 0,
                              })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 w-24">
                          <NumericCell
                            value={mc.posmCost + mc.samplingCost + mc.posDevCost}
                            mode="currency"
                            min={0}
                            onChange={(v) =>
                              updateCampaign(mc.id, {
                                posmCost: v,
                                samplingCost: 0,
                                posDevCost: 0,
                              })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 w-20">
                          <NumericCell
                            value={mc.leads}
                            mode="number"
                            min={0}
                            onChange={(v) =>
                              updateCampaign(mc.id, { leads: Math.round(v) })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 w-20">
                          <NumericCell
                            value={mc.newCustomers}
                            mode="number"
                            min={0}
                            onChange={(v) =>
                              updateCampaign(mc.id, { newCustomers: Math.round(v) })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 w-20">
                          <NumericCell
                            value={mc.orders}
                            mode="number"
                            min={0}
                            onChange={(v) =>
                              updateCampaign(mc.id, { orders: Math.round(v) })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 w-28">
                          <NumericCell
                            value={mc.attributedRevenue}
                            mode="currency"
                            min={0}
                            onChange={(v) =>
                              updateCampaign(mc.id, { attributedRevenue: v })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 w-28">
                          <NumericCell
                            value={mc.attributedCmBeforeMkt}
                            mode="currency"
                            min={0}
                            onChange={(v) =>
                              updateCampaign(mc.id, { attributedCmBeforeMkt: v })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-num bg-slate-50 font-semibold text-slate-900">
                          {formatVnd(mCost)}
                        </td>
                        <td className="px-2 py-1.5">
                          <StatusSelect
                            value={mc.status}
                            onChange={(s) => updateCampaign(mc.id, { status: s })}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'mkt',
                                id: mc.id,
                                label: mc.name,
                              })
                            }
                            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Marketing Effectiveness Metrics (Formulas 36-40) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Chỉ số hiệu quả Marketing cả năm (Công thức 36–40)
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 pr-3">Chiến dịch</th>
                    <th className="py-2 px-3">Trụ cột</th>
                    <th className="py-2 px-3 text-right">Chi phí năm</th>
                    <th className="py-2 px-3 text-right">CP/Đơn (F36)</th>
                    <th className="py-2 px-3 text-right">CAC (F37)</th>
                    <th className="py-2 px-3 text-right">Chuyển đổi (F38)</th>
                    <th className="py-2 px-3 text-right">ROAS (F39)</th>
                    <th className="py-2 pl-3 text-right">Hiệu quả đóng góp (F40)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.marketingSummaries.map((ms) => (
                    <tr key={ms.campaignId}>
                      <td className="py-2 pr-3 font-medium text-slate-900">{ms.name}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {PILLAR_LABELS[ms.pillar]}
                      </td>
                      <td className="py-2 px-3 text-right font-num">
                        {formatVnd(ms.totalCost, true)}
                      </td>
                      <td className="py-2 px-3 text-right font-num">
                        {ms.costPerOrder !== null ? formatVnd(ms.costPerOrder) : 'Không xác định'}
                      </td>
                      <td className="py-2 px-3 text-right font-num">
                        {ms.cac !== null ? formatVnd(ms.cac) : 'Không xác định'}
                      </td>
                      <td className="py-2 px-3 text-right font-num">
                        {formatPct(ms.conversionRatePct)}
                      </td>
                      <td className="py-2 px-3 text-right font-num">
                        {ms.roas !== null ? `${formatNumber(ms.roas, 2)}x` : '—'}
                      </td>
                      <td
                        className={`py-2 pl-3 text-right font-num font-semibold ${
                          ms.contributionEffect >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {formatVnd(ms.contributionEffect, true)}
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
        title="Xác nhận xóa dữ liệu"
        description={`Bạn có chắc muốn xóa "${deleteTarget?.label}"?`}
        confirmLabel="Xóa"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
