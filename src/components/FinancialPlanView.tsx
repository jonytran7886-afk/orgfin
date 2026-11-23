import React, { useMemo, useState } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import {
  ComputedMonthlyPnl,
  ComputedScenarioResult,
  ScenarioData,
  ScenarioId,
  SensitivityInput,
} from '../types/finance';
import { computeScenario } from '../engine/calculator';
import { formatNumber, formatPct, formatVnd } from '../utils/format';

interface FinancialPlanViewProps {
  activeScenarioId: ScenarioId;
  scenario: ScenarioData;
  resultsByScenario: Record<ScenarioId, ComputedScenarioResult>;
  onCloneScenarioTo: (targetId: ScenarioId) => void;
}

type PlanSubTab = 'pnl' | 'cashflow' | 'sensitivity' | 'scenarios';
type PnlPeriodMode = 'monthly' | 'quarterly';

const DEFAULT_SENSITIVITY: SensitivityInput = {
  purchasePriceDeltaPct: 0,
  sellPriceDeltaPct: 0,
  recoveryRateDeltaPctPoints: 0,
  volumeDeltaPct: 0,
  commissionDeltaPctPoints: 0,
  marketingDeltaPct: 0,
  hrDeltaPct: 0,
  extraStoresCount: 0,
  capexDeltaPct: 0,
};

function aggregateQuarter(months: ComputedMonthlyPnl[], qIdx: number): ComputedMonthlyPnl {
  const slice = months.slice(qIdx * 3, qIdx * 3 + 3);
  const sum = slice.reduce(
    (acc, m) => ({
      month: qIdx + 1,
      soldVolumeTotal: acc.soldVolumeTotal + m.soldVolumeTotal,
      grossRevenue: acc.grossRevenue + m.grossRevenue,
      revenueDeductions: acc.revenueDeductions + m.revenueDeductions,
      netRevenue: acc.netRevenue + m.netRevenue,
      cogs: acc.cogs + m.cogs,
      grossProfit: acc.grossProfit + m.grossProfit,
      variableSellingCost: acc.variableSellingCost + m.variableSellingCost,
      contributionMargin: acc.contributionMargin + m.contributionMargin,
      fixedSellingCost: acc.fixedSellingCost + m.fixedSellingCost,
      marketingCost: acc.marketingCost + m.marketingCost,
      mediaCost: acc.mediaCost + m.mediaCost,
      adminCost: acc.adminCost + m.adminCost,
      otherFixedOpCost: acc.otherFixedOpCost + m.otherFixedOpCost,
      depreciationCost: acc.depreciationCost + m.depreciationCost,
      totalFixedOperatingCost: acc.totalFixedOperatingCost + m.totalFixedOperatingCost,
      operatingProfit: acc.operatingProfit + m.operatingProfit,
      financialAndOtherNet: acc.financialAndOtherNet + m.financialAndOtherNet,
      profitBeforeTax: acc.profitBeforeTax + m.profitBeforeTax,
      estimatedCit: acc.estimatedCit + m.estimatedCit,
      netProfit: acc.netProfit + m.netProfit,
      netMarginPct: null,
      operatingMarginPct: null,
      profitPerUnit: null,
    }),
    {
      month: qIdx + 1,
      soldVolumeTotal: 0,
      grossRevenue: 0,
      revenueDeductions: 0,
      netRevenue: 0,
      cogs: 0,
      grossProfit: 0,
      variableSellingCost: 0,
      contributionMargin: 0,
      fixedSellingCost: 0,
      marketingCost: 0,
      mediaCost: 0,
      adminCost: 0,
      otherFixedOpCost: 0,
      depreciationCost: 0,
      totalFixedOperatingCost: 0,
      operatingProfit: 0,
      financialAndOtherNet: 0,
      profitBeforeTax: 0,
      estimatedCit: 0,
      netProfit: 0,
      netMarginPct: null,
      operatingMarginPct: null,
      profitPerUnit: null,
    }
  );
  sum.netMarginPct = sum.netRevenue > 0 ? (sum.netProfit / sum.netRevenue) * 100 : null;
  sum.operatingMarginPct =
    sum.netRevenue > 0 ? (sum.operatingProfit / sum.netRevenue) * 100 : null;
  sum.profitPerUnit = sum.soldVolumeTotal > 0 ? sum.netProfit / sum.soldVolumeTotal : null;
  return sum;
}

