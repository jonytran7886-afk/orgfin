import {
  ComputedProductCogs,
  ComputedSalesItemResult,
  ComputedSalesProfileResult,
  ProductItem,
  SalesProfile,
  SalesProfileProductItem,
  ScenarioData,
  TargetIncomeSolverResult,
  VolumeBonusMode,
  VolumeBonusTier,
} from '../types/finance';
import { computeProductCogs } from './calculator';

export function computeVolumeBonus(
  qty: number,
  mode: VolumeBonusMode,
  tiers: VolumeBonusTier[]
): number {
  if (qty <= 0 || mode === 'none' || tiers.length === 0) return 0;

  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  if (mode === 'threshold_fixed') {
    let best = 0;
    for (const t of sorted) {
      if (qty >= t.minQty) {
        best = Math.max(0, t.fixedBonus);
      }
    }
    return best;
  }

  if (mode === 'tier_whole') {
    let activeTier: VolumeBonusTier | null = null;
    for (const t of sorted) {
      if (qty >= t.minQty) {
        activeTier = t;
      }
    }
    return activeTier ? qty * Math.max(0, activeTier.ratePerUnit) : 0;
  }

  // tier_progressive: lũy tiến từng bậc
  const oneBased = sorted[0].minQty === 1;
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const start = i === 0 ? 0 : oneBased ? t.minQty - 1 : t.minQty;
    const nextTier = sorted[i + 1];
    const end = nextTier
      ? oneBased
        ? nextTier.minQty - 1
        : nextTier.minQty
      : Infinity;
    const unitsInBracket = Math.max(0, Math.min(qty, end) - start);
    total += unitsInBracket * Math.max(0, t.ratePerUnit);
  }
  return total;
}

export function getFinishedWeightPerHead(product: ProductItem): number {
  if (product.pricingUnit === 'per_kg_finished') {
    return (
      Math.max(0, product.avgLiveWeightKg || 0) *
      Math.max(0, Math.min(1, product.recoveryRate || 0)) *
      (1 - Math.max(0, Math.min(0.99, product.commercialWasteRate || 0)))
    );
  }
  return 1;
}

