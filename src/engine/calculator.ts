import {
  AssetItem,
  ChannelId,
  ChannelPlanItem,
  ComputedChannelLineMonthly,
  ComputedChannelSummary,
  ComputedMarketingSummary,
  ComputedMonthlyCashFlow,
  ComputedMonthlyPnl,
  ComputedProductCogs,
  ComputedScenarioResult,
  ComputedStoreSummary,
  DataStatus,
  LocationItem,
  MarketingCampaign,
  OperatingCostItem,
  ProductItem,
  ScenarioData,
  SensitivityInput,
  StaffMember,
  SystemWarning,
} from '../types/finance';
import { CHANNEL_LABELS, isUnconfirmedStatus } from '../utils/format';

function isScheduleActive(
  frequency: OperatingCostItem['frequency'],
  startMonth: number,
  endMonth: number,
  month: number
): boolean {
  const s = Math.max(1, Math.min(12, Math.round(startMonth || 1)));
  const e = Math.max(s, Math.min(12, Math.round(endMonth || 12)));
  if (month < s || month > e) return false;
  switch (frequency) {
    case 'once':
      return month === s;
    case 'monthly':
      return true;
    case 'quarterly':
      return (month - s) % 3 === 0;
    case 'yearly':
      return (month - s) % 12 === 0;
    default:
      return false;
  }
}

export function computeProductCogs(product: ProductItem): ComputedProductCogs {
  const count = Math.max(0, product.plannedInputCount || 0);
  const avgLive = Math.max(0, product.avgLiveWeightKg || 0);
  const recovery = Math.max(0, Math.min(1, product.recoveryRate || 0));
  const commercialWaste = Math.max(0, Math.min(0.99, product.commercialWasteRate || 0));

  let effectiveLiveKgCost = Math.max(0, product.purchasePricePerLiveKg || 0);
  if (product.supplyType === 'self_farmed' && product.selfFarmedCosts) {
    const sf = product.selfFarmedCosts;
    const batchTotalFarmCost =
      Math.max(0, sf.chickCost) +
      Math.max(0, sf.feedCost) +
      Math.max(0, sf.herbCost) +
      Math.max(0, sf.vetMedicineCost) +
      Math.max(0, sf.directFarmLaborCost) +
      Math.max(0, sf.utilitiesBeddingCost) +
      Math.max(0, sf.coopOpsCost) +
      Math.max(0, sf.farmDepreciationCost) +
      Math.max(0, sf.farmOverheadCost) +
      Math.max(0, sf.mortalityLossCost) +
      Math.max(0, sf.otherFarmCost);
    effectiveLiveKgCost =
      sf.batchStandardLiveKg > 0 ? batchTotalFarmCost / sf.batchStandardLiveKg : 0;
  }

  // Formula 01
  const batchLiveWeightKg = count * avgLive;
  // Formula 02
  const rawMaterialCostBatch = batchLiveWeightKg * effectiveLiveKgCost;
  const rawMaterialPerInputUnit = avgLive * effectiveLiveKgCost;

  // Formula 03
  const finishedWeightBatchKg = batchLiveWeightKg * recovery;
  // Formula 04
  const sellableWeightBatchKg = finishedWeightBatchKg * (1 - commercialWaste);

  // Formula 05 (excludes customer delivery & sales commission!)
  const processingPerUnit =
    Math.max(0, product.inboundTransportPerUnit || 0) +
    Math.max(0, product.slaughterCostPerUnit || 0) +
    Math.max(0, product.processingCostPerUnit || 0) +
    Math.max(0, product.packagingMaterialPerUnit || 0) +
    Math.max(0, product.packingLaborPerUnit || 0) +
    Math.max(0, product.variableStoragePerUnit || 0) +
    Math.max(0, product.otherDirectProdPerUnit || 0) +
    Math.max(0, product.allocatedProdOverheadPerUnit || 0);

  const processingTotalBatch = count * processingPerUnit;
  const totalCogsBatch = rawMaterialCostBatch + processingTotalBatch;

  // Formula 06 & 07
  const hasZeroFinishedWarning = count > 0 && finishedWeightBatchKg <= 0;
  const cogsPerFinishedKg =
    finishedWeightBatchKg > 0 ? totalCogsBatch / finishedWeightBatchKg : null;
  const cogsPerInputUnit = count > 0 ? totalCogsBatch / count : null;

  let cogsPerSellUnit: number | null = null;
  if (product.pricingUnit === 'per_kg_finished') {
    cogsPerSellUnit =
      sellableWeightBatchKg > 0 ? totalCogsBatch / sellableWeightBatchKg : null;
  } else if (product.pricingUnit === 'per_head') {
    const sellableHeads = count * (1 - commercialWaste);
    cogsPerSellUnit = sellableHeads > 0 ? totalCogsBatch / sellableHeads : null;
  } else {
    const sellableUnits = count * recovery * (1 - commercialWaste);
    cogsPerSellUnit = sellableUnits > 0 ? totalCogsBatch / sellableUnits : null;
  }

  // Formula 08
  let grossRevenueSampleBatch = 0;
  let sampleUnitSellRevenue = 0;
  if (product.pricingUnit === 'per_kg_finished') {
    grossRevenueSampleBatch = sellableWeightBatchKg * Math.max(0, product.targetSellPrice || 0);
    sampleUnitSellRevenue =
      avgLive * recovery * (1 - commercialWaste) * Math.max(0, product.targetSellPrice || 0);
  } else if (product.pricingUnit === 'per_head') {
    const sellableHeads = count * (1 - commercialWaste);
    grossRevenueSampleBatch = sellableHeads * Math.max(0, product.targetSellPrice || 0);
    sampleUnitSellRevenue = (1 - commercialWaste) * Math.max(0, product.targetSellPrice || 0);
  } else {
    const sellableUnits = count * recovery * (1 - commercialWaste);
    grossRevenueSampleBatch = sellableUnits * Math.max(0, product.targetSellPrice || 0);
    sampleUnitSellRevenue =
      recovery * (1 - commercialWaste) * Math.max(0, product.targetSellPrice || 0);
  }

  const netUnitPrice = product.priceIncludesVat
    ? product.targetSellPrice / (1 + Math.max(0, product.vatRate || 0))
    : product.targetSellPrice;
  const hasBelowCostWarning =
    cogsPerSellUnit !== null && netUnitPrice > 0 && netUnitPrice < cogsPerSellUnit;

  return {
    productId: product.id,
    liveWeightPerUnitKg: avgLive,
    batchLiveWeightKg,
    effectiveLiveKgCost,
    rawMaterialCostBatch,
    rawMaterialPerInputUnit,
    finishedWeightBatchKg,
    sellableWeightBatchKg,
    processingTotalBatch,
    totalCogsBatch,
    cogsPerFinishedKg,
    cogsPerInputUnit,
    cogsPerSellUnit,
    grossRevenueSampleBatch,
    sampleUnitSellRevenue,
    hasZeroFinishedWarning,
    hasBelowCostWarning,
  };
}

