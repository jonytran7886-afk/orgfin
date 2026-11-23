import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Printer,
  Send,
  Target,
  Trash2,
} from 'lucide-react';
import {
  ChannelId,
  CommissionMethod,
  ComputedScenarioResult,
  KpiTargetMetric,
  SalesProfile,
  SalesProfileProductItem,
  ScenarioData,
  SellerType,
  SellingUnitBasis,
  VolumeBonusMode,
} from '../types/finance';
import {
  applyProfileToScenarioPlan,
  buildIncomePotentialCurve,
  computeSalesProfile,
  getFinishedWeightPerHead,
  solveTargetIncome,
} from '../engine/salesIncome';
import {
  CHANNEL_LABELS,
  formatNumber,
  formatPct,
  formatVnd,
} from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import { NumericCell, StatusSelect, TextCell } from './EditableCell';

interface SalesIncomeViewProps {
  scenario: ScenarioData;
  result: ComputedScenarioResult;
  onUpdateScenario: (updater: (prev: ScenarioData) => ScenarioData) => void;
}

const TARGET_PRESETS = [5_000_000, 10_000_000, 15_000_000, 20_000_000];

export const SalesIncomeView: React.FC<SalesIncomeViewProps> = ({
  scenario,
  result,
  onUpdateScenario,
}) => {
  const profiles = scenario.salesProfiles ?? [];
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    profiles[0]?.id || ''
  );
  const [audienceMode, setAudienceMode] = useState<'executive' | 'ctv_share'>(
    'executive'
  );
  const [targetIncome, setTargetIncome] = useState<number>(10_000_000);
  const [showCurveRevenue, setShowCurveRevenue] = useState<boolean>(false);
  const [hoveredStopIdx, setHoveredStopIdx] = useState<number | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyMode, setApplyMode] = useState<'replace' | 'add'>('replace');
  const [applyMonth, setApplyMonth] = useState<number>(0); // 0 = 12 tháng
  const [applyFeedback, setApplyFeedback] = useState<string>('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const activeProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? profiles[0];

  const updateProfile = (id: string, patch: Partial<SalesProfile>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      salesProfiles: (prev.salesProfiles ?? []).map((sp) =>
        sp.id === id
          ? { ...sp, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : sp
      ),
    }));
  };

  const updateProfileItem = (
    profileId: string,
    itemId: string,
    patch: Partial<SalesProfileProductItem>
  ) => {
    onUpdateScenario((prev) => ({
      ...prev,
      salesProfiles: (prev.salesProfiles ?? []).map((sp) =>
        sp.id === profileId
          ? {
              ...sp,
              updatedAt: new Date().toISOString().slice(0, 10),
              items: sp.items.map((it) =>
                it.id === itemId ? { ...it, ...patch } : it
              ),
            }
          : sp
      ),
    }));
  };

  const addProfile = () => {
    const firstProd = scenario.products[0];
    const newId = `HS-${Date.now().toString().slice(-4)}`;
    const newProfile: SalesProfile = {
      id: newId,
      name: `CTV Mô phỏng ${profiles.length + 1}`,
      sellerType: 'ctv',
      region: 'TP.HCM',
      channelId: 'ctv',
      sellingDaysPerMonth: 26,
      baseSalary: 0,
      allowances: 0,
      employerInsurance: 0,
      otherEmployerCost: 0,
      volumeBonusMode: 'none',
      volumeBonusTiers: [
        { minQty: 0, maxQty: 49, ratePerUnit: 10000, fixedBonus: 0 },
        { minQty: 50, maxQty: 99, ratePerUnit: 15000, fixedBonus: 500000 },
        { minQty: 100, maxQty: null, ratePerUnit: 20000, fixedBonus: 1500000 },
      ],
      kpiTargetMetric: 'quantity',
      kpiTargetValue: 0,
      kpiBonusAt100: 0,
      kpiExtraPerPctOver100: 0,
      newCustomersCount: 0,
      newCustomerBonusPerUnit: 0,
      repeatCustomersCount: 0,
      repeatCustomerBonusPerUnit: 0,
      otherBonus: 0,
      hasDeductionConfig: false,
      taxWithholdingRate: 0.1,
      employeeInsuranceRate: 0,
      otherDeductions: 0,
      allocatedFixedOpCostMonthly: 2000000,
      effectiveDate: new Date().toISOString().slice(0, 10),
      approvalState: 'simulated',
      appliedToPlan: false,
      appliedMonth: 0,
      appliedMode: 'replace',
      status: 'assumed',
      source: 'Mô phỏng cá nhân',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Kinh doanh',
      note: '',
      items: firstProd
        ? [
            {
              id: `ITEM-${Date.now().toString().slice(-4)}`,
              productId: firstProd.id,
              inputMode: 'daily',
              dailyQty: 10,
              monthlyQty: 260,
              sellingUnitBasis: firstProd.group === 'Gà' ? 'per_head' : 'sell_unit',
              usePolicyPrice: true,
              overrideSellPrice: firstProd.targetSellPrice,
              commissionMethod: 'fixed_per_unit',
              commissionValue: 15000,
            },
          ]
        : [],
    };
    onUpdateScenario((prev) => ({
      ...prev,
      salesProfiles: [...(prev.salesProfiles ?? []), newProfile],
    }));
    setSelectedProfileId(newId);
  };

  const duplicateProfile = (sp: SalesProfile) => {
    const newId = `${sp.id}-CP-${Date.now().toString().slice(-3)}`;
    const copy: SalesProfile = {
      ...structuredClone(sp),
      id: newId,
      name: `${sp.name} (Bản sao)`,
      appliedToPlan: false,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onUpdateScenario((prev) => ({
      ...prev,
      salesProfiles: [...(prev.salesProfiles ?? []), copy],
    }));
    setSelectedProfileId(newId);
  };

  const addProductItemToProfile = () => {
    if (!activeProfile) return;
    const firstProd = scenario.products[0];
    if (!firstProd) return;
    const nextItem: SalesProfileProductItem = {
      id: `ITEM-${Date.now().toString().slice(-4)}`,
      productId: firstProd.id,
      inputMode: 'daily',
      dailyQty: 5,
      monthlyQty: 5 * Math.max(1, activeProfile.sellingDaysPerMonth),
      sellingUnitBasis: firstProd.group === 'Gà' ? 'per_head' : 'sell_unit',
      usePolicyPrice: true,
      overrideSellPrice: firstProd.targetSellPrice,
      commissionMethod: 'use_policy',
      commissionValue: 15000,
    };
    updateProfile(activeProfile.id, {
      items: [...activeProfile.items, nextItem],
    });
  };

  const computedActive = useMemo(() => {
    if (!activeProfile) return null;
    return computeSalesProfile(activeProfile, scenario, result.productCogsMap);
  }, [activeProfile, scenario, result.productCogsMap]);

  const targetSolver = useMemo(() => {
    if (!activeProfile) return null;
    return solveTargetIncome(activeProfile, scenario, targetIncome);
  }, [activeProfile, scenario, targetIncome]);

  const curvePoints = useMemo(() => {
    if (!activeProfile) return [];
    return buildIncomePotentialCurve(activeProfile, scenario);
  }, [activeProfile, scenario]);

  const allProfilesSummary = useMemo(
    () =>
      profiles.map((sp) => ({
        profile: sp,
        computed: computeSalesProfile(sp, scenario, result.productCogsMap).summary,
      })),
    [profiles, scenario, result.productCogsMap]
  );

  const handleApplyToPlan = () => {
    if (!activeProfile) return;
    onUpdateScenario((prev) =>
      applyProfileToScenarioPlan(prev, activeProfile, applyMode, applyMonth)
    );
    setApplyModalOpen(false);
    setApplyFeedback(
      `Đã áp dụng sản lượng và chính sách của "${activeProfile.name}" vào kế hoạch tài chính (${
        applyMonth === 0 ? 'Cả 12 tháng' : `Tháng ${applyMonth}`
      } · Chế độ ${applyMode === 'replace' ? 'Thay thế' : 'Bổ sung'}). P&L, Điểm hòa vốn và Dòng tiền đã cập nhật tự động.`
    );
  };

  const handlePrintSummary = () => {
    window.print();
  };

  if (!activeProfile || !computedActive) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          Chưa có hồ sơ mô phỏng thu nhập nào trong kịch bản hiện tại.
        </p>
        <button
          type="button"
          onClick={addProfile}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          Tạo hồ sơ mô phỏng đầu tiên
        </button>
      </div>
    );
  }

  const { summary, items } = computedActive;
  const isExecutive = audienceMode === 'executive';

  // Chart SVG geometry
  const chartW = 680;
  const chartH = 240;
  const padL = 62;
  const padR = 20;
  const padT = 18;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxCurveY = Math.max(
    1_000_000,
    ...curvePoints.map((pt) =>
      Math.max(
        pt.ctvIncome,
        pt.staffIncome,
        isExecutive ? pt.organicContribution : 0,
        showCurveRevenue ? pt.revenue : 0
      )
    )
  );
  const minCurveY = Math.min(
    0,
    ...curvePoints.map((pt) => (isExecutive ? pt.organicContribution : 0))
  );
  const rangeCurveY = maxCurveY - minCurveY || 1;
  const xAt = (idx: number) =>
    padL +
    (curvePoints.length > 1
      ? (idx / (curvePoints.length - 1)) * plotW
      : plotW / 2);
  const yAt = (val: number) => padT + ((maxCurveY - val) / rangeCurveY) * plotH;

  const polylineFor = (picker: (pt: (typeof curvePoints)[0]) => number) =>
    curvePoints.map((pt, idx) => `${xAt(idx)},${yAt(picker(pt))}`).join(' ');

  const hoveredPoint =
    hoveredStopIdx !== null ? curvePoints[hoveredStopIdx] : null;

  return (
    <div className="space-y-6">
      {/* Mode Bar: Sandbox A vs Plan B + Audience Mode + Print */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-slate-900">
            {activeProfile.appliedToPlan
              ? 'Chế độ B – Đã áp dụng vào kế hoạch'
              : 'Chế độ A – Mô phỏng cá nhân (Không làm đổi kế hoạch)'}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="text-slate-600">
            Công thức dùng chung với Financial Calculation Engine (Giá vốn, Giá bán & Kênh).
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() =>
              setAudienceMode(isExecutive ? 'ctv_share' : 'executive')
            }
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
              isExecutive
                ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                : 'border-emerald-700 bg-emerald-50 text-emerald-800'
            }`}
          >
            {isExecutive ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Chuyển sang chế độ CTV (Ẩn giá vốn nội bộ)
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                Mở chế độ Ban điều hành (Xem lãi đóng góp)
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrintSummary}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            In / Xuất PDF tóm tắt
          </button>

          {isExecutive && (
            <button
              type="button"
              onClick={() => setApplyModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              Áp dụng vào kế hoạch
            </button>
          )}
        </div>
      </div>

      {applyFeedback && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          <span>{applyFeedback}</span>
          <button
            type="button"
            onClick={() => setApplyFeedback('')}
            className="text-emerald-700 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Value Flow Chain */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-700">
        <span className="font-semibold text-slate-900">Chuỗi giá trị:</span>
        <span>
          Số lượng bán (
          <strong className="font-num">{formatNumber(summary.totalMonthlyQty)} đv</strong>)
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
        <span>
          Doanh thu tạo ra (
          <strong className="font-num">{formatVnd(summary.totalGrossRevenue, true)}</strong>)
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
        <span>
          Hoa hồng & thưởng (
          <strong className="font-num text-emerald-700">
            {formatVnd(summary.totalCommission + summary.totalAllBonuses, true)}
          </strong>)
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
        <span>
          Thu nhập cá nhân (
          <strong className="font-num text-emerald-800">
            {formatVnd(summary.grossIncome, true)}
          </strong>)
        </span>
        {isExecutive && (
          <>
            <span className="mx-1 text-slate-300">|</span>
            <span>
              Lãi đóng góp Organic:{' '}
              <strong
                className={`font-num ${
                  summary.organicContribution >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {formatVnd(summary.organicContribution, true)}
              </strong>
            </span>
          </>
        )}
      </div>

      {/* Main 3-Zone Layout: A (Inputs) + B (6 KPIs + Chart) + C (Reverse Target) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* KHU VỰC A: NHẬP THÔNG SỐ */}
        <div className="space-y-5 xl:col-span-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                A. Thông số hồ sơ mô phỏng
              </h3>
              <div className="flex items-center gap-1 print:hidden">
                <button
                  type="button"
                  onClick={addProfile}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3 w-3" />
                  Hồ sơ mới
                </button>
                <button
                  type="button"
                  onClick={() => duplicateProfile(activeProfile)}
                  title="Nhân bản hồ sơ"
                  className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(activeProfile.id)}
                    title="Xóa hồ sơ"
                    className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Profile Picker & Core Identity */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500">
                  Chọn hồ sơ mô phỏng
                </label>
                <select
                  value={activeProfile.id}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900"
                >
                  {profiles.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.sellerType === 'ctv' ? 'CTV' : 'Nhân viên'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500">
                  Tên người bán / kịch bản
                </label>
                <div className="mt-1 rounded border border-slate-200">
                  <TextCell
                    value={activeProfile.name}
                    onChange={(v) => updateProfile(activeProfile.id, { name: v })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Loại người bán
                </label>
                <select
                  value={activeProfile.sellerType}
                  onChange={(e) => {
                    const st = e.target.value as SellerType;
                    updateProfile(activeProfile.id, {
                      sellerType: st,
                      baseSalary:
                        st === 'staff' && activeProfile.baseSalary === 0
                          ? 7_000_000
                          : st === 'ctv'
                          ? 0
                          : activeProfile.baseSalary,
                    });
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="ctv">Cộng tác viên (CTV)</option>
                  <option value="staff">Nhân viên kinh doanh</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Kênh bán áp dụng
                </label>
                <select
                  value={activeProfile.channelId}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      channelId: e.target.value as ChannelId,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  {(['ctv', 'direct', 'store', 'agency', 'b2b'] as ChannelId[]).map(
                    (cid) => (
                      <option key={cid} value={cid}>
                        {CHANNEL_LABELS[cid]}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Số ngày bán hàng / tháng
                </label>
                <div className="mt-1 rounded border border-slate-200">
                  <NumericCell
                    value={activeProfile.sellingDaysPerMonth}
                    mode="number"
                    min={1}
                    max={31}
                    onChange={(v) =>
                      updateProfile(activeProfile.id, {
                        sellingDaysPerMonth: Math.max(1, Math.round(v)),
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Khu vực phụ trách
                </label>
                <div className="mt-1 rounded border border-slate-200">
                  <TextCell
                    value={activeProfile.region}
                    onChange={(v) => updateProfile(activeProfile.id, { region: v })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Trạng thái dữ liệu
                </label>
                <div className="mt-1.5">
                  <StatusSelect
                    value={activeProfile.status}
                    onChange={(s) => updateProfile(activeProfile.id, { status: s })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  Ngày hiệu lực & Phê duyệt
                </label>
                <select
                  value={activeProfile.approvalState}
                  onChange={(e) =>
                    updateProfile(activeProfile.id, {
                      approvalState: e.target.value as 'simulated' | 'approved',
                    })
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="simulated">Đang mô phỏng ({activeProfile.effectiveDate})</option>
                  <option value="approved">Đã phê duyệt chính sách</option>
                </select>
              </div>
            </div>

            {/* Product List (Multi-Product Support) */}
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-display text-xs font-semibold text-slate-900">
                  Sản phẩm bán & sản lượng dự kiến
                </h4>
                <button
                  type="button"
                  onClick={addProductItemToProfile}
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  Thêm sản phẩm
                </button>
              </div>

              <div className="space-y-3">
                {activeProfile.items.map((it) => {
                  const prod = scenario.products.find((p) => p.id === it.productId);
                  const matchedPlan = scenario.channelPlans.find(
                    (cp) =>
                      cp.productId === it.productId &&
                      cp.channelId === activeProfile.channelId
                  );
                  const policyPrice = matchedPlan?.sellPrice ?? prod?.targetSellPrice ?? 0;
                  const days = Math.max(1, activeProfile.sellingDaysPerMonth);
                  const computedMonthly =
                    it.inputMode === 'daily' ? it.dailyQty * days : it.monthlyQty;
                  const computedDaily = computedMonthly / days;
                  const convKg = prod ? getFinishedWeightPerHead(prod) : 1;

                  return (
                    <div
                      key={it.id}
                      className="rounded-md border border-slate-200 bg-slate-50/50 p-3 text-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={it.productId}
                          onChange={(e) => {
                            const nextProd = scenario.products.find(
                              (p) => p.id === e.target.value
                            );
                            updateProfileItem(activeProfile.id, it.id, {
                              productId: e.target.value,
                              sellingUnitBasis:
                                nextProd?.group === 'Gà' ? 'per_head' : 'sell_unit',
                            });
                          }}
                          className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-900"
                        >
                          {scenario.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {activeProfile.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateProfile(activeProfile.id, {
                                items: activeProfile.items.filter((x) => x.id !== it.id),
                              })
                            }
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                            title="Bỏ sản phẩm này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-slate-500">Đơn vị bán</span>
                          <select
                            value={it.sellingUnitBasis}
                            onChange={(e) =>
                              updateProfileItem(activeProfile.id, it.id, {
                                sellingUnitBasis: e.target.value as SellingUnitBasis,
                              })
                            }
                            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                          >
                            <option value="per_head">
                              Theo {prod?.inputUnit || 'con'} ({formatNumber(convKg, 2)} kg TP)
                            </option>
                            <option value="sell_unit">
                              Theo {prod?.sellUnit || 'đơn vị bán'}
                            </option>
                          </select>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-500">
                            Giá bán ({prod?.sellUnit})
                          </span>
                          <div className="mt-0.5 flex items-center gap-1">
                            {it.usePolicyPrice ? (
                              <button
                                type="button"
                                onClick={() =>
                                  updateProfileItem(activeProfile.id, it.id, {
                                    usePolicyPrice: false,
                                    overrideSellPrice: policyPrice,
                                  })
                                }
                                title="Đang lấy theo chính sách hiện hành — Nhấp để nhập giá riêng"
                                className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-right font-num text-xs text-slate-700 hover:border-emerald-600"
                              >
                                {formatVnd(policyPrice)} (CS)
                              </button>
                            ) : (
                              <div className="flex w-full items-center gap-1">
                                <NumericCell
                                  value={it.overrideSellPrice}
                                  mode="currency"
                                  min={0}
                                  onChange={(v) =>
                                    updateProfileItem(activeProfile.id, it.id, {
                                      overrideSellPrice: v,
                                    })
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateProfileItem(activeProfile.id, it.id, {
                                      usePolicyPrice: true,
                                    })
                                  }
                                  className="text-[10px] text-emerald-700 hover:underline whitespace-nowrap"
                                >
                                  Theo CS
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>SL / ngày</span>
                            {it.inputMode === 'daily' && (
                              <span className="text-emerald-700 font-medium">Đang nhập</span>
                            )}
                          </div>
                          <div className="mt-0.5 rounded border border-slate-200 bg-white">
                            <NumericCell
                              value={computedDaily}
                              mode="decimal"
                              decimals={1}
                              min={0}
                              onChange={(v) =>
                                updateProfileItem(activeProfile.id, it.id, {
                                  inputMode: 'daily',
                                  dailyQty: v,
                                  monthlyQty: Math.round(v * days),
                                })
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>SL / tháng</span>
                            {it.inputMode === 'monthly' && (
                              <span className="text-emerald-700 font-medium">Đang nhập</span>
                            )}
                          </div>
                          <div className="mt-0.5 rounded border border-slate-200 bg-white">
                            <NumericCell
                              value={computedMonthly}
                              mode="number"
                              min={0}
                              onChange={(v) =>
                                updateProfileItem(activeProfile.id, it.id, {
                                  inputMode: 'monthly',
                                  monthlyQty: Math.round(v),
                                  dailyQty: v / days,
                                })
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-500">Cơ chế hoa hồng</span>
                          <select
                            value={it.commissionMethod}
                            onChange={(e) => {
                              const cm = e.target.value as
                                | 'use_policy'
                                | CommissionMethod;
                              updateProfileItem(activeProfile.id, it.id, {
                                commissionMethod: cm,
                                commissionValue:
                                  cm === 'fixed_per_unit'
                                    ? 15000
                                    : cm === 'use_policy'
                                    ? it.commissionValue
                                    : 0.08,
                              });
                            }}
                            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                          >
                            <option value="use_policy">Theo chính sách kênh</option>
                            <option value="fixed_per_unit">Cố định / đơn vị bán</option>
                            <option value="pct_net_revenue">% Doanh thu thuần</option>
                            <option value="pct_cm_before_comm">% Lãi đóng góp</option>
                          </select>
                        </div>

                        <div>
                          <span className="text-[11px] text-slate-500">Mức hoa hồng</span>
                          {it.commissionMethod === 'use_policy' ? (
                            <div className="mt-0.5 rounded border border-slate-200 bg-slate-100 px-2 py-1 text-right font-num text-xs text-slate-600">
                              {matchedPlan
                                ? matchedPlan.commissionMethod === 'fixed_per_unit'
                                  ? `${formatVnd(matchedPlan.commissionValue)}/đv`
                                  : formatPct(matchedPlan.commissionValue * 100)
                                : '0 đ'}
                            </div>
                          ) : (
                            <div className="mt-0.5 rounded border border-slate-200 bg-white">
                              <NumericCell
                                value={it.commissionValue}
                                mode={
                                  it.commissionMethod === 'fixed_per_unit'
                                    ? 'currency'
                                    : 'percent'
                                }
                                decimals={1}
                                min={0}
                                onChange={(v) =>
                                  updateProfileItem(activeProfile.id, it.id, {
                                    commissionValue: v,
                                  })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Salary, Bonuses & Deductions */}
            <div className="border-t border-slate-100 pt-4 space-y-3 text-xs">
              <h4 className="font-display text-xs font-semibold text-slate-900">
                Lương cố định, thưởng sản lượng, KPI & Khấu trừ
              </h4>

              {activeProfile.sellerType === 'staff' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-500">Lương cố định/tháng</span>
                    <div className="mt-0.5 rounded border border-slate-200">
                      <NumericCell
                        value={activeProfile.baseSalary}
                        mode="currency"
                        min={0}
                        onChange={(v) =>
                          updateProfile(activeProfile.id, { baseSalary: v })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">Phụ cấp/tháng</span>
                    <div className="mt-0.5 rounded border border-slate-200">
                      <NumericCell
                        value={activeProfile.allowances}
                        mode="currency"
                        min={0}
                        onChange={(v) =>
                          updateProfile(activeProfile.id, { allowances: v })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Volume Bonus Policy (Formula 08) */}
              <div className="space-y-2 rounded border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">
                    Thưởng sản lượng (Công thức 08)
                  </span>
                  <select
                    value={activeProfile.volumeBonusMode}
                    onChange={(e) =>
                      updateProfile(activeProfile.id, {
                        volumeBonusMode: e.target.value as VolumeBonusMode,
                      })
                    }
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="none">Không áp dụng</option>
                    <option value="threshold_fixed">Ngưỡng thưởng cố định</option>
                    <option value="tier_whole">Bậc áp dụng toàn bộ SL</option>
                    <option value="tier_progressive">Bậc lũy tiến từng bậc</option>
                  </select>
                </div>

                {activeProfile.volumeBonusMode !== 'none' && (
                  <div className="space-y-1.5 pt-1">
                    {activeProfile.volumeBonusTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 items-center gap-1.5 text-[11px]"
                      >
                        <div className="col-span-3">
                          <NumericCell
                            value={tier.minQty}
                            mode="number"
                            min={0}
                            onChange={(v) => {
                              const next = [...activeProfile.volumeBonusTiers];
                              next[idx] = { ...next[idx], minQty: Math.round(v) };
                              updateProfile(activeProfile.id, {
                                volumeBonusTiers: next,
                              });
                            }}
                          />
                        </div>
                        <span className="col-span-1 text-center text-slate-400">→</span>
                        <div className="col-span-3 font-num text-slate-600">
                          {tier.maxQty !== null ? tier.maxQty : 'Trở lên'}
                        </div>
                        <div className="col-span-5">
                          <NumericCell
                            value={
                              activeProfile.volumeBonusMode === 'threshold_fixed'
                                ? tier.fixedBonus
                                : tier.ratePerUnit
                            }
                            mode="currency"
                            min={0}
                            onChange={(v) => {
                              const next = [...activeProfile.volumeBonusTiers];
                              next[idx] =
                                activeProfile.volumeBonusMode === 'threshold_fixed'
                                  ? { ...next[idx], fixedBonus: v }
                                  : { ...next[idx], ratePerUnit: v };
                              updateProfile(activeProfile.id, {
                                volumeBonusTiers: next,
                              });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* KPI & New/Repeat Customer Bonuses */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] text-slate-500">Chỉ tiêu KPI theo</span>
                  <select
                    value={activeProfile.kpiTargetMetric}
                    onChange={(e) =>
                      updateProfile(activeProfile.id, {
                        kpiTargetMetric: e.target.value as KpiTargetMetric,
                      })
                    }
                    className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    <option value="quantity">Sản lượng (đv)</option>
                    <option value="revenue">Doanh thu thuần (đ)</option>
                    <option value="contribution">Lãi đóng góp (đ)</option>
                    <option value="new_customers">Khách hàng mới</option>
                  </select>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">
                    Mục tiêu KPI (0 = chưa đặt)
                  </span>
                  <div className="mt-0.5 rounded border border-slate-200">
                    <NumericCell
                      value={activeProfile.kpiTargetValue}
                      mode="number"
                      min={0}
                      onChange={(v) =>
                        updateProfile(activeProfile.id, { kpiTargetValue: v })
                      }
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Thưởng đạt 100% KPI</span>
                  <div className="mt-0.5 rounded border border-slate-200">
                    <NumericCell
                      value={activeProfile.kpiBonusAt100}
                      mode="currency"
                      min={0}
                      onChange={(v) =>
                        updateProfile(activeProfile.id, { kpiBonusAt100: v })
                      }
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Thưởng thêm/1% vượt KPI</span>
                  <div className="mt-0.5 rounded border border-slate-200">
                    <NumericCell
                      value={activeProfile.kpiExtraPerPctOver100}
                      mode="currency"
                      min={0}
                      onChange={(v) =>
                        updateProfile(activeProfile.id, {
                          kpiExtraPerPctOver100: v,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Số KH mới đủ ĐK</span>
                  <div className="mt-0.5 rounded border border-slate-200">
                    <NumericCell
                      value={activeProfile.newCustomersCount}
                      mode="number"
                      min={0}
                      onChange={(v) =>
                        updateProfile(activeProfile.id, {
                          newCustomersCount: Math.round(v),
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Thưởng/KH mới</span>
                  <div className="mt-0.5 rounded border border-slate-200">
                    <NumericCell
                      value={activeProfile.newCustomerBonusPerUnit}
                      mode="currency"
                      min={0}
                      onChange={(v) =>
                        updateProfile(activeProfile.id, {
                          newCustomerBonusPerUnit: v,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Số KH mua lại</span>
                  <div className="mt-0.5 rounded border border-slate-200">
                    <NumericCell
                      value={activeProfile.repeatCustomersCount}
                      mode="number"
                      min={0}
                      onChange={(v) =>
                        updateProfile(activeProfile.id, {
                          repeatCustomersCount: Math.round(v),
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500">Thưởng/KH mua lại</span>
                  <div className="mt-0.5 rounded border border-slate-200">
                    <NumericCell
                      value={activeProfile.repeatCustomerBonusPerUnit}
                      mode="currency"
                      min={0}
                      onChange={(v) =>
                        updateProfile(activeProfile.id, {
                          repeatCustomerBonusPerUnit: v,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Deductions toggle (Formula 14) */}
              <div className="rounded border border-slate-200 p-3 space-y-2">
                <label className="flex items-center gap-2 font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={activeProfile.hasDeductionConfig}
                    onChange={(e) =>
                      updateProfile(activeProfile.id, {
                        hasDeductionConfig: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-emerald-700"
                  />
                  Tính thu nhập thực nhận ước tính (Khấu trừ thuế & BH)
                </label>

                {activeProfile.hasDeductionConfig && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[11px] text-slate-500">Thuế TNCN tạm khấu trừ</span>
                      <div className="mt-0.5 rounded border border-slate-200">
                        <NumericCell
                          value={activeProfile.taxWithholdingRate}
                          mode="percent"
                          decimals={1}
                          min={0}
                          max={0.35}
                          onChange={(v) =>
                            updateProfile(activeProfile.id, { taxWithholdingRate: v })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">BHXH/YT người LĐ</span>
                      <div className="mt-0.5 rounded border border-slate-200">
                        <NumericCell
                          value={activeProfile.employeeInsuranceRate}
                          mode="percent"
                          decimals={1}
                          min={0}
                          max={0.2}
                          onChange={(v) =>
                            updateProfile(activeProfile.id, {
                              employeeInsuranceRate: v,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* KHU VỰC B & C: KẾT QUẢ, BIỂU ĐỒ & TÍNH NGƯỢC MỤC TIÊU */}
        <div className="space-y-6 xl:col-span-7">
          {/* 6 KPI Cards (Section II.B) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">1. Sản lượng bán / tháng</div>
              <div className="mt-1 font-num text-xl font-semibold text-slate-900">
                {formatNumber(summary.totalMonthlyQty)} đv
              </div>
              <div className="mt-0.5 font-num text-xs text-slate-500">
                BQ: {formatNumber(summary.totalDailyAvgQty, 1)} đv/ngày ({activeProfile.sellingDaysPerMonth} ngày)
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">2. Doanh thu tạo ra cho Organic</div>
              <div className="mt-1 font-num text-xl font-semibold text-slate-900">
                {formatVnd(summary.totalGrossRevenue)}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                Không phải thu nhập cá nhân
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">3. Hoa hồng cá nhân</div>
              <div className="mt-1 font-num text-xl font-semibold text-emerald-700">
                {formatVnd(summary.totalCommission)}
              </div>
              <div className="mt-0.5 font-num text-xs text-slate-500">
                Theo {items.length} sản phẩm
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">4. Thưởng SL, KPI & KH</div>
              <div className="mt-1 font-num text-xl font-semibold text-slate-900">
                {formatVnd(summary.totalAllBonuses)}
              </div>
              <div className="mt-0.5 font-num text-xs text-slate-500">
                KPI:{' '}
                {summary.kpiCompletionPct !== null
                  ? formatPct(summary.kpiCompletionPct, 1)
                  : 'Chưa đặt mục tiêu'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">5. Lương cố định & phụ cấp</div>
              <div className="mt-1 font-num text-xl font-semibold text-slate-900">
                {formatVnd(summary.fixedSalaryAndAllowance)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {activeProfile.sellerType === 'ctv'
                  ? 'CTV không hưởng lương CĐ'
                  : 'Lương cứng + phụ cấp'}
              </div>
            </div>

            <div className="rounded-lg border border-emerald-700 bg-emerald-50/40 p-4">
              <div className="text-xs font-semibold text-emerald-800">
                6. Tổng thu nhập dự kiến / tháng
              </div>
              <div className="mt-1 font-num text-2xl font-bold text-emerald-800">
                {formatVnd(summary.grossIncome)}
              </div>
              <div className="mt-0.5 font-num text-xs text-emerald-900">
                {summary.estimatedNetIncome !== null
                  ? `Thực nhận ước tính: ${formatVnd(summary.estimatedNetIncome)}`
                  : 'Thu nhập trước khấu trừ'}
              </div>
            </div>
          </div>

          {/* Executive Internal Breakdown (Hidden in CTV Share Mode!) */}
          {isExecutive && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3 text-xs">
              <div>
                <div className="text-slate-500">Chi phí bán hàng của Organic (F15)</div>
                <div className="mt-1 font-num text-base font-semibold text-slate-900">
                  {formatVnd(summary.companySellingCost)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Lãi đóng góp Organic (F16)</div>
                <div
                  className={`mt-1 font-num text-base font-semibold ${
                    summary.organicContribution >= 0
                      ? 'text-emerald-700'
                      : 'text-red-700'
                  }`}
                >
                  {formatVnd(summary.organicContribution)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Lợi nhuận sau phân bổ (F17)</div>
                <div
                  className={`mt-1 font-num text-base font-semibold ${
                    summary.organicAllocatedProfit >= 0
                      ? 'text-slate-900'
                      : 'text-red-700'
                  }`}
                >
                  {formatVnd(summary.organicAllocatedProfit)}
                </div>
              </div>
            </div>
          )}

          {/* Income Potential Chart (Section VI) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Biểu đồ tiềm năng thu nhập theo sản lượng (5 – 50 đv/ngày)
                </h3>
                <p className="text-xs text-slate-500">
                  So sánh thu nhập CTV và Nhân viên tại các ngưỡng sản lượng; thể hiện bước nhảy nếu có thưởng bậc.
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={showCurveRevenue}
                  onChange={(e) => setShowCurveRevenue(e.target.checked)}
                  className="h-3.5 w-3.5 accent-emerald-700"
                />
                Hiện đường Doanh thu
              </label>
            </div>

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-emerald-700" />
                  Thu nhập CTV
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-amber-600" />
                  Thu nhập Nhân viên
                </span>
                {isExecutive && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-slate-600" />
                    Lãi đóng góp Organic
                  </span>
                )}
                {showCurveRevenue && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-4 bg-slate-300" />
                    Doanh thu tạo ra
                  </span>
                )}
              </div>
              <div className="min-h-[18px] font-num text-xs text-slate-700">
                {hoveredPoint ? (
                  <span>
                    {hoveredPoint.dailyQty} đv/ngày ({hoveredPoint.monthlyQty} đv/tháng) · CTV{' '}
                    <strong className="text-emerald-700">
                      {formatVnd(hoveredPoint.ctvIncome, true)}
                    </strong>{' '}
                    · NV{' '}
                    <strong className="text-amber-700">
                      {formatVnd(hoveredPoint.staffIncome, true)}
                    </strong>
                    {isExecutive && (
                      <>
                        {' '}
                        · CM{' '}
                        <strong>
                          {formatVnd(hoveredPoint.organicContribution, true)}
                        </strong>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-400">Di chuột lên điểm để xem số liệu</span>
                )}
              </div>
            </div>

            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="h-56 w-full select-none overflow-visible"
              role="img"
              aria-label="Biểu đồ tiềm năng thu nhập theo sản lượng"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const v = minCurveY + (1 - t) * rangeCurveY;
                const y = padT + t * plotH;
                return (
                  <g key={t}>
                    <line
                      x1={padL}
                      x2={chartW - padR}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-500 font-num text-[10px]"
                    >
                      {formatVnd(v, true).replace(' đ', '')}
                    </text>
                  </g>
                );
              })}

              {showCurveRevenue && (
                <polyline
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  points={polylineFor((p) => p.revenue)}
                />
              )}
              {isExecutive && (
                <polyline
                  fill="none"
                  stroke="#475569"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  points={polylineFor((p) => p.organicContribution)}
                />
              )}
              <polyline
                fill="none"
                stroke="#d97706"
                strokeWidth={2.2}
                points={polylineFor((p) => p.staffIncome)}
              />
              <polyline
                fill="none"
                stroke="#15803d"
                strokeWidth={2.5}
                points={polylineFor((p) => p.ctvIncome)}
              />

              {curvePoints.map((pt, idx) => {
                const cx = xAt(idx);
                return (
                  <g
                    key={`${pt.dailyQty}-${idx}`}
                    onMouseEnter={() => setHoveredStopIdx(idx)}
                    onMouseLeave={() => setHoveredStopIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={cx - 18}
                      y={padT}
                      width={36}
                      height={plotH}
                      fill="transparent"
                    />
                    <circle
                      cx={cx}
                      cy={yAt(pt.ctvIncome)}
                      r={hoveredStopIdx === idx ? 4.5 : 3}
                      fill="#15803d"
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={cx}
                      cy={yAt(pt.staffIncome)}
                      r={hoveredStopIdx === idx ? 4.5 : 3}
                      fill="#d97706"
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                    <text
                      x={cx}
                      y={chartH - 8}
                      textAnchor="middle"
                      className="fill-slate-600 font-num text-[10px]"
                    >
                      {pt.dailyQty}/ng
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* KHU VỰC C: TÍNH NGƯỢC MỤC TIÊU THU NHẬP (Section V) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-700" />
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  C. Tính ngược sản lượng theo Mục tiêu thu nhập
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {TARGET_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTargetIncome(preset)}
                    className={`rounded border px-2.5 py-1 font-num text-xs font-medium whitespace-nowrap ${
                      targetIncome === preset
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset / 1_000_000} tr
                  </button>
                ))}
                <div className="w-32 rounded border border-slate-300">
                  <NumericCell
                    value={targetIncome}
                    mode="currency"
                    min={0}
                    onChange={(v) => setTargetIncome(v)}
                  />
                </div>
              </div>
            </div>

            {targetSolver && !targetSolver.feasible ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">
                    Chưa thể đạt mức thu nhập mục tiêu {formatVnd(targetIncome)}
                  </div>
                  <div className="mt-0.5">{targetSolver.reasonIfInfeasible}</div>
                </div>
              </div>
            ) : (
              targetSolver && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-5 text-xs">
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3">
                    <div className="text-slate-600">Tối thiểu cần bán/tháng</div>
                    <div className="mt-1 font-num text-lg font-bold text-emerald-800">
                      {formatNumber(targetSolver.requiredMonthlyQty)} đv
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-slate-500">Bình quân / ngày</div>
                    <div className="mt-1 font-num text-base font-semibold text-slate-900">
                      {formatNumber(targetSolver.requiredDailyAvgQty, 2)} đv/ng
                    </div>
                    <div className="mt-0.5 font-num text-[11px] text-slate-500">
                      Làm tròn nguyên: {targetSolver.roundedUpDailyQty} đv/ng (
                      {targetSolver.recalculatedMonthlyFromDaily}/th)
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-slate-500">Doanh thu tương ứng</div>
                    <div className="mt-1 font-num text-base font-semibold text-slate-900">
                      {formatVnd(targetSolver.resultingRevenue, true)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-slate-500">Hoa hồng đạt được</div>
                    <div className="mt-1 font-num text-base font-semibold text-emerald-700">
                      {formatVnd(targetSolver.resultingCommission)}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-slate-500">Thưởng bổ sung + Lương</div>
                    <div className="mt-1 font-num text-base font-semibold text-slate-900">
                      {formatVnd(
                        targetSolver.resultingBonuses + targetSolver.resultingFixedIncome
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Multi-Profile Summary Comparison Table (Section VIII) */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Bảng tổng hợp & so sánh các hồ sơ Nhân viên / CTV
          </h3>
          <span className="text-xs text-slate-500">
            Nhấp vào một dòng để chuyển nhanh hồ sơ đang mô phỏng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2 pr-3 max-w-[190px]">Cá nhân / Kịch bản</th>
                <th className="py-2 px-3 whitespace-nowrap">Vai trò</th>
                <th className="py-2 px-3 max-w-[125px]">Khu vực</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">Sản lượng/tháng</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">Doanh thu tạo ra</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">Hoa hồng & thưởng</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">Lương CĐ</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">Tổng thu nhập</th>
                {isExecutive && (
                  <th className="py-2 px-3 text-right whitespace-nowrap">Lãi đóng góp Organic</th>
                )}
                <th className="py-2 pl-3 text-right whitespace-nowrap">Kế hoạch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allProfilesSummary.map(({ profile, computed }) => {
                const isSelected = profile.id === activeProfile.id;
                return (
                  <tr
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td
                      title={profile.name}
                      className="py-2.5 pr-3 max-w-[190px] truncate font-medium text-slate-900"
                    >
                      {profile.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {profile.sellerType === 'ctv' ? 'CTV' : 'Nhân viên'}
                    </td>
                    <td
                      title={profile.region}
                      className="py-2.5 px-3 max-w-[125px] truncate text-slate-600"
                    >
                      {profile.region}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num whitespace-nowrap">
                      {formatNumber(computed.totalMonthlyQty)} đv
                    </td>
                    <td className="py-2.5 px-3 text-right font-num whitespace-nowrap">
                      {formatVnd(computed.totalGrossRevenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num text-emerald-700 whitespace-nowrap">
                      {formatVnd(computed.totalCommission + computed.totalAllBonuses)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num whitespace-nowrap">
                      {formatVnd(computed.fixedSalaryAndAllowance)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-num font-semibold text-slate-900 whitespace-nowrap">
                      {formatVnd(computed.grossIncome)}
                    </td>
                    {isExecutive && (
                      <td
                        className={`py-2.5 px-3 text-right font-num font-semibold whitespace-nowrap ${
                          computed.organicContribution >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {formatVnd(computed.organicContribution)}
                      </td>
                    )}
                    <td className="py-2.5 pl-3 text-right text-xs whitespace-nowrap">
                      {profile.appliedToPlan ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đã áp dụng
                        </span>
                      ) : (
                        <span className="text-slate-400">Mô phỏng</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Disclaimer for Printable / Shareable Summary (Section IX) */}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <strong>Lưu ý chính sách:</strong> Thu nhập dự kiến theo sản lượng và chính sách giả định, không phải cam kết thu nhập. Số liệu mô phỏng cá nhân không tự động tính vào doanh thu hay chi phí chính thức của công ty cho đến khi Ban điều hành áp dụng vào kế hoạch.
      </div>

      {/* Mode B Application Modal */}
      {applyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Áp dụng hồ sơ "{activeProfile.name}" vào kế hoạch tài chính
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Hệ thống sẽ cập nhật sản lượng kênh{' '}
              <strong>{CHANNEL_LABELS[activeProfile.channelId]}</strong> và giữ nguyên cơ chế chống tính trùng hoa hồng/lương cố định trên P&L.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700">
                  Phạm vi tháng áp dụng
                </label>
                <select
                  value={applyMonth}
                  onChange={(e) => setApplyMonth(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value={0}>Cả 12 tháng trong năm kế hoạch</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Chỉ áp dụng cho Tháng {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="block font-medium text-slate-700">
                  Phương thức xử lý sản lượng hiện có trên kênh
                </span>
                <label className="flex items-start gap-2 rounded border border-slate-200 p-2.5">
                  <input
                    type="radio"
                    name="applyMode"
                    checked={applyMode === 'replace'}
                    onChange={() => setApplyMode('replace')}
                    className="mt-0.5 accent-emerald-700"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Thay thế phân bổ hiện tại (Khuyến nghị tránh cộng trùng)
                    </div>
                    <div className="text-slate-500">
                      Ghi đè sản lượng tháng của kênh tương ứng bằng sản lượng từ hồ sơ này.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-2 rounded border border-slate-200 p-2.5">
                  <input
                    type="radio"
                    name="applyMode"
                    checked={applyMode === 'add'}
                    onChange={() => setApplyMode('add')}
                    className="mt-0.5 accent-emerald-700"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Bổ sung sản lượng (Cộng thêm vào kênh)
                    </div>
                    <div className="text-amber-700">
                      Cảnh báo: Chỉ chọn nếu sản lượng cá nhân này chưa nằm trong kế hoạch kênh chung.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyToPlan}
                className="rounded-md bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
              >
                Xác nhận áp dụng vào P&L
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTargetId !== null}
        title="Xác nhận xóa hồ sơ mô phỏng"
        description={`Bạn có chắc muốn xóa hồ sơ "${activeProfile.name}"?`}
        confirmLabel="Xóa hồ sơ"
        destructive
        onConfirm={() => {
          const nextList = profiles.filter((p) => p.id !== deleteTargetId);
          onUpdateScenario((prev) => ({
            ...prev,
            salesProfiles: nextList,
          }));
          setSelectedProfileId(nextList[0]?.id || '');
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
};