export function computeSalesProfile(
  profile: SalesProfile,
  scenario: ScenarioData,
  precomputedCogsMap?: Record<string, ComputedProductCogs>
): {
  summary: ComputedSalesProfileResult;
  items: ComputedSalesItemResult[];
} {
  const sellingDays = Math.max(1, profile.sellingDaysPerMonth || 26);
  const productMap: Record<string, ProductItem> = {};
  const cogsMap: Record<string, ComputedProductCogs> = precomputedCogsMap
    ? { ...precomputedCogsMap }
    : {};

  for (const p of scenario.products) {
    productMap[p.id] = p;
    if (!cogsMap[p.id]) {
      cogsMap[p.id] = computeProductCogs(p);
    }
  }

  const itemResults: ComputedSalesItemResult[] = [];
  let totalMonthlyQty = 0;
  let totalGrossRevenue = 0;
  let totalNetRevenue = 0;
  let totalCogs = 0;
  let totalVariableSellingBeforeComm = 0;
  let totalCommission = 0;

  for (const item of profile.items) {
    const product = productMap[item.productId];
    if (!product) continue;
    const prodCogs = cogsMap[product.id];
    const matchedPlan =
      scenario.channelPlans.find(
        (cp) => cp.productId === product.id && cp.channelId === profile.channelId
      ) ??
      scenario.channelPlans.find(
        (cp) => cp.productId === product.id && !cp.isInternalTransfer
      );

    // Formula 01: Không cộng trùng daily và monthly
    const monthlyInputQty =
      item.inputMode === 'daily'
        ? Math.max(0, item.dailyQty) * sellingDays
        : Math.max(0, item.monthlyQty);
    const dailyAvgQty = monthlyInputQty / sellingDays;

    // Formula 02: Quy đổi đơn vị bán (con -> kg thành phẩm nếu bán theo kg thành phẩm)
    const conversionFactor =
      item.sellingUnitBasis === 'per_head' && product.pricingUnit === 'per_kg_finished'
        ? getFinishedWeightPerHead(product)
        : 1;
    const revenueEquivalentQty = monthlyInputQty * conversionFactor;

    const unitSellPrice = item.usePolicyPrice
      ? Math.max(0, matchedPlan?.sellPrice ?? product.targetSellPrice)
      : Math.max(0, item.overrideSellPrice);

    const grossRevenue = revenueEquivalentQty * unitSellPrice;
    const discountRate = matchedPlan ? Math.max(0, Math.min(1, matchedPlan.discountRate)) : 0;
    const netBeforeVat = grossRevenue * (1 - discountRate);
    const netRevenue = product.priceIncludesVat
      ? netBeforeVat / (1 + Math.max(0, product.vatRate || 0))
      : netBeforeVat;

    // COGS & Variable Selling Costs (shared with Calculator Engine)
    const unitCogs = prodCogs?.cogsPerSellUnit ?? 0;
    const cogs = revenueEquivalentQty * unitCogs;

    const unitVarSelling = matchedPlan
      ? Math.max(0, matchedPlan.orderStaffBonusPerUnit || 0) +
        Math.max(0, matchedPlan.deliveryCostPerUnit || 0) +
        Math.max(0, matchedPlan.customerServicePerUnit || 0) +
        Math.max(0, matchedPlan.promoAsExpensePerUnit || 0) +
        Math.max(0, matchedPlan.otherVariablePerUnit || 0)
      : 0;
    const paymentFee = netRevenue * (matchedPlan?.paymentFeePct ?? 0);
    const variableSellingCostBeforeComm = revenueEquivalentQty * unitVarSelling + paymentFee;
    const contributionBeforeComm = netRevenue - cogs - variableSellingCostBeforeComm;

    // Formulas 04, 05, 06, 07
    const effMethod =
      item.commissionMethod === 'use_policy'
        ? matchedPlan?.commissionMethod ?? 'fixed_per_unit'
        : item.commissionMethod;
    const effRate =
      item.commissionMethod === 'use_policy'
        ? matchedPlan?.commissionValue ?? 0
        : item.commissionValue;

    let commission = 0;
    if (effMethod === 'fixed_per_unit') {
      commission = monthlyInputQty * Math.max(0, effRate);
    } else if (effMethod === 'pct_net_revenue') {
      commission = netRevenue * Math.max(0, Math.min(1, effRate));
    } else {
      commission = Math.max(0, contributionBeforeComm) * Math.max(0, Math.min(1, effRate));
    }

    itemResults.push({
      itemId: item.id,
      productId: product.id,
      productName: product.name,
      monthlyInputQty,
      dailyAvgQty,
      revenueEquivalentQty,
      sellUnitLabel: product.sellUnit,
      inputUnitLabel:
        item.sellingUnitBasis === 'per_head' ? product.inputUnit : product.sellUnit,
      unitSellPrice,
      grossRevenue,
      netRevenue,
      cogs,
      variableSellingCostBeforeComm,
      contributionBeforeComm,
      commission,
    });

    totalMonthlyQty += monthlyInputQty;
    totalGrossRevenue += grossRevenue;
    totalNetRevenue += netRevenue;
    totalCogs += cogs;
    totalVariableSellingBeforeComm += variableSellingCostBeforeComm;
    totalCommission += commission;
  }

  // Formula 08: Volume bonus
  const volumeBonus = computeVolumeBonus(
    totalMonthlyQty,
    profile.volumeBonusMode,
    profile.volumeBonusTiers
  );

  // Formula 09: KPI completion & bonus
  let kpiCompletionPct: number | null = null;
  let kpiBonus = 0;
  if (profile.kpiTargetValue > 0) {
    let actualMetric = totalMonthlyQty;
    if (profile.kpiTargetMetric === 'revenue') {
      actualMetric = totalNetRevenue;
    } else if (profile.kpiTargetMetric === 'contribution') {
      actualMetric =
        totalNetRevenue - totalCogs - totalVariableSellingBeforeComm - totalCommission;
    } else if (profile.kpiTargetMetric === 'new_customers') {
      actualMetric = profile.newCustomersCount;
    }
    kpiCompletionPct = (actualMetric / profile.kpiTargetValue) * 100;
    if (kpiCompletionPct >= 100) {
      const extraPct = Math.max(0, kpiCompletionPct - 100);
      kpiBonus =
        Math.max(0, profile.kpiBonusAt100) +
        extraPct * Math.max(0, profile.kpiExtraPerPctOver100);
    }
  }

  // Formulas 10 & 11
  const newCustomerBonus =
    Math.max(0, profile.newCustomersCount) * Math.max(0, profile.newCustomerBonusPerUnit);
  const repeatCustomerBonus =
    Math.max(0, profile.repeatCustomersCount) *
    Math.max(0, profile.repeatCustomerBonusPerUnit);
  const otherBonus = Math.max(0, profile.otherBonus);

  const totalAllBonuses =
    volumeBonus + kpiBonus + newCustomerBonus + repeatCustomerBonus + otherBonus;

  // Formulas 12 & 13
  const fixedSalaryAndAllowance =
    profile.sellerType === 'staff'
      ? Math.max(0, profile.baseSalary) + Math.max(0, profile.allowances)
      : 0;
  const grossIncome = fixedSalaryAndAllowance + totalCommission + totalAllBonuses;

  // Formula 14: Deductions only when configured
  let estimatedDeductions = 0;
  let estimatedNetIncome: number | null = null;
  if (profile.hasDeductionConfig) {
    const rateSum =
      Math.max(0, profile.taxWithholdingRate) +
      Math.max(0, profile.employeeInsuranceRate);
    estimatedDeductions =
      grossIncome * Math.min(0.8, rateSum) + Math.max(0, profile.otherDeductions);
    estimatedNetIncome = Math.max(0, grossIncome - estimatedDeductions);
  }

  // Formula 15: Company Selling Cost
  const companySellingCost =
    grossIncome +
    (profile.sellerType === 'staff'
      ? Math.max(0, profile.employerInsurance) + Math.max(0, profile.otherEmployerCost)
      : 0);

  // Formula 16: Organic Contribution Margin (excluding fixed salary)
  const organicContribution =
    totalNetRevenue -
    totalCogs -
    totalVariableSellingBeforeComm -
    totalCommission -
    totalAllBonuses;

  // Formula 17: Organic Allocated Profit (memo analytics)
  const organicAllocatedProfit =
    organicContribution - Math.max(0, profile.allocatedFixedOpCostMonthly || 0);

  return {
    summary: {
      profileId: profile.id,
      totalMonthlyQty,
      totalDailyAvgQty: totalMonthlyQty / sellingDays,
      totalGrossRevenue,
      totalNetRevenue,
      totalCogs,
      totalVariableSellingBeforeComm,
      totalCommission,
      volumeBonus,
      kpiCompletionPct,
      kpiBonus,
      newCustomerBonus,
      repeatCustomerBonus,
      otherBonus,
      totalAllBonuses,
      fixedSalaryAndAllowance,
      grossIncome,
      estimatedDeductions,
      estimatedNetIncome,
      companySellingCost,
      organicContribution,
      organicAllocatedProfit,
    },
    items: itemResults,
  };
}