export const FinancialPlanView: React.FC<FinancialPlanViewProps> = ({
  activeScenarioId,
  scenario,
  resultsByScenario,
  onCloneScenarioTo,
}) => {
  const [subTab, setSubTab] = useState<PlanSubTab>('pnl');
  const [pnlMode, setPnlMode] = useState<PnlPeriodMode>('monthly');
  const [sensitivity, setSensitivity] = useState<SensitivityInput>(DEFAULT_SENSITIVITY);
  const [cloneMessage, setCloneMessage] = useState<string>('');

  const result = resultsByScenario[activeScenarioId];

  const simResult = useMemo(
    () => computeScenario(scenario, sensitivity),
    [scenario, sensitivity]
  );

  const pnlColumns = useMemo(() => {
    if (pnlMode === 'quarterly') {
      return [0, 1, 2, 3].map((q) => ({
        label: `Quý ${q + 1}`,
        data: aggregateQuarter(result.monthlyPnl, q),
      }));
    }
    return result.monthlyPnl.map((m) => ({
      label: `T${m.month}`,
      data: m,
    }));
  }, [pnlMode, result.monthlyPnl]);

  const pnlRows: {
    key: keyof ComputedMonthlyPnl;
    label: string;
    bold?: boolean;
    highlight?: boolean;
    isPct?: boolean;
    isCurrency?: boolean;
  }[] = [
    { key: 'grossRevenue', label: '1. Doanh thu gộp', isCurrency: true },
    { key: 'revenueDeductions', label: '2. Giảm trừ doanh thu (CK, giảm giá, trả hàng)', isCurrency: true },
    { key: 'netRevenue', label: '3. Doanh thu thuần', bold: true, isCurrency: true },
    { key: 'cogs', label: '4. Giá vốn hàng bán (COGS)', isCurrency: true },
    { key: 'grossProfit', label: '5. Lợi nhuận gộp', bold: true, isCurrency: true },
    { key: 'variableSellingCost', label: '6. Chi phí bán hàng biến đổi (CTV, giao hàng, phí TT...)', isCurrency: true },
    { key: 'contributionMargin', label: '7. Lãi đóng góp (CM)', bold: true, highlight: true, isCurrency: true },
    { key: 'fixedSellingCost', label: '8. Chi phí bán hàng cố định', isCurrency: true },
    { key: 'marketingCost', label: '9. Chi phí Marketing (Chuyển đổi & Điểm bán)', isCurrency: true },
    { key: 'mediaCost', label: '10. Chi phí Truyền thông & Thương hiệu', isCurrency: true },
    { key: 'adminCost', label: '11. Chi phí quản lý doanh nghiệp', isCurrency: true },
    { key: 'otherFixedOpCost', label: '12. Chi phí vận hành cố định khác (CH, kho, xe...)', isCurrency: true },
    { key: 'depreciationCost', label: '13. Khấu hao / phân bổ tài sản', isCurrency: true },
    { key: 'operatingProfit', label: '14. Lợi nhuận hoạt động (EBIT)', bold: true, highlight: true, isCurrency: true },
    { key: 'financialAndOtherNet', label: '15. Thu nhập / Chi phí tài chính & ngoài HĐ', isCurrency: true },
    { key: 'profitBeforeTax', label: '16. Lợi nhuận trước thuế (EBT)', bold: true, isCurrency: true },
    { key: 'estimatedCit', label: '17. Thuế thu nhập doanh nghiệp dự kiến', isCurrency: true },
    { key: 'netProfit', label: '18. Lợi nhuận sau thuế', bold: true, highlight: true, isCurrency: true },
    { key: 'netMarginPct', label: 'Biên lợi nhuận ròng (%)', isPct: true },
    { key: 'profitPerUnit', label: 'Lợi nhuận ròng sau phân bổ / đơn vị bán', isCurrency: true },
  ];

  const cons = resultsByScenario.conservative;
  const base = resultsByScenario.base;
  const grow = resultsByScenario.growth;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Kế hoạch tài chính – P&L, Dòng tiền, Hòa vốn & Kịch bản
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Báo cáo kết quả kinh doanh 18 dòng (Mục X), Dòng tiền tách biệt (Mục XII), Điểm hòa vốn & Phân tích độ nhạy (Mục XI) và So sánh 3 kịch bản (Mục XIV).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {[
            { id: 'pnl', label: 'Báo cáo P&L' },
            { id: 'cashflow', label: 'Dòng tiền (Cash Flow)' },
            { id: 'sensitivity', label: 'Hòa vốn & Độ nhạy' },
            { id: 'scenarios', label: 'So sánh 3 kịch bản' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as PlanSubTab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                subTab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: P&L */}
      {subTab === 'pnl' && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Báo cáo Lợi nhuận (P&L) – {scenario.name}
            </h3>
            <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPnlMode('monthly')}
                className={`rounded px-2.5 py-1 font-medium whitespace-nowrap ${
                  pnlMode === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                12 Tháng
              </button>
              <button
                type="button"
                onClick={() => setPnlMode('quarterly')}
                className={`rounded px-2.5 py-1 font-medium whitespace-nowrap ${
                  pnlMode === 'quarterly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Theo Quý
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 min-w-[270px]">
                    Chỉ tiêu P&L (Đơn vị: VNĐ)
                  </th>
                  {pnlColumns.map((col) => (
                    <th key={col.label} className="px-2.5 py-2.5 text-right">
                      {col.label}
                    </th>
                  ))}
                  <th className="bg-slate-100 px-3 py-2.5 text-right font-bold text-slate-900">
                    Cả năm
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pnlRows.map((row) => (
                  <tr
                    key={row.key}
                    className={row.highlight ? 'bg-slate-50/90' : 'hover:bg-slate-50/50'}
                  >
                    <td
                      className={`sticky left-0 z-10 px-4 py-2 ${
                        row.highlight ? 'bg-slate-50' : 'bg-white'
                      } ${row.bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                    >
                      {row.label}
                    </td>
                    {pnlColumns.map((col) => {
                      const val = col.data[row.key] as number | null;
                      const isNeg = val !== null && val < 0;
                      return (
                        <td
                          key={col.label}
                          className={`px-2.5 py-2 text-right font-num ${
                            row.bold ? 'font-semibold' : ''
                          } ${isNeg ? 'text-red-700' : 'text-slate-900'}`}
                        >
                          {row.isPct
                            ? formatPct(val, 1)
                            : formatVnd(val, pnlMode === 'monthly')}
                        </td>
                      );
                    })}
                    <td
                      className={`bg-slate-100/80 px-3 py-2 text-right font-num font-semibold ${
                        ((result.annualPnl[row.key] as number | null) ?? 0) < 0
                          ? 'text-red-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {row.isPct
                        ? formatPct(result.annualPnl[row.key] as number | null, 1)
                        : formatVnd(result.annualPnl[row.key] as number | null, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CASH FLOW */}
      {subTab === 'cashflow' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Tiền đầu kỳ (T1)</div>
              <div className="mt-1 font-num text-lg font-semibold text-slate-900">
                {formatVnd(result.annualCashFlow.openingCash, true)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Dòng tiền hoạt động năm</div>
              <div
                className={`mt-1 font-num text-lg font-semibold ${
                  result.annualCashFlow.operatingCashFlow >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              >
                {formatVnd(result.annualCashFlow.operatingCashFlow, true)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Tiền cuối kỳ (T12)</div>
              <div
                className={`mt-1 font-num text-lg font-semibold ${
                  result.annualCashFlow.endingCash >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              >
                {formatVnd(result.annualCashFlow.endingCash, true)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Nhu cầu vốn bổ sung tối thiểu (F57)</div>
              <div
                className={`mt-1 font-num text-lg font-semibold ${
                  result.annualCashFlow.additionalCapitalNeeded > 0
                    ? 'text-red-700'
                    : 'text-emerald-700'
                }`}
              >
                {result.annualCashFlow.additionalCapitalNeeded > 0
                  ? formatVnd(result.annualCashFlow.additionalCapitalNeeded, true)
                  : '0 đ (Đủ vốn)'}
              </div>
              <div className="mt-0.5 font-num text-[11px] text-slate-500">
                Kèm dự trữ tối thiểu:{' '}
                {formatVnd(result.annualCashFlow.additionalCapitalWithReserve, true)}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 min-w-[250px]">
                    Chỉ tiêu Dòng tiền (Công thức 51–56)
                  </th>
                  {result.monthlyCashFlow.map((cf) => (
                    <th key={cf.month} className="px-2.5 py-2.5 text-right">
                      T{cf.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { key: 'openingCash', label: 'Tiền đầu kỳ', bold: true },
                  { key: 'customerReceipts', label: '(+) Thu tiền khách hàng (F51)' },
                  { key: 'supplierPayments', label: '(-) Thanh toán nhà cung cấp (F52)', neg: true },
                  { key: 'hrCashOut', label: '(-) Chi lương & nhân sự', neg: true },
                  { key: 'marketingMediaCashOut', label: '(-) Chi Marketing & Truyền thông', neg: true },
                  { key: 'adminStoreOtherCashOut', label: '(-) Chi quản lý, điểm bán & biến đổi', neg: true },
                  { key: 'taxCashOut', label: '(-) Chi thuế TNDN', neg: true },
                  { key: 'operatingCashFlow', label: 'Dòng tiền hoạt động (F53)', bold: true, highlight: true },
                  { key: 'assetDisposalInflow', label: '(+) Thu thanh lý tài sản' },
                  { key: 'capexCashOut', label: '(-) Chi đầu tư mua sắm tài sản (CapEx)', neg: true },
                  { key: 'investingCashFlow', label: 'Dòng tiền đầu tư (F54)', bold: true, highlight: true },
                  { key: 'equityInjection', label: '(+) Vốn góp nhận được' },
                  { key: 'loanDrawdown', label: '(+) Tiền vay nhận được' },
                  { key: 'loanPrincipalRepayment', label: '(-) Trả gốc vay', neg: true },
                  { key: 'loanInterestOut', label: '(-) Trả lãi vay', neg: true },
                  { key: 'dividendOutflow', label: '(-) Phân phối lợi nhuận / cổ tức', neg: true },
                  { key: 'financingCashFlow', label: 'Dòng tiền tài chính (F55)', bold: true, highlight: true },
                  { key: 'endingCash', label: 'Tiền cuối kỳ (F56)', bold: true, highlight: true },
                ].map((row) => (
                  <tr
                    key={row.key}
                    className={row.highlight ? 'bg-slate-50/90' : 'hover:bg-slate-50/50'}
                  >
                    <td
                      className={`sticky left-0 z-10 px-4 py-2 ${
                        row.highlight ? 'bg-slate-50' : 'bg-white'
                      } ${row.bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                    >
                      {row.label}
                    </td>
                    {result.monthlyCashFlow.map((cf) => {
                      const raw = cf[row.key as keyof typeof cf] as number;
                      const displayVal = row.neg && raw > 0 ? -raw : raw;
                      const isCriticalNeg =
                        row.key === 'endingCash' && displayVal < 0;
                      return (
                        <td
                          key={cf.month}
                          className={`px-2.5 py-2 text-right font-num ${
                            row.bold ? 'font-semibold' : ''
                          } ${
                            isCriticalNeg
                              ? 'bg-red-50 font-bold text-red-700'
                              : displayVal < 0
                              ? 'text-red-700'
                              : 'text-slate-900'
                          }`}
                        >
                          {formatVnd(displayVal, true)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BREAK-EVEN & SENSITIVITY */}
      {subTab === 'sensitivity' && (
        <div className="space-y-6">
          {/* Break-even Summary (F47-F50) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Lãi đóng góp BQ gia quyền (F48)</div>
              <div className="mt-1 font-num text-lg font-semibold text-slate-900">
                {result.breakEven.weightedAvgCmPerUnit !== null
                  ? `${formatVnd(result.breakEven.weightedAvgCmPerUnit)}/đv`
                  : 'Không xác định'}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Chi phí cố định BQ/tháng</div>
              <div className="mt-1 font-num text-lg font-semibold text-slate-900">
                {formatVnd(result.breakEven.monthlyAvgFixedCosts, true)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Sản lượng hòa vốn tháng (F49)</div>
              <div className="mt-1 font-num text-lg font-semibold text-emerald-700">
                {result.breakEven.breakEvenUnitsMonthly !== null
                  ? `${formatNumber(Math.round(result.breakEven.breakEvenUnitsMonthly))} đv/tháng`
                  : 'Không xác định'}
              </div>
              <div className="mt-0.5 font-num text-[11px] text-slate-500">
                DT hòa vốn năm:{' '}
                {formatVnd(result.breakEven.breakEvenRevenueAnnual, true)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Biên an toàn sản lượng (F50)</div>
              <div
                className={`mt-1 font-num text-lg font-semibold ${
                  (result.breakEven.marginOfSafetyPct ?? -1) >= 0
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              >
                {formatPct(result.breakEven.marginOfSafetyPct, 1)}
              </div>
            </div>
          </div>

          {/* Multi-Parameter Sensitivity Simulator */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Mô phỏng độ nhạy đa thông số (Mục 11.4)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Thay đổi đồng thời các biến số mà không làm hỏng dữ liệu kế hoạch gốc.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSensitivity(DEFAULT_SENSITIVITY)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Đặt lại 0%
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  {
                    key: 'purchasePriceDeltaPct',
                    label: 'Biến động giá mua đầu vào (%)',
                    min: -30,
                    max: 40,
                    step: 1,
                    unit: '%',
                  },
                  {
                    key: 'sellPriceDeltaPct',
                    label: 'Biến động giá bán (%)',
                    min: -30,
                    max: 40,
                    step: 1,
                    unit: '%',
                  },
                  {
                    key: 'recoveryRateDeltaPctPoints',
                    label: 'Thay đổi tỷ lệ thu hồi (điểm %)',
                    min: -10,
                    max: 10,
                    step: 0.5,
                    unit: ' đ%',
                  },
                  {
                    key: 'volumeDeltaPct',
                    label: 'Biến động sản lượng tiêu thụ (%)',
                    min: -50,
                    max: 100,
                    step: 2,
                    unit: '%',
                  },
                  {
                    key: 'commissionDeltaPctPoints',
                    label: 'Thay đổi hoa hồng CTV (điểm %)',
                    min: -10,
                    max: 20,
                    step: 1,
                    unit: ' đ%',
                  },
                  {
                    key: 'marketingDeltaPct',
                    label: 'Biến động ngân sách Marketing (%)',
                    min: -50,
                    max: 100,
                    step: 5,
                    unit: '%',
                  },
                  {
                    key: 'hrDeltaPct',
                    label: 'Biến động chi phí nhân sự (%)',
                    min: -30,
                    max: 50,
                    step: 2,
                    unit: '%',
                  },
                  {
                    key: 'extraStoresCount',
                    label: 'Thay đổi số cửa hàng (+/-)',
                    min: -2,
                    max: 5,
                    step: 1,
                    unit: ' CH',
                  },
                  {
                    key: 'capexDeltaPct',
                    label: 'Biến động chi phí đầu tư CapEx (%)',
                    min: -40,
                    max: 80,
                    step: 5,
                    unit: '%',
                  },
                ].map((sl) => {
                  const val = sensitivity[sl.key as keyof SensitivityInput];
                  return (
                    <div key={sl.key} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-700">{sl.label}</span>
                        <span className="font-num font-semibold text-emerald-700">
                          {val > 0 ? `+${val}` : val}
                          {sl.unit}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={sl.min}
                        max={sl.max}
                        step={sl.step}
                        value={val}
                        onChange={(e) =>
                          setSensitivity((prev) => ({
                            ...prev,
                            [sl.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-emerald-700"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Kết quả mô phỏng so với kế hoạch gốc ({scenario.name})
              </h3>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                      <th className="py-2 pr-3">Chỉ tiêu cả năm</th>
                      <th className="py-2 px-3 text-right">Kế hoạch gốc</th>
                      <th className="py-2 px-3 text-right">Sau mô phỏng</th>
                      <th className="py-2 pl-3 text-right">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      {
                        label: 'Doanh thu thuần',
                        base: result.annualPnl.netRevenue,
                        sim: simResult.annualPnl.netRevenue,
                      },
                      {
                        label: 'Giá vốn hàng bán (COGS)',
                        base: result.annualPnl.cogs,
                        sim: simResult.annualPnl.cogs,
                      },
                      {
                        label: 'Lãi đóng góp (CM)',
                        base: result.annualPnl.contributionMargin,
                        sim: simResult.annualPnl.contributionMargin,
                      },
                      {
                        label: 'Tổng chi phí cố định',
                        base: result.annualPnl.totalFixedOperatingCost,
                        sim: simResult.annualPnl.totalFixedOperatingCost,
                      },
                      {
                        label: 'Lợi nhuận hoạt động (EBIT)',
                        base: result.annualPnl.operatingProfit,
                        sim: simResult.annualPnl.operatingProfit,
                      },
                      {
                        label: 'Lợi nhuận sau thuế',
                        base: result.annualPnl.netProfit,
                        sim: simResult.annualPnl.netProfit,
                      },
                      {
                        label: 'Điểm hòa vốn tháng (đơn vị)',
                        base: result.breakEven.breakEvenUnitsMonthly ?? 0,
                        sim: simResult.breakEven.breakEvenUnitsMonthly ?? 0,
                        isUnit: true,
                      },
                      {
                        label: 'Tiền cuối kỳ Tháng 12',
                        base: result.annualCashFlow.endingCash,
                        sim: simResult.annualCashFlow.endingCash,
                      },
                      {
                        label: 'Vốn bổ sung tối thiểu',
                        base: result.annualCashFlow.additionalCapitalNeeded,
                        sim: simResult.annualCashFlow.additionalCapitalNeeded,
                      },
                    ].map((row) => {
                      const diff = row.sim - row.base;
                      const fmt = (v: number) =>
                        row.isUnit
                          ? `${formatNumber(Math.round(v))} đv`
                          : formatVnd(v, true);
                      return (
                        <tr key={row.label}>
                          <td className="py-2.5 pr-3 font-medium text-slate-900">
                            {row.label}
                          </td>
                          <td className="py-2.5 px-3 text-right font-num text-slate-600">
                            {fmt(row.base)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-num font-semibold text-slate-900">
                            {fmt(row.sim)}
                          </td>
                          <td
                            className={`py-2.5 pl-3 text-right font-num font-semibold ${
                              diff > 0
                                ? 'text-emerald-700'
                                : diff < 0
                                ? 'text-red-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: 3 SCENARIOS COMPARISON */}
      {subTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-600">
              <strong className="text-slate-900">Nhân bản kịch bản hiện tại ({scenario.name}):</strong>{' '}
              Sao chép toàn bộ thông số đầu vào từ kịch bản đang mở sang kịch bản khác để tinh chỉnh nhanh.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['conservative', 'base', 'growth'] as ScenarioId[])
                .filter((id) => id !== activeScenarioId)
                .map((targetId) => (
                  <button
                    key={targetId}
                    type="button"
                    onClick={() => {
                      onCloneScenarioTo(targetId);
                      setCloneMessage(
                        `Đã nhân bản dữ liệu sang ${
                          targetId === 'conservative'
                            ? 'Thận trọng'
                            : targetId === 'base'
                            ? 'Cơ sở'
                            : 'Tăng trưởng'
                        }.`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Chép sang{' '}
                    {targetId === 'conservative'
                      ? 'Thận trọng'
                      : targetId === 'base'
                      ? 'Cơ sở'
                      : 'Tăng trưởng'}
                  </button>
                ))}
            </div>
          </div>

          {cloneMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800">
              {cloneMessage}
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="px-4 py-3">Chỉ tiêu tài chính cả năm (Tự tính từ dữ liệu đầu vào)</th>
                  <th className="px-4 py-3 text-right">Thận trọng</th>
                  <th className="px-4 py-3 text-right">Cơ sở</th>
                  <th className="px-4 py-3 text-right">Tăng trưởng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    label: 'Doanh thu thuần',
                    vals: [cons.annualPnl.netRevenue, base.annualPnl.netRevenue, grow.annualPnl.netRevenue],
                    fmt: (v: number) => formatVnd(v),
                  },
                  {
                    label: 'Giá vốn hàng bán (COGS)',
                    vals: [cons.annualPnl.cogs, base.annualPnl.cogs, grow.annualPnl.cogs],
                    fmt: (v: number) => formatVnd(v),
                  },
                  {
                    label: 'Lãi đóng góp (CM)',
                    vals: [
                      cons.annualPnl.contributionMargin,
                      base.annualPnl.contributionMargin,
                      grow.annualPnl.contributionMargin,
                    ],
                    fmt: (v: number) => formatVnd(v),
                    bold: true,
                  },
                  {
                    label: 'Chi phí cố định cả năm',
                    vals: [
                      cons.annualPnl.totalFixedOperatingCost,
                      base.annualPnl.totalFixedOperatingCost,
                      grow.annualPnl.totalFixedOperatingCost,
                    ],
                    fmt: (v: number) => formatVnd(v),
                  },
                  {
                    label: 'Lợi nhuận hoạt động (EBIT)',
                    vals: [
                      cons.annualPnl.operatingProfit,
                      base.annualPnl.operatingProfit,
                      grow.annualPnl.operatingProfit,
                    ],
                    fmt: (v: number) => formatVnd(v),
                    bold: true,
                  },
                  {
                    label: 'Lợi nhuận sau thuế',
                    vals: [cons.annualPnl.netProfit, base.annualPnl.netProfit, grow.annualPnl.netProfit],
                    fmt: (v: number) => formatVnd(v),
                    bold: true,
                  },
                  {
                    label: 'Điểm hòa vốn (Đơn vị / tháng)',
                    vals: [
                      cons.breakEven.breakEvenUnitsMonthly ?? 0,
                      base.breakEven.breakEvenUnitsMonthly ?? 0,
                      grow.breakEven.breakEvenUnitsMonthly ?? 0,
                    ],
                    fmt: (v: number) => (v > 0 ? `${formatNumber(Math.round(v))} đv` : 'Không xác định'),
                  },
                  {
                    label: 'Tổng vốn đầu tư (CapEx)',
                    vals: [cons.totalCapex, base.totalCapex, grow.totalCapex],
                    fmt: (v: number) => formatVnd(v),
                  },
                  {
                    label: 'Tiền cuối kỳ Tháng 12',
                    vals: [
                      cons.annualCashFlow.endingCash,
                      base.annualCashFlow.endingCash,
                      grow.annualCashFlow.endingCash,
                    ],
                    fmt: (v: number) => formatVnd(v),
                    bold: true,
                  },
                  {
                    label: 'Vốn cần bổ sung tối thiểu',
                    vals: [
                      cons.annualCashFlow.additionalCapitalNeeded,
                      base.annualCashFlow.additionalCapitalNeeded,
                      grow.annualCashFlow.additionalCapitalNeeded,
                    ],
                    fmt: (v: number) => formatVnd(v),
                  },
                ].map((row) => (
                  <tr key={row.label} className={row.bold ? 'bg-slate-50/70' : ''}>
                    <td
                      className={`px-4 py-2.5 ${
                        row.bold ? 'font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {row.label}
                    </td>
                    {row.vals.map((v, idx) => (
                      <td
                        key={idx}
                        className={`px-4 py-2.5 text-right font-num ${
                          row.bold ? 'font-semibold' : ''
                        } ${v < 0 ? 'text-red-700' : 'text-slate-900'}`}
                      >
                        {row.fmt(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
