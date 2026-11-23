import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ComputedScenarioResult,
  ScenarioData,
} from '../types/finance';
import { formatNumber, formatPct, formatVnd } from '../utils/format';
import {
  ChannelContributionChart,
  CostStructureChart,
  MonthlyRevenueCostProfitChart,
} from './Charts';
import { NumericCell } from './EditableCell';

interface DashboardViewProps {
  scenario: ScenarioData;
  result: ComputedScenarioResult;
  onUpdateScenario: (updater: (prev: ScenarioData) => ScenarioData) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  scenario,
  result,
  onUpdateScenario,
  onNavigateTab,
}) => {
  const { annualPnl, annualCashFlow, breakEven, dataGovernance, warnings } = result;

  // Locate primary quick-edit targets in current scenario
  const chickenProd = scenario.products.find((p) => p.group === 'Gà') ?? scenario.products[0];
  const ctvPlan =
    scenario.channelPlans.find((c) => c.channelId === 'ctv') ??
    scenario.channelPlans[0];
  const mktConv =
    scenario.marketingCampaigns.find((m) => m.pillar === 'conversion') ??
    scenario.marketingCampaigns[0];
  const storeAsset =
    scenario.assets.find((a) => a.category === 'Xây dựng cửa hàng' && a.locationId === 'LOC-CH2') ??
    scenario.assets.find((a) => a.category === 'Xây dựng cửa hàng') ??
    scenario.assets[0];
  const fixedCostSample = scenario.operatingCosts.find((o) => o.frequency === 'monthly') ?? scenario.operatingCosts[0];

  const activeStoresCount = scenario.locations.filter(
    (l) => l.type === 'store' && l.isActive
  ).length;

  const avgChickenSellPrice = chickenProd ? chickenProd.targetSellPrice : 0;
  const avgCtvMonthlyVol = ctvPlan
    ? ctvPlan.monthlyVolumes.reduce((s, v) => s + v, 0) / 12
    : 0;

  const kpiCards = [
    {
      label: 'Doanh thu thuần (Cả năm)',
      value: formatVnd(annualPnl.netRevenue, true),
      sub: `Gộp: ${formatVnd(annualPnl.grossRevenue, true)}`,
      tone: 'text-slate-900',
    },
    {
      label: 'Giá vốn hàng bán (COGS)',
      value: formatVnd(annualPnl.cogs, true),
      sub:
        annualPnl.netRevenue > 0
          ? `${formatPct((annualPnl.cogs / annualPnl.netRevenue) * 100)} doanh thu thuần`
          : 'Chưa có doanh thu',
      tone: 'text-slate-900',
    },
    {
      label: 'Lãi đóng góp (CM)',
      value: formatVnd(annualPnl.contributionMargin, true),
      sub: `Biên CM: ${formatPct(
        annualPnl.netRevenue > 0
          ? (annualPnl.contributionMargin / annualPnl.netRevenue) * 100
          : null
      )}`,
      tone: annualPnl.contributionMargin > 0 ? 'text-emerald-700' : 'text-red-700',
    },
    {
      label: 'Lợi nhuận hoạt động (EBIT)',
      value: formatVnd(annualPnl.operatingProfit, true),
      sub: `Sau thuế: ${formatVnd(annualPnl.netProfit, true)}`,
      tone: annualPnl.operatingProfit >= 0 ? 'text-emerald-700' : 'text-red-700',
    },
    {
      label: 'Biên lợi nhuận hoạt động',
      value: formatPct(annualPnl.operatingMarginPct),
      sub: `Biên ròng: ${formatPct(annualPnl.netMarginPct)}`,
      tone:
        (annualPnl.operatingMarginPct ?? 0) >= 0
          ? 'text-slate-900'
          : 'text-red-700',
    },
    {
      label: 'Tổng vốn đầu tư (CapEx)',
      value: formatVnd(result.totalCapex, true),
      sub: `${scenario.assets.length} hạng mục tài sản`,
      tone: 'text-slate-900',
    },
    {
      label: 'Điểm hòa vốn bình quân',
      value:
        breakEven.breakEvenUnitsMonthly !== null
          ? `${formatNumber(Math.round(breakEven.breakEvenUnitsMonthly))} đv/tháng`
          : 'Không xác định',
      sub:
        breakEven.marginOfSafetyPct !== null
          ? `Biên an toàn: ${formatPct(breakEven.marginOfSafetyPct)}`
          : 'CM bình quân ≤ 0',
      tone:
        breakEven.marginOfSafetyPct !== null && breakEven.marginOfSafetyPct >= 0
          ? 'text-slate-900'
          : 'text-amber-700',
    },
    {
      label: 'Tiền cuối kỳ (Tháng 12)',
      value: formatVnd(annualCashFlow.endingCash, true),
      sub:
        annualCashFlow.additionalCapitalNeeded > 0
          ? `Thiếu vốn: ${formatVnd(annualCashFlow.additionalCapitalNeeded, true)} (T${annualCashFlow.lowestCashMonth})`
          : `Đáy tiền: ${formatVnd(annualCashFlow.lowestEndingCash, true)} (T${annualCashFlow.lowestCashMonth ?? 1})`,
      tone:
        annualCashFlow.endingCash >= 0 && annualCashFlow.additionalCapitalNeeded === 0
          ? 'text-emerald-700'
          : 'text-red-700',
    },
  ];

  const negativeCashMonths = result.monthlyCashFlow
    .filter((c) => c.endingCash < 0)
    .map((c) => `T${c.month}`);

  return (
    <div className="space-y-6">
      {/* Executive Answer Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Tổng quan điều hành – {scenario.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{scenario.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            {dataGovernance.unconfirmedCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            )}
            <span>
              Thông số chưa xác nhận:{' '}
              <strong
                className={`font-num ${
                  dataGovernance.unconfirmedCount > 0
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {dataGovernance.unconfirmedCount}/{dataGovernance.totalTrackedItems}
              </strong>
            </span>
          </div>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            Tháng thiếu tiền:{' '}
            <strong
              className={`font-num ${
                negativeCashMonths.length > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {negativeCashMonths.length > 0 ? negativeCashMonths.join(', ') : 'Không có'}
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            Cửa hàng hoạt động:{' '}
            <strong className="font-num text-slate-900">{activeStoresCount}</strong>
          </span>
        </div>
      </div>

      {/* 8 Priority KPI Cards (Section 13.1) */}
      <section aria-label="8 chỉ tiêu tài chính ưu tiên">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="text-xs font-medium text-slate-500">{card.label}</div>
              <div className={`mt-1.5 font-num text-2xl font-semibold ${card.tone}`}>
                {card.value}
              </div>
              <div className="mt-1 font-num text-xs text-slate-500">{card.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Layout: 3 Charts + Quick Edit & Warnings */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left 8 cols: 3 Charts (Section 13.2) */}
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Doanh thu, chi phí và lợi nhuận 12 tháng
                </h3>
                <p className="text-xs text-slate-500">
                  Doanh thu thuần so với tổng giá vốn + chi phí hoạt động và lợi nhuận EBIT
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('financial')}
                className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap shrink-0"
              >
                Xem chi tiết P&L
              </button>
            </div>
            <MonthlyRevenueCostProfitChart monthlyPnl={result.monthlyPnl} />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Cơ cấu chi phí cả năm
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('costs')}
                  className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap shrink-0"
                >
                  Chi tiết
                </button>
              </div>
              <CostStructureChart items={result.costStructure} />
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Lãi đóng góp theo kênh bán
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('products')}
                  className="text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap shrink-0"
                >
                  Chi tiết kênh
                </button>
              </div>
              <ChannelContributionChart channels={result.channelSummaries} />
            </div>
          </div>
        </div>

        {/* Right 4 cols: Quick Edit (13.3) & Warnings (13.4) */}
        <div className="space-y-6 xl:col-span-4">
          {/* Quick Edit Panel */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Chỉnh sửa nhanh (Quick Edit)
                </h3>
              </div>
              <span className="text-xs text-slate-500">Cập nhật tức thì</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {chickenProd && (
                <>
                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">Giá mua gà (đ/kg sống)</span>
                    <div className="w-32">
                      <NumericCell
                        value={chickenProd.purchasePricePerLiveKg}
                        mode="currency"
                        min={0}
                        onChange={(val) =>
                          onUpdateScenario((prev) => ({
                            ...prev,
                            products: prev.products.map((p) =>
                              p.id === chickenProd.id
                                ? { ...p, purchasePricePerLiveKg: val }
                                : p
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">Giá bán gà TP (đ/kg)</span>
                    <div className="w-32">
                      <NumericCell
                        value={avgChickenSellPrice}
                        mode="currency"
                        min={0}
                        onChange={(val) =>
                          onUpdateScenario((prev) => ({
                            ...prev,
                            products: prev.products.map((p) =>
                              p.id === chickenProd.id
                                ? { ...p, targetSellPrice: val }
                                : p
                            ),
                            channelPlans: prev.channelPlans.map((cp) =>
                              cp.productId === chickenProd.id && !cp.isInternalTransfer
                                ? { ...cp, sellPrice: val }
                                : cp
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">Trọng lượng sống/con (kg)</span>
                    <div className="w-28">
                      <NumericCell
                        value={chickenProd.avgLiveWeightKg}
                        mode="decimal"
                        decimals={2}
                        min={0.1}
                        onChange={(val) =>
                          onUpdateScenario((prev) => ({
                            ...prev,
                            products: prev.products.map((p) =>
                              p.id === chickenProd.id
                                ? { ...p, avgLiveWeightKg: val }
                                : p
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">Tỷ lệ thu hồi gà (%)</span>
                    <div className="w-28">
                      <NumericCell
                        value={chickenProd.recoveryRate}
                        mode="percent"
                        decimals={1}
                        min={0.1}
                        max={1}
                        onChange={(val) =>
                          onUpdateScenario((prev) => ({
                            ...prev,
                            products: prev.products.map((p) =>
                              p.id === chickenProd.id ? { ...p, recoveryRate: val } : p
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {ctvPlan && (
                <>
                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">Sản lượng CTV TB/tháng</span>
                    <div className="w-28">
                      <NumericCell
                        value={avgCtvMonthlyVol}
                        mode="number"
                        min={0}
                        onChange={(val) =>
                          onUpdateScenario((prev) => ({
                            ...prev,
                            channelPlans: prev.channelPlans.map((cp) =>
                              cp.id === ctvPlan.id
                                ? {
                                    ...cp,
                                    monthlyVolumes: new Array(12).fill(Math.round(val)),
                                  }
                                : cp
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-700">Hoa hồng CTV (đ/đơn vị)</span>
                    <div className="w-32">
                      <NumericCell
                        value={
                          ctvPlan.commissionMethod === 'fixed_per_unit'
                            ? ctvPlan.commissionValue
                            : 0
                        }
                        mode="currency"
                        min={0}
                        onChange={(val) =>
                          onUpdateScenario((prev) => ({
                            ...prev,
                            channelPlans: prev.channelPlans.map((cp) =>
                              cp.id === ctvPlan.id
                                ? {
                                    ...cp,
                                    commissionMethod: 'fixed_per_unit',
                                    commissionValue: val,
                                  }
                                : cp
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                </>
              )}

              {mktConv && (
                <div className="flex items-center justify-between gap-2 py-2">
                  <span className="text-slate-700">Quảng cáo chuyển đổi/tháng</span>
                  <div className="w-32">
                    <NumericCell
                      value={mktConv.adSpend}
                      mode="currency"
                      min={0}
                      onChange={(val) =>
                        onUpdateScenario((prev) => ({
                          ...prev,
                          marketingCampaigns: prev.marketingCampaigns.map((mc) =>
                            mc.id === mktConv.id ? { ...mc, adSpend: val } : mc
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              {fixedCostSample && (
                <div className="flex items-center justify-between gap-2 py-2">
                  <span className="text-slate-700">Thuê xe tải lạnh/tháng</span>
                  <div className="w-32">
                    <NumericCell
                      value={fixedCostSample.unitPrice}
                      mode="currency"
                      min={0}
                      onChange={(val) =>
                        onUpdateScenario((prev) => ({
                          ...prev,
                          operatingCosts: prev.operatingCosts.map((oc) =>
                            oc.id === fixedCostSample.id
                              ? { ...oc, unitPrice: val }
                              : oc
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 py-2">
                <span className="text-slate-700">Số cửa hàng hoạt động</span>
                <div className="flex items-center gap-1">
                  {scenario.locations
                    .filter((l) => l.type === 'store')
                    .map((store, idx) => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() =>
                          onUpdateScenario((prev) => ({
                            ...prev,
                            locations: prev.locations.map((l) =>
                              l.id === store.id ? { ...l, isActive: !l.isActive } : l
                            ),
                          }))
                        }
                        className={`rounded border px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          store.isActive
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        CH {idx + 1}
                      </button>
                    ))}
                </div>
              </div>

              {storeAsset && (
                <div className="flex items-center justify-between gap-2 py-2">
                  <span className="text-slate-700">Đầu tư {storeAsset.name.slice(0, 22)}</span>
                  <div className="w-32">
                    <NumericCell
                      value={storeAsset.unitPrice}
                      mode="currency"
                      min={0}
                      onChange={(val) =>
                        onUpdateScenario((prev) => ({
                          ...prev,
                          assets: prev.assets.map((a) =>
                            a.id === storeAsset.id ? { ...a, unitPrice: val } : a
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Alerts & Data Governance Panel (Section 13.4) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Cảnh báo & Kiểm soát dữ liệu
              </h3>
              <span className="font-num text-xs font-medium text-slate-500">
                {warnings.length} mục
              </span>
            </div>

            {warnings.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Không phát hiện cảnh báo tài chính hoặc sai lệch dữ liệu.</span>
              </div>
            ) : (
              <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {warnings.map((w) => {
                  const Icon =
                    w.severity === 'error'
                      ? AlertCircle
                      : w.severity === 'warning'
                      ? AlertTriangle
                      : Info;
                  const tone =
                    w.severity === 'error'
                      ? 'border-red-200 bg-red-50/60 text-red-800'
                      : w.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50/60 text-amber-900'
                      : 'border-slate-200 bg-slate-50 text-slate-700';
                  return (
                    <div
                      key={w.id}
                      className={`flex items-start gap-2.5 rounded-md border p-2.5 text-xs ${tone}`}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        <div className="font-semibold">{w.category}</div>
                        <div className="mt-0.5 leading-relaxed">{w.message}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