function buildScaledProfileForTotalQty(
  profile: SalesProfile,
  totalQ: number
): SalesProfile {
  const cloned = structuredClone(profile);
  const currentWeights = cloned.items.map((it) =>
    Math.max(
      0,
      it.inputMode === 'daily'
        ? it.dailyQty * Math.max(1, cloned.sellingDaysPerMonth)
        : it.monthlyQty
    )
  );
  const sumW = currentWeights.reduce((s, w) => s + w, 0);

  cloned.items = cloned.items.map((it, idx) => {
    const share = sumW > 0 ? currentWeights[idx] / sumW : idx === 0 ? 1 : 0;
    const allocatedQ =
      idx === cloned.items.length - 1
        ? Math.max(
            0,
            totalQ -
              cloned.items
                .slice(0, idx)
                .reduce(
                  (acc, _, j) =>
                    acc +
                    Math.round(
                      totalQ * (sumW > 0 ? currentWeights[j] / sumW : j === 0 ? 1 : 0)
                    ),
                  0
                )
          )
        : Math.round(totalQ * share);

    return {
      ...it,
      inputMode: 'monthly',
      monthlyQty: allocatedQ,
    };
  });
  return cloned;
}

export function solveTargetIncome(
  profile: SalesProfile,
  scenario: ScenarioData,
  targetIncome: number,
  maxSearchQty = 200000
): TargetIncomeSolverResult {
  const sellingDays = Math.max(1, profile.sellingDaysPerMonth || 26);

  if (profile.items.length === 0) {
    return {
      targetIncome,
      feasible: false,
      reasonIfInfeasible: 'Hồ sơ chưa có sản phẩm nào để tính sản lượng mục tiêu.',
      requiredMonthlyQty: 0,
      requiredDailyAvgQty: 0,
      roundedUpDailyQty: 0,
      recalculatedMonthlyFromDaily: 0,
      resultingRevenue: 0,
      resultingCommission: 0,
      resultingBonuses: 0,
      resultingFixedIncome: 0,
      resultingGrossIncome: 0,
    };
  }

  const evalAt = (q: number) =>
    computeSalesProfile(buildScaledProfileForTotalQty(profile, q), scenario).summary;

  const atZero = evalAt(0);
  if (atZero.grossIncome >= targetIncome) {
    return {
      targetIncome,
      feasible: true,
      reasonIfInfeasible: '',
      requiredMonthlyQty: 0,
      requiredDailyAvgQty: 0,
      roundedUpDailyQty: 0,
      recalculatedMonthlyFromDaily: 0,
      resultingRevenue: atZero.totalGrossRevenue,
      resultingCommission: atZero.totalCommission,
      resultingBonuses: atZero.totalAllBonuses,
      resultingFixedIncome: atZero.fixedSalaryAndAllowance,
      resultingGrossIncome: atZero.grossIncome,
    };
  }

  const atMax = evalAt(maxSearchQty);
  if (atMax.grossIncome < targetIncome) {
    return {
      targetIncome,
      feasible: false,
      reasonIfInfeasible:
        atMax.grossIncome <= atZero.grossIncome
          ? 'Chính sách hiện tại có hoa hồng và thưởng theo sản lượng bằng 0 nên không thể tăng thu nhập theo sản lượng.'
          : `Mục tiêu vượt quá giới hạn mô phỏng (${maxSearchQty.toLocaleString(
              'vi-VN'
            )} đơn vị/tháng -> tối đa ${Math.round(atMax.grossIncome).toLocaleString(
              'vi-VN'
            )} đ).`,
      requiredMonthlyQty: maxSearchQty,
      requiredDailyAvgQty: maxSearchQty / sellingDays,
      roundedUpDailyQty: Math.ceil(maxSearchQty / sellingDays),
      recalculatedMonthlyFromDaily: Math.ceil(maxSearchQty / sellingDays) * sellingDays,
      resultingRevenue: atMax.totalGrossRevenue,
      resultingCommission: atMax.totalCommission,
      resultingBonuses: atMax.totalAllBonuses,
      resultingFixedIncome: atMax.fixedSalaryAndAllowance,
      resultingGrossIncome: atMax.grossIncome,
    };
  }

  // Binary search (with local downward verify for any non-monotonic cliff edge)
  let lo = 1;
  let hi = maxSearchQty;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (evalAt(mid).grossIncome >= targetIncome) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  // Verify exact smallest integer Q
  let bestQ = lo;
  for (let q = Math.max(1, lo - 5); q <= lo; q++) {
    if (evalAt(q).grossIncome >= targetIncome) {
      bestQ = q;
      break;
    }
  }

  const res = evalAt(bestQ);
  const reqDaily = bestQ / sellingDays;
  const roundedUpDaily = Math.ceil(reqDaily);

  return {
    targetIncome,
    feasible: true,
    reasonIfInfeasible: '',
    requiredMonthlyQty: bestQ,
    requiredDailyAvgQty: reqDaily,
    roundedUpDailyQty: roundedUpDaily,
    recalculatedMonthlyFromDaily: roundedUpDaily * sellingDays,
    resultingRevenue: res.totalGrossRevenue,
    resultingCommission: res.totalCommission,
    resultingBonuses: res.totalAllBonuses,
    resultingFixedIncome: res.fixedSalaryAndAllowance,
    resultingGrossIncome: res.grossIncome,
  };
}