export function getCampaignCost(c: MarketingCampaign): number {
  const detailSum =
    Math.max(0, c.adSpend || 0) +
    Math.max(0, c.contentCost || 0) +
    Math.max(0, c.videoCost || 0) +
    Math.max(0, c.designCost || 0) +
    Math.max(0, c.posmCost || 0) +
    Math.max(0, c.samplingCost || 0) +
    Math.max(0, c.posDevCost || 0);
  return detailSum > 0 ? detailSum : Math.max(0, c.allocatedBudget || c.totalBudget || 0);
}

export function computeScenario(
  scenario: ScenarioData,
  sensitivity?: SensitivityInput
): ComputedScenarioResult {
  const warnings: SystemWarning[] = [];

  // Apply optional sensitivity simulation cleanly onto a cloned working view without mutating stored data
  const purchaseMult = 1 + (sensitivity?.purchasePriceDeltaPct || 0) / 100;
  const sellMult = 1 + (sensitivity?.sellPriceDeltaPct || 0) / 100;
  const recoveryDelta = (sensitivity?.recoveryRateDeltaPctPoints || 0) / 100;
  const volumeMult = Math.max(0, 1 + (sensitivity?.volumeDeltaPct || 0) / 100);
  const commDelta = (sensitivity?.commissionDeltaPctPoints || 0) / 100;
  const mktMult = Math.max(0, 1 + (sensitivity?.marketingDeltaPct || 0) / 100);
  const hrMult = Math.max(0, 1 + (sensitivity?.hrDeltaPct || 0) / 100);
  const extraStores = sensitivity?.extraStoresCount || 0;
  const capexMult = Math.max(0, 1 + (sensitivity?.capexDeltaPct || 0) / 100);

  // 1. Compute Product COGS
  const productCogsMap: Record<string, ComputedProductCogs> = {};
  const productMap: Record<string, ProductItem> = {};

  for (const rawProd of scenario.products) {
    const adjustedProd: ProductItem = {
      ...rawProd,
      purchasePricePerLiveKg: rawProd.purchasePricePerLiveKg * purchaseMult,
      recoveryRate: Math.max(0.05, Math.min(1, rawProd.recoveryRate + recoveryDelta)),
      targetSellPrice: rawProd.targetSellPrice * sellMult,
    };
    productMap[adjustedProd.id] = adjustedProd;
    const cogsResult = computeProductCogs(adjustedProd);
    productCogsMap[adjustedProd.id] = cogsResult;

    if (adjustedProd.recoveryRate <= 0 || adjustedProd.recoveryRate > 1) {
      warnings.push({
        id: `warn-rec-${adjustedProd.id}`,
        severity: 'error',
        category: 'Tỷ lệ thu hồi',
        message: `Sản phẩm "${adjustedProd.name}" có tỷ lệ thu hồi không hợp lệ (${(
          adjustedProd.recoveryRate * 100
        ).toFixed(1)}%).`,
      });
    }
    if (cogsResult.hasZeroFinishedWarning) {
      warnings.push({
        id: `warn-zero-${adjustedProd.id}`,
        severity: 'error',
        category: 'Giá vốn thành phẩm',
        message: `Sản phẩm "${adjustedProd.name}" có khối lượng thành phẩm bằng 0, không thể chia giá vốn.`,
      });
    }
    if (cogsResult.hasBelowCostWarning) {
      warnings.push({
        id: `warn-belowcost-${adjustedProd.id}`,
        severity: 'warning',
        category: 'Giá bán < Giá thành',
        message: `Sản phẩm "${adjustedProd.name}" có giá bán mục tiêu thấp hơn giá vốn/đơn vị bán.`,
      });
    }
  }

  // 2. Compute Channel Line Monthly Results (Formulas 09 - 24)
  const monthlyLineItems: ComputedChannelLineMonthly[] = [];
  const channelAccum: Record<
    ChannelId,
    {
      volume: number;
      grossRevenue: number;
      netRevenue: number;
      cogs: number;
      variableSellingCost: number;
      contributionMargin: number;
    }
  > = {
    direct: { volume: 0, grossRevenue: 0, netRevenue: 0, cogs: 0, variableSellingCost: 0, contributionMargin: 0 },
    ctv: { volume: 0, grossRevenue: 0, netRevenue: 0, cogs: 0, variableSellingCost: 0, contributionMargin: 0 },
    agency: { volume: 0, grossRevenue: 0, netRevenue: 0, cogs: 0, variableSellingCost: 0, contributionMargin: 0 },
    store: { volume: 0, grossRevenue: 0, netRevenue: 0, cogs: 0, variableSellingCost: 0, contributionMargin: 0 },
    b2b: { volume: 0, grossRevenue: 0, netRevenue: 0, cogs: 0, variableSellingCost: 0, contributionMargin: 0 },
    internal_transfer: { volume: 0, grossRevenue: 0, netRevenue: 0, cogs: 0, variableSellingCost: 0, contributionMargin: 0 },
  };

  let rewardOverCapCount = 0;

  for (const plan of scenario.channelPlans) {
    const prod = productMap[plan.productId];
    const prodCogs = productCogsMap[plan.productId];
    const unitCogs = prodCogs?.cogsPerSellUnit ?? 0;

    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const month = mIdx + 1;
      const baseVol = Math.max(0, plan.monthlyVolumes[mIdx] || 0);
      const volume = baseVol * volumeMult;
      const sellPrice = Math.max(0, plan.sellPrice || 0) * sellMult;

      // Formula 09
      const grossRevenue = volume * sellPrice;
      // Formula 10
      const tradeDiscount = grossRevenue * Math.max(0, Math.min(1, plan.discountRate || 0));
      const returnsValue = volume > 0 ? Math.max(0, plan.monthlyReturnsValue || 0) : 0;
      const revenueDeductions = tradeDiscount + returnsValue;
      // Formula 11
      const netBeforeVat = Math.max(0, grossRevenue - revenueDeductions);
      const vatRate = prod?.priceIncludesVat ? Math.max(0, prod.vatRate || 0) : 0;
      const netRevenue = vatRate > 0 ? netBeforeVat / (1 + vatRate) : netBeforeVat;

      // Formula 12 & 13
      const cogs = volume * unitCogs;
      const grossProfit = netRevenue - cogs;

      // Variable selling costs BEFORE CTV commission
      const paymentFee = netRevenue * Math.max(0, plan.paymentFeePct || 0);
      const unitVarSelling =
        Math.max(0, plan.orderStaffBonusPerUnit || 0) +
        Math.max(0, plan.deliveryCostPerUnit || 0) +
        Math.max(0, plan.customerServicePerUnit || 0) +
        Math.max(0, plan.promoAsExpensePerUnit || 0) +
        Math.max(0, plan.otherVariablePerUnit || 0);
      const allocatedVar = volume > 0 ? Math.max(0, plan.allocatedChannelVarMonthly || 0) : 0;
      const baseVarSelling = volume * unitVarSelling + paymentFee + allocatedVar;

      const cmBeforeCommission = netRevenue - cogs - baseVarSelling;

      // Formulas 20, 21, 22
      let ctvCommission = 0;
      if (volume > 0) {
        if (plan.commissionMethod === 'fixed_per_unit') {
          ctvCommission = volume * Math.max(0, plan.commissionValue * (1 + commDelta));
        } else if (plan.commissionMethod === 'pct_net_revenue') {
          const rate = Math.max(0, Math.min(1, plan.commissionValue + commDelta));
          ctvCommission = netRevenue * rate;
        } else {
          const rate = Math.max(0, Math.min(1, plan.commissionValue + commDelta));
          ctvCommission =
            cmBeforeCommission > 0
              ? cmBeforeCommission * rate
              : Math.max(0, plan.guaranteedMinCommission || 0);
        }
      }

      // Formula 23
      const extraBonuses =
        volume > 0
          ? Math.max(0, plan.kpiBonusMonthly || 0) +
            Math.max(0, plan.newCustomerBonusMonthly || 0) +
            Math.max(0, plan.repeatCustomerBonusMonthly || 0) +
            Math.max(0, plan.otherBonusMonthly || 0)
          : 0;
      const totalSalesReward = ctvCommission + extraBonuses;

      // Formula 24
      const maxRewardCap =
        cmBeforeCommission > 0
          ? cmBeforeCommission * Math.max(0, plan.maxRewardBudgetPct || 0)
          : 0;
      const rewardOverCapAmount =
        plan.maxRewardBudgetPct > 0 && totalSalesReward > maxRewardCap
          ? totalSalesReward - maxRewardCap
          : 0;
      if (rewardOverCapAmount > 1) {
        rewardOverCapCount++;
      }

      // Formula 14 & 15
      const variableSellingCost = baseVarSelling + totalSalesReward;
      const contributionMargin = netRevenue - cogs - variableSellingCost;
      const cmMarginPct = netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : null;
      const cmPerUnit = volume > 0 ? contributionMargin / volume : null;

      monthlyLineItems.push({
        planId: plan.id,
        productId: plan.productId,
        channelId: plan.channelId,
        month,
        isInternalTransfer: plan.isInternalTransfer || plan.channelId === 'internal_transfer',
        volume,
        sellPrice,
        grossRevenue,
        tradeDiscount,
        returnsValue,
        revenueDeductions,
        netRevenue,
        unitCogs,
        cogs,
        grossProfit,
        cmBeforeCommission,
        ctvCommission,
        totalSalesReward,
        maxRewardCap,
        rewardOverCapAmount,
        variableSellingCost,
        contributionMargin,
        cmMarginPct,
        cmPerUnit,
      });

      if (!plan.isInternalTransfer && plan.channelId !== 'internal_transfer') {
        const acc = channelAccum[plan.channelId];
        acc.volume += volume;
        acc.grossRevenue += grossRevenue;
        acc.netRevenue += netRevenue;
        acc.cogs += cogs;
        acc.variableSellingCost += variableSellingCost;
        acc.contributionMargin += contributionMargin;
      }
    }
  }

  if (rewardOverCapCount > 0) {
    warnings.push({
      id: 'warn-reward-cap',
      severity: 'warning',
      category: 'Trần thưởng CTV/Bán hàng',
      message: `Có ${rewardOverCapCount} dòng kế hoạch tháng vượt trần ngân sách thưởng tối đa (Công thức 24).`,
    });
  }

  // Anti-double-counting & allocation checks on Operating Costs
  let cogsOverlapDetected = false;
  let hrOverlapDetected = false;
  let ctvOverlapDetected = false;
  const activeHrDepts = new Set(
    scenario.staff.filter((s) => s.includeInPnl && s.headcount > 0).map((s) => s.department)
  );
  const allocationByCostCenter: Record<string, number> = {};

  for (const cost of scenario.operatingCosts) {
    if (!cost.includeInPnl || cost.isMemoAllocationOnly) continue;
    const lowerName = cost.name.toLowerCase();
    if (cost.accountingClass === 'cogs') {
      cogsOverlapDetected = true;
    }
    if (
      (lowerName.includes('lương') || lowerName.includes('nhân sự')) &&
      activeHrDepts.size > 0 &&
      cost.group !== 'Nhân sự'
    ) {
      hrOverlapDetected = true;
    }
    if (
      (lowerName.includes('hoa hồng') || lowerName.includes('ctv')) &&
      scenario.channelPlans.some((p) => p.commissionValue > 0)
    ) {
      ctvOverlapDetected = true;
    }
    if (cost.costCenter && cost.allocationPct > 0 && cost.allocationPct < 100) {
      allocationByCostCenter[cost.costCenter] =
        (allocationByCostCenter[cost.costCenter] || 0) + cost.allocationPct;
    }
  }

  if (cogsOverlapDetected) {
    warnings.push({
      id: 'warn-dup-cogs',
      severity: 'warning',
      category: 'Chống tính trùng',
      message:
        'Có khoản chi phí hoạt động đang phân loại vào Giá vốn (COGS). Kiểm tra để tránh tính trùng với Giá vốn sản phẩm.',
    });
  }
  if (hrOverlapDetected) {
    warnings.push({
      id: 'warn-dup-hr',
      severity: 'warning',
      category: 'Chống tính trùng',
      message:
        'Phát hiện mục chi phí có từ khóa "Lương/Nhân sự" ngoài bảng Nhân sự. Đảm bảo không cộng trùng lương Marketing/Bán hàng.',
    });
  }
  if (ctvOverlapDetected) {
    warnings.push({
      id: 'warn-dup-ctv',
      severity: 'warning',
      category: 'Chống tính trùng',
      message:
        'Phát hiện mục chi phí Hoa hồng/CTV trong Chi phí hoạt động trong khi Hoa hồng CTV đã trừ tại Lãi đóng góp kênh.',
    });
  }
  for (const [center, sumPct] of Object.entries(allocationByCostCenter)) {
    if (sumPct > 100.01) {
      warnings.push({
        id: `warn-alloc-${center}`,
        severity: 'error',
        category: 'Phân bổ chi phí > 100%',
        message: `Trung tâm chi phí "${center}" có tổng tỷ lệ phân bổ ${sumPct.toFixed(1)}% (> 100%).`,
      });
    }
  }

  // Over-budget check on Operating Costs
  for (const cost of scenario.operatingCosts) {
    if (cost.includeInPnl && cost.monthlyBudgetLimit > 0) {
      const amt = cost.quantity * cost.unitPrice;
      if (amt > cost.monthlyBudgetLimit) {
        warnings.push({
          id: `warn-budget-${cost.id}`,
          severity: 'warning',
          category: 'Vượt ngân sách',
          message: `Khoản "${cost.name}" (${amt.toLocaleString('vi-VN')}đ) vượt ngân sách tháng (${cost.monthlyBudgetLimit.toLocaleString('vi-VN')}đ).`,
        });
      }
    }
  }

  // Calculate average single store monthly fixed cost for extraStores sensitivity
  const activeStores = scenario.locations.filter((l) => l.type === 'store' && l.isActive);
  const avgStoreMonthlyFixed =
    activeStores.length > 0
      ? activeStores.reduce(
          (s, l) =>
            s +
            l.monthlyRent +
            l.monthlyFixedPayroll +
            l.monthlyUtilities +
            l.monthlyInternet +
            l.monthlyMaintenance +
            l.monthlyOtherFixed,
          0
        ) / activeStores.length
      : 45_000_000;

  // 3. Monthly P&L (Months 1..12)
  const monthlyPnl: ComputedMonthlyPnl[] = [];
  const monthlyHrCash: number[] = [];
  const monthlyMktMediaCash: number[] = [];
  const monthlyAdminStoreOtherCash: number[] = [];
  const monthlyExtraCogsCost: number[] = [];

  for (let m = 1; m <= 12; m++) {
    const extLines = monthlyLineItems.filter(
      (l) => l.month === m && !l.isInternalTransfer
    );

    const soldVolumeTotal = extLines.reduce((s, l) => s + l.volume, 0);
    const grossRevenue = extLines.reduce((s, l) => s + l.grossRevenue, 0);
    const revenueDeductions = extLines.reduce((s, l) => s + l.revenueDeductions, 0);
    const netRevenue = extLines.reduce((s, l) => s + l.netRevenue, 0);
    let cogs = extLines.reduce((s, l) => s + l.cogs, 0);
    const variableSellingCost = extLines.reduce((s, l) => s + l.variableSellingCost, 0);

    // Fixed & Operating Costs by P&L bucket
    let fixedSellingCost = 0;
    let marketingCost = 0;
    let mediaCost = 0;
    let adminCost = 0;
    let otherFixedOpCost = 0;
    let financialExpenseFromOps = 0;
    let hrTotalForCash = 0;
    let extraCogsOp = 0;

    // 3a. Staff / HR (Formula 25)
    for (const st of scenario.staff) {
      if (!st.includeInPnl) continue;
      if (m < st.startMonth || m > st.endMonth) continue;
      const lineHr =
        (Math.max(0, st.headcount) *
          (Math.max(0, st.baseSalary) +
            Math.max(0, st.allowance) +
            Math.max(0, st.insuranceEmployer) +
            Math.max(0, st.otherFixedHr)) +
          Math.max(0, st.periodicSalesBonus)) *
        hrMult;

      hrTotalForCash += lineHr;
      if (st.department === 'Kinh doanh') {
        fixedSellingCost += lineHr;
      } else if (st.department === 'Marketing') {
        marketingCost += lineHr;
      } else if (st.department === 'Cửa hàng' || st.department === 'Kho & Logistics' || st.department === 'Vận hành') {
        otherFixedOpCost += lineHr;
      } else {
        adminCost += lineHr;
      }
    }

    // 3b. Operating Cost Lines (Formulas 26 - 30)
    for (const oc of scenario.operatingCosts) {
      if (!oc.includeInPnl || oc.isMemoAllocationOnly) continue;
      if (!isScheduleActive(oc.frequency, oc.startMonth, oc.endMonth, m)) continue;

      const baseAmt =
        oc.costBehavior === 'variable'
          ? soldVolumeTotal * Math.max(0, oc.variableRatePerUnit || 0)
          : Math.max(0, oc.quantity || 0) * Math.max(0, oc.unitPrice || 0);
      const amt = baseAmt * (oc.group === 'Marketing' || oc.group === 'Truyền thông' ? mktMult : 1);

      if (oc.accountingClass === 'cogs') {
        extraCogsOp += amt;
        cogs += amt;
      } else if (oc.accountingClass === 'selling_fixed') {
        fixedSellingCost += amt;
      } else if (oc.accountingClass === 'marketing') {
        marketingCost += amt;
      } else if (oc.accountingClass === 'media') {
        mediaCost += amt;
      } else if (oc.accountingClass === 'admin') {
        adminCost += amt;
      } else if (oc.accountingClass === 'financial') {
        financialExpenseFromOps += amt;
      } else {
        otherFixedOpCost += amt;
      }
    }

    // 3c. Marketing Campaigns (when includeInPnl = true)
    for (const mc of scenario.marketingCampaigns) {
      if (!mc.includeInPnl) continue;
      const appliesThisMonth = mc.month === 0 || mc.month === m;
      if (!appliesThisMonth) continue;
      const cost = getCampaignCost(mc) * mktMult;
      if (mc.pillar === 'brand') {
        mediaCost += cost;
      } else {
        marketingCost += cost;
      }
    }

    // 3d. Locations (Stores, Offices, Warehouses)
    for (const loc of scenario.locations) {
      if (!loc.isActive || m < loc.openMonth) continue;
      const locFixed =
        Math.max(0, loc.monthlyRent) +
        Math.max(0, loc.monthlyFixedPayroll) +
        Math.max(0, loc.monthlyUtilities) +
        Math.max(0, loc.monthlyInternet) +
        Math.max(0, loc.monthlyMaintenance) +
        Math.max(0, loc.monthlyOtherFixed);
      if (loc.type === 'office') {
        adminCost += locFixed;
      } else {
        otherFixedOpCost += locFixed;
      }
      hrTotalForCash += Math.max(0, loc.monthlyFixedPayroll);
    }

    // Extra stores sensitivity
    if (extraStores !== 0) {
      otherFixedOpCost = Math.max(0, otherFixedOpCost + extraStores * avgStoreMonthlyFixed);
    }

    // 3e. Assets Depreciation & Asset Op/Maintenance (Formula 32)
    let depreciationCost = 0;
    for (const asset of scenario.assets) {
      const capex = Math.max(0, asset.quantity) * Math.max(0, asset.unitPrice) * capexMult;
      const inSvc = Math.max(1, Math.min(12, Math.round(asset.inServiceMonth || 1)));
      if (m >= inSvc) {
        otherFixedOpCost +=
          Math.max(0, asset.monthlyFixedOpCost || 0) +
          Math.max(0, asset.monthlyMaintenanceCost || 0);

        if (
          asset.isDepreciable &&
          asset.depreciableMonths > 0 &&
          m < inSvc + asset.depreciableMonths
        ) {
          const depreciableBase = Math.max(0, capex - Math.max(0, asset.salvageValue || 0));
          depreciationCost += depreciableBase / asset.depreciableMonths;
        }
      }
    }

    const grossProfit = netRevenue - cogs;
    const contributionMargin = netRevenue - cogs - variableSellingCost;
    const totalFixedOperatingCost =
      fixedSellingCost +
      marketingCost +
      mediaCost +
      adminCost +
      otherFixedOpCost +
      depreciationCost;

    // Formula 41
    const operatingProfit = contributionMargin - totalFixedOperatingCost;

    // Formula 42
    const mIdx = m - 1;
    const otherInc = Math.max(0, scenario.assumptions.otherIncomeByMonth[mIdx] || 0);
    const otherExp = Math.max(0, scenario.assumptions.otherExpenseByMonth[mIdx] || 0);
    const loanInt = Math.max(0, scenario.assumptions.loanInterestByMonth[mIdx] || 0);
    const financialAndOtherNet = otherInc - otherExp - loanInt - financialExpenseFromOps;
    const profitBeforeTax = operatingProfit + financialAndOtherNet;

    // Formula 43
    const taxableIncome = profitBeforeTax + (scenario.assumptions.taxAdjustmentMonthly || 0);
    const estimatedCit =
      taxableIncome > 0
        ? taxableIncome * Math.max(0, Math.min(1, scenario.assumptions.citRate || 0))
        : 0;

    // Formula 44, 45, 46
    const netProfit = profitBeforeTax - estimatedCit;
    const netMarginPct = netRevenue > 0 ? (netProfit / netRevenue) * 100 : null;
    const operatingMarginPct = netRevenue > 0 ? (operatingProfit / netRevenue) * 100 : null;
    const profitPerUnit = soldVolumeTotal > 0 ? netProfit / soldVolumeTotal : null;

    monthlyPnl.push({
      month: m,
      soldVolumeTotal,
      grossRevenue,
      revenueDeductions,
      netRevenue,
      cogs,
      grossProfit,
      variableSellingCost,
      contributionMargin,
      fixedSellingCost,
      marketingCost,
      mediaCost,
      adminCost,
      otherFixedOpCost,
      depreciationCost,
      totalFixedOperatingCost,
      operatingProfit,
      financialAndOtherNet,
      profitBeforeTax,
      estimatedCit,
      netProfit,
      netMarginPct,
      operatingMarginPct,
      profitPerUnit,
    });

    // Cash buckets (excluding non-cash depreciation, and avoiding double-count of HR/Mkt)
    monthlyHrCash.push(hrTotalForCash);
    monthlyMktMediaCash.push(marketingCost + mediaCost);
    const totalCashOpExExcludingHrMktDepr = Math.max(
      0,
      totalFixedOperatingCost - depreciationCost - (marketingCost + mediaCost)
    );
    // Subtract HR that was already counted in fixedSelling/admin/otherFixedOp
    const nonStoreHr = scenario.staff
      .filter((st) => st.includeInPnl && m >= st.startMonth && m <= st.endMonth && st.department !== 'Marketing')
      .reduce(
        (s, st) =>
          s +
          (st.headcount *
            (st.baseSalary + st.allowance + st.insuranceEmployer + st.otherFixedHr) +
            st.periodicSalesBonus) *
            hrMult,
        0
      );
    const storeHr = scenario.locations
      .filter((l) => l.isActive && m >= l.openMonth)
      .reduce((s, l) => s + l.monthlyFixedPayroll, 0);
    monthlyAdminStoreOtherCash.push(
      Math.max(0, totalCashOpExExcludingHrMktDepr - nonStoreHr - storeHr)
    );
    monthlyExtraCogsCost.push(extraCogsOp);
  }

  // Annual P&L rollup
  const annualPnl: ComputedMonthlyPnl = monthlyPnl.reduce(
    (acc, cur) => ({
      month: 0,
      soldVolumeTotal: acc.soldVolumeTotal + cur.soldVolumeTotal,
      grossRevenue: acc.grossRevenue + cur.grossRevenue,
      revenueDeductions: acc.revenueDeductions + cur.revenueDeductions,
      netRevenue: acc.netRevenue + cur.netRevenue,
      cogs: acc.cogs + cur.cogs,
      grossProfit: acc.grossProfit + cur.grossProfit,
      variableSellingCost: acc.variableSellingCost + cur.variableSellingCost,
      contributionMargin: acc.contributionMargin + cur.contributionMargin,
      fixedSellingCost: acc.fixedSellingCost + cur.fixedSellingCost,
      marketingCost: acc.marketingCost + cur.marketingCost,
      mediaCost: acc.mediaCost + cur.mediaCost,
      adminCost: acc.adminCost + cur.adminCost,
      otherFixedOpCost: acc.otherFixedOpCost + cur.otherFixedOpCost,
      depreciationCost: acc.depreciationCost + cur.depreciationCost,
      totalFixedOperatingCost: acc.totalFixedOperatingCost + cur.totalFixedOperatingCost,
      operatingProfit: acc.operatingProfit + cur.operatingProfit,
      financialAndOtherNet: acc.financialAndOtherNet + cur.financialAndOtherNet,
      profitBeforeTax: acc.profitBeforeTax + cur.profitBeforeTax,
      estimatedCit: acc.estimatedCit + cur.estimatedCit,
      netProfit: acc.netProfit + cur.netProfit,
      netMarginPct: null,
      operatingMarginPct: null,
      profitPerUnit: null,
    }),
    {
      month: 0,
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
  annualPnl.netMarginPct =
    annualPnl.netRevenue > 0 ? (annualPnl.netProfit / annualPnl.netRevenue) * 100 : null;
  annualPnl.operatingMarginPct =
    annualPnl.netRevenue > 0 ? (annualPnl.operatingProfit / annualPnl.netRevenue) * 100 : null;
  annualPnl.profitPerUnit =
    annualPnl.soldVolumeTotal > 0 ? annualPnl.netProfit / annualPnl.soldVolumeTotal : null;

  // 4. Cash Flow Statement (Formulas 51 - 57)
  const monthlyCashFlow: ComputedMonthlyCashFlow[] = [];
  const immColl = Math.max(0, Math.min(1, scenario.assumptions.immediateCollectionPct ?? 1));
  const arDelay = Math.max(0, Math.min(3, Math.round(scenario.assumptions.arDelayMonths || 0)));
  const immPay = Math.max(0, Math.min(1, scenario.assumptions.immediateSupplierPayPct ?? 1));
  const apDelay = Math.max(0, Math.min(3, Math.round(scenario.assumptions.apDelayMonths || 0)));

  const arReceipts = new Array(12).fill(0);
  const apPayments = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const rev = monthlyPnl[i].netRevenue;
    arReceipts[i] += rev * immColl;
    if (i + arDelay < 12) {
      arReceipts[i + arDelay] += rev * (1 - immColl);
    }

    const supCost = monthlyPnl[i].cogs;
    apPayments[i] += supCost * immPay;
    if (i + apDelay < 12) {
      apPayments[i + apDelay] += supCost * (1 - immPay);
    }
  }

  let runningCash = scenario.assumptions.openingCash || 0;
  let lowestEndingCash = Infinity;
  let lowestCashMonth: number | null = null;

  for (let i = 0; i < 12; i++) {
    const month = i + 1;
    const openingCash = runningCash;
    const pnl = monthlyPnl[i];

    // Formula 51 & 52
    const customerReceipts = arReceipts[i];
    const supplierPayments = apPayments[i];
    const hrCashOut = monthlyHrCash[i];
    // Note: subtract Marketing HR from marketingMediaCashOut if already counted in hrCashOut to avoid cash double count!
    const mktHrThisMonth = scenario.staff
      .filter((st) => st.includeInPnl && month >= st.startMonth && month <= st.endMonth && st.department === 'Marketing')
      .reduce(
        (s, st) =>
          s +
          (st.headcount *
            (st.baseSalary + st.allowance + st.insuranceEmployer + st.otherFixedHr) +
            st.periodicSalesBonus) *
            hrMult,
        0
      );
    const marketingMediaCashOut = Math.max(0, monthlyMktMediaCash[i] - mktHrThisMonth);
    const adminStoreOtherCashOut = monthlyAdminStoreOtherCash[i] + pnl.variableSellingCost;
    const taxCashOut = pnl.estimatedCit;

    // Formula 53
    const operatingCashFlow =
      customerReceipts -
      (supplierPayments + hrCashOut + marketingMediaCashOut + adminStoreOtherCashOut + taxCashOut);

    // Formula 54: CapEx recorded at paymentMonth!
    const capexCashOut = scenario.assets
      .filter((a) => Math.max(1, Math.min(12, Math.round(a.paymentMonth || 1))) === month)
      .reduce((s, a) => s + Math.max(0, a.quantity) * Math.max(0, a.unitPrice) * capexMult, 0);
    const assetDisposalInflow = Math.max(0, scenario.assumptions.assetDisposalInflowByMonth[i] || 0);
    const investingCashFlow = assetDisposalInflow - capexCashOut;

    // Formula 55
    const loanDrawdown = Math.max(0, scenario.assumptions.loanDrawdownByMonth[i] || 0);
    const equityInjection = Math.max(0, scenario.assumptions.equityInjectionByMonth[i] || 0);
    const loanPrincipalRepayment = Math.max(
      0,
      scenario.assumptions.loanPrincipalRepaymentByMonth[i] || 0
    );
    const loanInterestOut = Math.max(0, scenario.assumptions.loanInterestByMonth[i] || 0);
    const dividendOutflow = Math.max(0, scenario.assumptions.dividendOutflowByMonth[i] || 0);
    const financingCashFlow =
      loanDrawdown + equityInjection - loanPrincipalRepayment - loanInterestOut - dividendOutflow;

    // Formula 56
    const endingCash = openingCash + operatingCashFlow + investingCashFlow + financingCashFlow;
    runningCash = endingCash;

    if (endingCash < lowestEndingCash) {
      lowestEndingCash = endingCash;
      lowestCashMonth = month;
    }

    if (endingCash < 0) {
      warnings.push({
        id: `warn-cash-${month}`,
        severity: 'error',
        category: 'Dòng tiền âm',
        month,
        message: `Tháng ${month} dự kiến thiếu hụt tiền mặt (${Math.round(endingCash).toLocaleString('vi-VN')} đ).`,
      });
    }

    monthlyCashFlow.push({
      month,
      openingCash,
      customerReceipts,
      supplierPayments,
      hrCashOut,
      marketingMediaCashOut,
      adminStoreOtherCashOut,
      taxCashOut,
      operatingCashFlow,
      assetDisposalInflow,
      capexCashOut,
      investingCashFlow,
      loanDrawdown,
      equityInjection,
      loanPrincipalRepayment,
      loanInterestOut,
      dividendOutflow,
      financingCashFlow,
      endingCash,
    });
  }

  // Formula 57
  const additionalCapitalNeeded = lowestEndingCash < 0 ? Math.abs(lowestEndingCash) : 0;
  const minReserve = Math.max(0, scenario.assumptions.minCashReserve || 0);
  const additionalCapitalWithReserve =
    lowestEndingCash < minReserve ? minReserve - lowestEndingCash : 0;

  // 5. Channel Summaries
  const channelSummaries: ComputedChannelSummary[] = (
    ['direct', 'ctv', 'agency', 'store', 'b2b'] as ChannelId[]
  ).map((cid) => {
    const acc = channelAccum[cid];
    return {
      channelId: cid,
      channelName: CHANNEL_LABELS[cid],
      volume: acc.volume,
      grossRevenue: acc.grossRevenue,
      netRevenue: acc.netRevenue,
      cogs: acc.cogs,
      variableSellingCost: acc.variableSellingCost,
      contributionMargin: acc.contributionMargin,
      cmMarginPct: acc.netRevenue > 0 ? (acc.contributionMargin / acc.netRevenue) * 100 : null,
      cmPerUnit: acc.volume > 0 ? acc.contributionMargin / acc.volume : null,
    };
  });

  // 6. Cost Structure Breakdown
  const totalCostsForChart =
    annualPnl.cogs +
    annualPnl.variableSellingCost +
    annualPnl.fixedSellingCost +
    annualPnl.marketingCost +
    annualPnl.mediaCost +
    annualPnl.adminCost +
    annualPnl.otherFixedOpCost +
    annualPnl.depreciationCost;

  const rawBuckets = [
    { label: 'Giá vốn hàng bán (COGS)', amount: annualPnl.cogs },
    { label: 'Bán hàng biến đổi & Hoa hồng', amount: annualPnl.variableSellingCost },
    { label: 'Vận hành & Điểm bán cố định', amount: annualPnl.otherFixedOpCost + annualPnl.fixedSellingCost },
    { label: 'Marketing & Truyền thông', amount: annualPnl.marketingCost + annualPnl.mediaCost },
    { label: 'Quản lý doanh nghiệp', amount: annualPnl.adminCost },
    { label: 'Khấu hao phân bổ', amount: annualPnl.depreciationCost },
  ];

  const costStructure = rawBuckets.map((b) => ({
    label: b.label,
    amount: b.amount,
    pct: totalCostsForChart > 0 ? (b.amount / totalCostsForChart) * 100 : 0,
  }));

  // 7. Total CapEx
  const totalCapex = scenario.assets.reduce(
    (s, a) => s + Math.max(0, a.quantity) * Math.max(0, a.unitPrice) * capexMult,
    0
  );

  // 8. Break-Even & Margin of Safety (Formulas 47 - 50)
  const plannedAnnualUnits = annualPnl.soldVolumeTotal;
  const weightedAvgCmPerUnit =
    plannedAnnualUnits > 0 ? annualPnl.contributionMargin / plannedAnnualUnits : null;
  const weightedCmRatio =
    annualPnl.netRevenue > 0 ? annualPnl.contributionMargin / annualPnl.netRevenue : null;
  const annualFixedCosts = annualPnl.totalFixedOperatingCost;
  const monthlyAvgFixedCosts = annualFixedCosts / 12;

  const breakEvenUnitsAnnual =
    weightedAvgCmPerUnit !== null && weightedAvgCmPerUnit > 0
      ? annualFixedCosts / weightedAvgCmPerUnit
      : null;
  const breakEvenUnitsMonthly =
    breakEvenUnitsAnnual !== null ? breakEvenUnitsAnnual / 12 : null;
  const breakEvenRevenueAnnual =
    weightedCmRatio !== null && weightedCmRatio > 0
      ? annualFixedCosts / weightedCmRatio
      : null;
  const marginOfSafetyPct =
    breakEvenUnitsAnnual !== null && plannedAnnualUnits > 0
      ? ((plannedAnnualUnits - breakEvenUnitsAnnual) / plannedAnnualUnits) * 100
      : null;

  if (breakEvenUnitsAnnual !== null && plannedAnnualUnits < breakEvenUnitsAnnual) {
    warnings.push({
      id: 'warn-breakeven',
      severity: 'warning',
      category: 'Chưa đủ hòa vốn',
      message: `Sản lượng kế hoạch (${Math.round(plannedAnnualUnits).toLocaleString(
        'vi-VN'
      )}) thấp hơn sản lượng hòa vốn (${Math.round(breakEvenUnitsAnnual).toLocaleString(
        'vi-VN'
      )}).`,
    });
  }
  if (annualPnl.contributionMargin <= 0) {
    warnings.push({
      id: 'warn-cm-neg',
      severity: 'error',
      category: 'Lãi đóng góp âm',
      message: `Tổng lãi đóng góp cả năm đang ≤ 0 (${Math.round(
        annualPnl.contributionMargin
      ).toLocaleString('vi-VN')} đ).`,
    });
  }
  if (annualPnl.operatingProfit < 0) {
    warnings.push({
      id: 'warn-ebit-neg',
      severity: 'warning',
      category: 'Lợi nhuận âm',
      message: `Lợi nhuận hoạt động dự kiến đang âm (${Math.round(
        annualPnl.operatingProfit
      ).toLocaleString('vi-VN')} đ).`,
    });
  }

  // 9. Store / Location P&L Summaries (Formulas 33 - 35)
  const storeChannelCm = channelAccum.store.contributionMargin;
  const storeChannelVol = channelAccum.store.volume;
  const storeChannelCmPerUnit = storeChannelVol > 0 ? storeChannelCm / storeChannelVol : 0;
  const annualAdminPool = annualPnl.adminCost;

  const storeSummaries: ComputedStoreSummary[] = scenario.locations.map((loc) => {
    const activeMonths = loc.isActive ? Math.max(0, 13 - Math.max(1, loc.openMonth)) : 0;
    const directMonthly =
      Math.max(0, loc.monthlyRent) +
      Math.max(0, loc.monthlyFixedPayroll) +
      Math.max(0, loc.monthlyUtilities) +
      Math.max(0, loc.monthlyInternet) +
      Math.max(0, loc.monthlyMaintenance) +
      Math.max(0, loc.monthlyOtherFixed);
    const annualDirectFixedCost = directMonthly * activeMonths;

    // Asset depreciation belonging to this location
    let annualAssetDepreciation = 0;
    for (const a of scenario.assets) {
      if (a.locationId !== loc.id || !a.isDepreciable || a.depreciableMonths <= 0) continue;
      const capex = Math.max(0, a.quantity) * Math.max(0, a.unitPrice) * capexMult;
      const monthlyDepr = Math.max(0, capex - Math.max(0, a.salvageValue || 0)) / a.depreciableMonths;
      const start = Math.max(1, Math.min(12, a.inServiceMonth));
      const monthsInYear = Math.min(a.depreciableMonths, 13 - start);
      annualAssetDepreciation += monthlyDepr * Math.max(0, monthsInYear);
    }

    const share = Math.max(0, Math.min(1, (loc.storeRevenueSharePct || 0) / 100));
    const annualContributionMargin = loc.type === 'store' ? storeChannelCm * share : 0;
    const annualAllocatedSharedCost =
      annualAdminPool * Math.max(0, Math.min(1, (loc.allocatedSharedCostPct || 0) / 100));

    const annualProfitBeforeAlloc =
      annualContributionMargin - (annualDirectFixedCost + annualAssetDepreciation);
    const annualProfitAfterAlloc = annualProfitBeforeAlloc - annualAllocatedSharedCost;
    const monthlyAvgFixedCost =
      activeMonths > 0 ? (annualDirectFixedCost + annualAssetDepreciation) / activeMonths : 0;
    const breakEvenUnitsMonthly =
      loc.type === 'store' && storeChannelCmPerUnit > 0
        ? monthlyAvgFixedCost / storeChannelCmPerUnit
        : null;

    return {
      locationId: loc.id,
      name: loc.name,
      type: loc.type,
      annualContributionMargin,
      annualDirectFixedCost,
      annualAssetDepreciation,
      annualAllocatedSharedCost,
      annualProfitBeforeAlloc,
      annualProfitAfterAlloc,
      monthlyAvgFixedCost,
      breakEvenUnitsMonthly,
    };
  });

  // 10. Marketing Campaign Summaries (Formulas 36 - 40)
  const marketingSummaries: ComputedMarketingSummary[] = scenario.marketingCampaigns.map((mc) => {
    const mult = mc.month === 0 ? 12 : 1;
    const totalCost = getCampaignCost(mc) * mktMult * mult;
    const adSpend = Math.max(0, mc.adSpend || 0) * mktMult * mult;
    const orders = Math.max(0, mc.orders || 0) * mult;
    const newCust = Math.max(0, mc.newCustomers || 0) * mult;
    const leads = Math.max(0, mc.leads || 0) * mult;
    const attrRev = Math.max(0, mc.attributedRevenue || 0) * mult;
    const attrCm = Math.max(0, mc.attributedCmBeforeMkt || 0) * mult;

    const costPerOrder = orders > 0 ? totalCost / orders : null;
    const cac = newCust > 0 ? totalCost / newCust : null;
    const conversionRatePct = leads > 0 ? (newCust / leads) * 100 : null;
    const roas = adSpend > 0 ? attrRev / adSpend : null;
    const contributionEffect = attrCm - totalCost;
    const overBudgetAmount =
      mc.totalBudget > 0 && getCampaignCost(mc) > mc.totalBudget
        ? getCampaignCost(mc) - mc.totalBudget
        : 0;

    return {
      campaignId: mc.id,
      name: mc.name,
      pillar: mc.pillar,
      totalCost,
      adSpend,
      costPerOrder,
      cac,
      conversionRatePct,
      roas,
      contributionEffect,
      overBudgetAmount,
    };
  });

  // 11. Data Governance & Unconfirmed Parameters Count
  const allStatuses: DataStatus[] = [
    ...scenario.products.map((p) => p.status),
    ...scenario.channelPlans.map((c) => c.status),
    ...scenario.staff.map((s) => s.status),
    ...scenario.operatingCosts.map((o) => o.status),
    ...scenario.assets.map((a) => a.status),
    ...scenario.locations.map((l) => l.status),
    ...scenario.marketingCampaigns.map((m) => m.status),
    scenario.assumptions.status,
  ];

  const unenteredCount = allStatuses.filter((s) => s === 'unentered').length;
  const assumedCount = allStatuses.filter((s) => s === 'assumed').length;
  const quotedCount = allStatuses.filter((s) => s === 'quoted').length;
  const confirmedCount = allStatuses.filter((s) => s === 'confirmed').length;
  const approvedCount = allStatuses.filter((s) => s === 'approved').length;
  const unconfirmedCount = allStatuses.filter((s) => isUnconfirmedStatus(s)).length;

  if (unconfirmedCount > 0) {
    warnings.push({
      id: 'warn-unconfirmed',
      severity: 'info',
      category: 'Trạng thái dữ liệu',
      message: `Kế hoạch hiện đang sử dụng ${unconfirmedCount}/${allStatuses.length} thông số chưa xác nhận (Chưa nhập / Giả định / Báo giá).`,
    });
  }

  return {
    scenarioId: scenario.id,
    productCogsMap,
    monthlyLineItems,
    monthlyPnl,
    annualPnl,
    monthlyCashFlow,
    annualCashFlow: {
      openingCash: monthlyCashFlow[0]?.openingCash ?? 0,
      operatingCashFlow: monthlyCashFlow.reduce((s, c) => s + c.operatingCashFlow, 0),
      investingCashFlow: monthlyCashFlow.reduce((s, c) => s + c.investingCashFlow, 0),
      financingCashFlow: monthlyCashFlow.reduce((s, c) => s + c.financingCashFlow, 0),
      endingCash: monthlyCashFlow[11]?.endingCash ?? 0,
      lowestEndingCash: Number.isFinite(lowestEndingCash) ? lowestEndingCash : 0,
      lowestCashMonth,
      additionalCapitalNeeded,
      additionalCapitalWithReserve,
    },
    channelSummaries,
    costStructure,
    totalCapex,
    breakEven: {
      weightedAvgCmPerUnit,
      weightedCmRatio,
      monthlyAvgFixedCosts,
      annualFixedCosts,
      breakEvenUnitsMonthly,
      breakEvenUnitsAnnual,
      breakEvenRevenueAnnual,
      marginOfSafetyPct,
      plannedAnnualUnits,
    },
    storeSummaries,
    marketingSummaries,
    dataGovernance: {
      totalTrackedItems: allStatuses.length,
      unconfirmedCount,
      confirmedCount: confirmedCount + approvedCount,
      unenteredCount,
      assumedCount,
      quotedCount,
      approvedCount,
    },
    warnings,
  };
}