export interface IncomeCurvePoint {
  dailyQty: number;
  monthlyQty: number;
  ctvIncome: number;
  staffIncome: number;
  revenue: number;
  organicContribution: number;
}

export function buildIncomePotentialCurve(
  profile: SalesProfile,
  scenario: ScenarioData,
  dailyStops: number[] = [0, 5, 10, 15, 20, 30, 50]
): IncomeCurvePoint[] {
  const sellingDays = Math.max(1, profile.sellingDaysPerMonth || 26);

  // Include tier boundary daily equivalents so step-jumps appear accurately if tiered bonus is active
  const stopSet = new Set(dailyStops);
  if (profile.volumeBonusMode !== 'none') {
    for (const t of profile.volumeBonusTiers) {
      const d = Number((t.minQty / sellingDays).toFixed(2));
      if (d > 0 && d <= 60) {
        stopSet.add(d);
      }
    }
  }
  const sortedStops = Array.from(stopSet).sort((a, b) => a - b);

  return sortedStops.map((daily) => {
    const monthlyQ = Math.round(daily * sellingDays);
    const scaledBase = buildScaledProfileForTotalQty(profile, monthlyQ);

    const ctvVariant: SalesProfile = {
      ...scaledBase,
      sellerType: 'ctv',
      baseSalary: 0,
      allowances: 0,
    };
    const staffVariant: SalesProfile = {
      ...scaledBase,
      sellerType: 'staff',
      baseSalary: profile.baseSalary > 0 ? profile.baseSalary : 7000000,
    };

    const ctvRes = computeSalesProfile(ctvVariant, scenario).summary;
    const staffRes = computeSalesProfile(staffVariant, scenario).summary;
    const activeRes = profile.sellerType === 'ctv' ? ctvRes : staffRes;

    return {
      dailyQty: daily,
      monthlyQty: monthlyQ,
      ctvIncome: ctvRes.grossIncome,
      staffIncome: staffRes.grossIncome,
      revenue: activeRes.totalGrossRevenue,
      organicContribution: activeRes.organicContribution,
    };
  });
}

export function applyProfileToScenarioPlan(
  prev: ScenarioData,
  profile: SalesProfile,
  mode: 'replace' | 'add',
  targetMonth: number // 0 = 12 tháng, 1..12 = tháng cụ thể
): ScenarioData {
  const next = structuredClone(prev);
  const { items } = computeSalesProfile(profile, next);

  // 1. Update or add ChannelPlans for each product in the profile
  for (const itemRes of items) {
    const prod = next.products.find((p) => p.id === itemRes.productId);
    if (!prod) continue;
    const profItem = profile.items.find((it) => it.id === itemRes.itemId);
    const volInSellUnits = Math.round(itemRes.revenueEquivalentQty);

    const existingIdx = next.channelPlans.findIndex(
      (cp) => cp.productId === prod.id && cp.channelId === profile.channelId
    );

    const effCommMethod =
      profItem && profItem.commissionMethod !== 'use_policy'
        ? profItem.commissionMethod
        : existingIdx >= 0
        ? next.channelPlans[existingIdx].commissionMethod
        : 'fixed_per_unit';

    // Convert per-head commission to per-sell-unit if product is priced per kg finished
    const conversionFactor =
      profItem?.sellingUnitBasis === 'per_head' && prod.pricingUnit === 'per_kg_finished'
        ? getFinishedWeightPerHead(prod)
        : 1;
    const rawCommVal =
      profItem && profItem.commissionMethod !== 'use_policy'
        ? profItem.commissionValue
        : existingIdx >= 0
        ? next.channelPlans[existingIdx].commissionValue
        : 0;
    const normalizedCommVal =
      effCommMethod === 'fixed_per_unit' && conversionFactor > 0
        ? rawCommVal / conversionFactor
        : rawCommVal;

    if (existingIdx >= 0) {
      const targetPlan = next.channelPlans[existingIdx];
      const nextVols = [...targetPlan.monthlyVolumes];
      for (let m = 0; m < 12; m++) {
        if (targetMonth === 0 || targetMonth === m + 1) {
          nextVols[m] = mode === 'replace' ? volInSellUnits : nextVols[m] + volInSellUnits;
        }
      }
      targetPlan.monthlyVolumes = nextVols;
      targetPlan.sellPrice = itemRes.unitSellPrice;
      targetPlan.commissionMethod = effCommMethod;
      targetPlan.commissionValue = normalizedCommVal;
      targetPlan.updatedAt = new Date().toISOString().slice(0, 10);
      targetPlan.note = `Cập nhật từ hồ sơ mô phỏng ${profile.name} (${
        mode === 'replace' ? 'Thay thế' : 'Bổ sung'
      }).`;
    } else {
      const monthlyVolumes = new Array(12).fill(0).map((_, idx) =>
        targetMonth === 0 || targetMonth === idx + 1 ? volInSellUnits : 0
      );
      next.channelPlans.push({
        id: `KB-SIM-${profile.id}-${prod.id}`,
        productId: prod.id,
        channelId: profile.channelId,
        isInternalTransfer: false,
        monthlyVolumes,
        sellPrice: itemRes.unitSellPrice,
        discountRate: 0,
        monthlyReturnsValue: 0,
        commissionMethod: effCommMethod,
        commissionValue: normalizedCommVal,
        kpiBonusMonthly: 0,
        newCustomerBonusMonthly: 0,
        repeatCustomerBonusMonthly: 0,
        otherBonusMonthly: 0,
        maxRewardBudgetPct: 0.45,
        guaranteedMinCommission: 0,
        orderStaffBonusPerUnit: 0,
        deliveryCostPerUnit: 8000,
        paymentFeePct: 0.01,
        customerServicePerUnit: 1000,
        promoAsExpensePerUnit: 0,
        otherVariablePerUnit: 0,
        allocatedChannelVarMonthly: 0,
        status: 'assumed',
        source: `Áp dụng từ mô phỏng: ${profile.name}`,
        updatedAt: new Date().toISOString().slice(0, 10),
        owner: profile.name,
        note: 'Tạo tự động từ Chế độ B – Áp dụng vào kế hoạch.',
      });
    }
  }

  // 2. If staff with fixed salary, link ONCE into Staff list (anti-double-counting!)
  if (profile.sellerType === 'staff' && profile.baseSalary > 0) {
    const staffId = `NS-SIM-${profile.id}`;
    const existingStaffIdx = next.staff.findIndex((s) => s.id === staffId);
    const staffEntry = {
      id: staffId,
      roleTitle: `${profile.name} (Áp dụng từ mô phỏng)`,
      department: 'Kinh doanh' as const,
      headcount: 1,
      baseSalary: profile.baseSalary,
      allowance: profile.allowances,
      insuranceEmployer: profile.employerInsurance,
      otherFixedHr: profile.otherEmployerCost,
      periodicSalesBonus: 0, // Hoa hồng biến đổi đã nằm trong Kênh bán, không cộng trùng!
      startMonth: targetMonth === 0 ? 1 : targetMonth,
      endMonth: targetMonth === 0 ? 12 : targetMonth,
      includeInPnl: true,
      status: profile.approvalState === 'approved' ? ('approved' as const) : ('assumed' as const),
      source: `Áp dụng từ mô phỏng: ${profile.name}`,
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: profile.name,
      note: 'Chỉ đưa lương & phụ cấp cố định; hoa hồng theo đơn nằm tại Kênh bán (chống tính trùng).',
    };
    if (existingStaffIdx >= 0) {
      next.staff[existingStaffIdx] = staffEntry;
    } else if (mode === 'add') {
      next.staff.push(staffEntry);
    }
  }

  // 3. Mark profile as applied
  next.salesProfiles = (next.salesProfiles || []).map((sp) =>
    sp.id === profile.id
      ? {
          ...sp,
          appliedToPlan: true,
          appliedMode: mode,
          appliedMonth: targetMonth,
        }
      : sp
  );

  return next;
}
