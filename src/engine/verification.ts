import { createDefaultPlannerState } from '../data/defaultPlan';
import { ScenarioData } from '../types/finance';
import { computeProductCogs, computeScenario } from './calculator';
import {
  applyProfileToScenarioPlan,
  computeSalesProfile,
  computeVolumeBonus,
  solveTargetIncome,
} from './salesIncome';

export interface VerificationTestResult {
  id: string;
  title: string;
  expected: string;
  actual: string;
  passed: boolean;
}

function makeMinimalScenario(): ScenarioData {
  const base = createDefaultPlannerState().scenarios.base;
  return {
    ...structuredClone(base),
    products: [],
    channelPlans: [],
    staff: [],
    operatingCosts: [],
    assets: [],
    locations: [],
    marketingCampaigns: [],
    assumptions: {
      ...base.assumptions,
      openingCash: 100_000_000,
      minCashReserve: 0,
      immediateCollectionPct: 1,
      arDelayMonths: 0,
      immediateSupplierPayPct: 1,
      apDelayMonths: 0,
      citRate: 0,
      taxAdjustmentMonthly: 0,
      otherIncomeByMonth: new Array(12).fill(0),
      otherExpenseByMonth: new Array(12).fill(0),
      equityInjectionByMonth: new Array(12).fill(0),
      loanDrawdownByMonth: new Array(12).fill(0),
      loanPrincipalRepaymentByMonth: new Array(12).fill(0),
      loanInterestByMonth: new Array(12).fill(0),
      dividendOutflowByMonth: new Array(12).fill(0),
      assetDisposalInflowByMonth: new Array(12).fill(0),
    },
  };
}

export function runAcceptanceVerification(): VerificationTestResult[] {
  const results: VerificationTestResult[] = [];
  const defaultState = createDefaultPlannerState();

  // 1. Kiểm thử giá vốn gà (Section XVII)
  {
    const baseChicken = structuredClone(defaultState.scenarios.base.products[0]);
    baseChicken.plannedInputCount = 1;
    baseChicken.avgLiveWeightKg = 2.0;
    baseChicken.purchasePricePerLiveKg = 65000;
    baseChicken.recoveryRate = 0.70;
    baseChicken.commercialWasteRate = 0;
    baseChicken.targetSellPrice = 180000;
    baseChicken.pricingUnit = 'per_kg_finished';
    const cogs = computeProductCogs(baseChicken);

    const passed =
      Math.abs(cogs.rawMaterialCostBatch - 130_000) < 1 &&
      Math.abs(cogs.finishedWeightBatchKg - 1.4) < 0.0001 &&
      Math.abs(cogs.grossRevenueSampleBatch - 252_000) < 1;

    results.push({
      id: 'TEST-01',
      title: 'Kiểm thử giá vốn gà (2kg sống × 65k, thu hồi 70%, bán 180k/kg TP)',
      expected: 'Giá mua = 130.000 đ; Thành phẩm = 1,4 kg; Doanh thu = 252.000 đ',
      actual: `Giá mua = ${cogs.rawMaterialCostBatch.toLocaleString('vi-VN')} đ; Thành phẩm = ${cogs.finishedWeightBatchKg.toFixed(1)} kg; Doanh thu = ${cogs.grossRevenueSampleBatch.toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  // 2. Kiểm thử hoa hồng CTV (Section XVII)
  {
    const s = makeMinimalScenario();
    const p = structuredClone(defaultState.scenarios.base.products[0]);
    p.inboundTransportPerUnit = 0;
    p.slaughterCostPerUnit = 0;
    p.processingCostPerUnit = 0;
    p.packagingMaterialPerUnit = 0;
    p.packingLaborPerUnit = 0;
    p.variableStoragePerUnit = 0;
    p.otherDirectProdPerUnit = 0;
    p.allocatedProdOverheadPerUnit = 0;
    p.avgLiveWeightKg = 1;
    p.purchasePricePerLiveKg = 100_000;
    p.recoveryRate = 1;
    p.commercialWasteRate = 0;
    p.pricingUnit = 'per_unit';
    s.products.push(p);

    const cp = structuredClone(defaultState.scenarios.base.channelPlans[1]);
    cp.productId = p.id;
    cp.monthlyVolumes = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    cp.sellPrice = 180_000; // CM before reward = 180k - 100k = 80k
    cp.discountRate = 0;
    cp.monthlyReturnsValue = 0;
    cp.commissionMethod = 'fixed_per_unit';
    cp.commissionValue = 15_000;
    cp.kpiBonusMonthly = 0;
    cp.newCustomerBonusMonthly = 0;
    cp.repeatCustomerBonusMonthly = 0;
    cp.otherBonusMonthly = 0;
    cp.orderStaffBonusPerUnit = 0;
    cp.deliveryCostPerUnit = 0;
    cp.paymentFeePct = 0;
    cp.customerServicePerUnit = 0;
    cp.promoAsExpensePerUnit = 0;
    cp.otherVariablePerUnit = 0;
    s.channelPlans.push(cp);

    const res = computeScenario(s);
    const line = res.monthlyLineItems[0];
    const passed =
      Math.abs(line.cmBeforeCommission - 80_000) < 1 &&
      Math.abs(line.ctvCommission - 15_000) < 1 &&
      Math.abs(line.contributionMargin - 65_000) < 1;

    results.push({
      id: 'TEST-02',
      title: 'Kiểm thử hoa hồng CTV (CM trước thưởng 80k, CTV 15k)',
      expected: 'Lãi đóng góp sau thưởng = 65.000 đ',
      actual: `CM trước thưởng = ${line.cmBeforeCommission.toLocaleString('vi-VN')} đ; CTV = ${line.ctvCommission.toLocaleString('vi-VN')} đ; CM sau thưởng = ${line.contributionMargin.toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  // 3. Kiểm thử chi phí cố định (+20 triệu/tháng -> EBIT giảm 20 triệu/tháng)
  {
    const baseRes = computeScenario(defaultState.scenarios.base);
    const modified = structuredClone(defaultState.scenarios.base);
    modified.operatingCosts.push({
      ...modified.operatingCosts[0],
      id: 'TEST-FIXED-20M',
      name: 'Chi phí cố định thử nghiệm +20tr',
      quantity: 1,
      unitPrice: 20_000_000,
      frequency: 'monthly',
      startMonth: 1,
      endMonth: 12,
      includeInPnl: true,
      isMemoAllocationOnly: false,
      monthlyBudgetLimit: 0,
    });
    const modRes = computeScenario(modified);
    const diffM1 = baseRes.monthlyPnl[0].operatingProfit - modRes.monthlyPnl[0].operatingProfit;
    const passed = Math.abs(diffM1 - 20_000_000) < 1;

    results.push({
      id: 'TEST-03',
      title: 'Kiểm thử chi phí cố định (+20 triệu/tháng)',
      expected: 'Lợi nhuận hoạt động tháng giảm đúng 20.000.000 đ',
      actual: `Giảm ${Math.round(diffM1).toLocaleString('vi-VN')} đ/tháng`,
      passed,
    });
  }

  // 4. Kiểm thử đầu tư (120 triệu, 60 tháng, không thu hồi -> Khấu hao 2tr/tháng, Dòng tiền đầu tư 120tr, không tính 120tr vào OpEx T1)
  {
    const s = makeMinimalScenario();
    s.assets.push({
      ...defaultState.scenarios.base.assets[1],
      id: 'TEST-ASSET-120M',
      quantity: 1,
      unitPrice: 120_000_000,
      paymentMonth: 1,
      inServiceMonth: 1,
      depreciableMonths: 60,
      salvageValue: 0,
      isDepreciable: true,
      monthlyFixedOpCost: 0,
      monthlyMaintenanceCost: 0,
    });
    const res = computeScenario(s);
    const deprM1 = res.monthlyPnl[0].depreciationCost;
    const opExM1 = res.monthlyPnl[0].totalFixedOperatingCost;
    const capexCfM1 = res.monthlyCashFlow[0].capexCashOut;
    const passed =
      Math.abs(deprM1 - 2_000_000) < 1 &&
      Math.abs(opExM1 - 2_000_000) < 1 &&
      Math.abs(capexCfM1 - 120_000_000) < 1;

    results.push({
      id: 'TEST-04',
      title: 'Kiểm thử đầu tư thiết bị (120 triệu, khấu hao 60 tháng)',
      expected: 'Khấu hao = 2.000.000 đ/tháng; Dòng tiền đầu tư T1 = 120.000.000 đ; OpEx T1 = 2.000.000 đ',
      actual: `Khấu hao = ${deprM1.toLocaleString('vi-VN')} đ; Dòng tiền đầu tư = ${capexCfM1.toLocaleString('vi-VN')} đ; OpEx T1 = ${opExM1.toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  // 5. Kiểm thử điểm hòa vốn (Định phí 120 triệu, CM 60.000đ/con -> 2.000 con)
  {
    const s = makeMinimalScenario();
    const p = structuredClone(defaultState.scenarios.base.products[0]);
    p.avgLiveWeightKg = 1;
    p.purchasePricePerLiveKg = 100_000;
    p.recoveryRate = 1;
    p.commercialWasteRate = 0;
    p.inboundTransportPerUnit = 0;
    p.slaughterCostPerUnit = 0;
    p.processingCostPerUnit = 0;
    p.packagingMaterialPerUnit = 0;
    p.packingLaborPerUnit = 0;
    p.variableStoragePerUnit = 0;
    p.otherDirectProdPerUnit = 0;
    p.allocatedProdOverheadPerUnit = 0;
    p.pricingUnit = 'per_unit';
    s.products.push(p);

    const cp = structuredClone(defaultState.scenarios.base.channelPlans[0]);
    cp.productId = p.id;
    cp.monthlyVolumes = new Array(12).fill(2500);
    cp.sellPrice = 160_000; // CM = 60.000đ/con
    cp.discountRate = 0;
    cp.monthlyReturnsValue = 0;
    cp.commissionValue = 0;
    cp.orderStaffBonusPerUnit = 0;
    cp.deliveryCostPerUnit = 0;
    cp.paymentFeePct = 0;
    cp.customerServicePerUnit = 0;
    cp.promoAsExpensePerUnit = 0;
    cp.otherVariablePerUnit = 0;
    s.channelPlans.push(cp);

    s.operatingCosts.push({
      ...defaultState.scenarios.base.operatingCosts[0],
      id: 'TEST-FC-120M',
      quantity: 1,
      unitPrice: 120_000_000,
      frequency: 'monthly',
      startMonth: 1,
      endMonth: 12,
      includeInPnl: true,
      isMemoAllocationOnly: false,
    });

    const res = computeScenario(s);
    const beMonthly = res.breakEven.breakEvenUnitsMonthly ?? 0;
    const passed = Math.abs(beMonthly - 2000) < 0.01;

    results.push({
      id: 'TEST-05',
      title: 'Kiểm thử điểm hòa vốn (Chi phí cố định 120tr, CM 60k/con)',
      expected: 'Sản lượng hòa vốn = 2.000 con/tháng',
      actual: `Sản lượng hòa vốn = ${Math.round(beMonthly).toLocaleString('vi-VN')} con/tháng`,
      passed,
    });
  }

  // 6. Kiểm thử nhiều kênh (Kênh A 1000 con @ 70k + Kênh B 1000 con @ 30k -> Tổng CM 100tr, BQ 50k/con)
  {
    const s = makeMinimalScenario();
    const p = structuredClone(defaultState.scenarios.base.products[0]);
    p.avgLiveWeightKg = 1;
    p.purchasePricePerLiveKg = 100_000;
    p.recoveryRate = 1;
    p.commercialWasteRate = 0;
    p.inboundTransportPerUnit = 0;
    p.slaughterCostPerUnit = 0;
    p.processingCostPerUnit = 0;
    p.packagingMaterialPerUnit = 0;
    p.packingLaborPerUnit = 0;
    p.variableStoragePerUnit = 0;
    p.otherDirectProdPerUnit = 0;
    p.allocatedProdOverheadPerUnit = 0;
    p.pricingUnit = 'per_unit';
    s.products.push(p);

    const cpA = structuredClone(defaultState.scenarios.base.channelPlans[0]);
    cpA.id = 'CH-A';
    cpA.productId = p.id;
    cpA.channelId = 'direct';
    cpA.monthlyVolumes = [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    cpA.sellPrice = 170_000; // CM = 70k
    cpA.discountRate = 0;
    cpA.monthlyReturnsValue = 0;
    cpA.commissionValue = 0;
    cpA.orderStaffBonusPerUnit = 0;
    cpA.deliveryCostPerUnit = 0;
    cpA.paymentFeePct = 0;
    cpA.customerServicePerUnit = 0;
    cpA.promoAsExpensePerUnit = 0;
    cpA.otherVariablePerUnit = 0;

    const cpB = structuredClone(cpA);
    cpB.id = 'CH-B';
    cpB.channelId = 'ctv';
    cpB.monthlyVolumes = [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    cpB.sellPrice = 130_000; // CM = 30k
    cpB.kpiBonusMonthly = 0;
    cpB.newCustomerBonusMonthly = 0;
    cpB.repeatCustomerBonusMonthly = 0;

    s.channelPlans.push(cpA, cpB);
    const res = computeScenario(s);
    const totalCm = res.annualPnl.contributionMargin;
    const avgCm = res.breakEven.weightedAvgCmPerUnit ?? 0;
    const passed = Math.abs(totalCm - 100_000_000) < 1 && Math.abs(avgCm - 50_000) < 1;

    results.push({
      id: 'TEST-06',
      title: 'Kiểm thử nhiều kênh (1.000 @ 70k + 1.000 @ 30k)',
      expected: 'Tổng lãi đóng góp = 100.000.000 đ; CM bình quân = 50.000 đ/con',
      actual: `Tổng CM = ${totalCm.toLocaleString('vi-VN')} đ; CM bình quân = ${avgCm.toLocaleString('vi-VN')} đ/con`,
      passed,
    });
  }

  // 7. Kiểm thử dòng tiền (Đầu kỳ 100tr + Thu 200tr - Chi HĐ 150tr - Chi ĐT 80tr = 70tr)
  {
    const s = makeMinimalScenario();
    s.assumptions.openingCash = 100_000_000;
    const p = structuredClone(defaultState.scenarios.base.products[0]);
    p.avgLiveWeightKg = 1;
    p.purchasePricePerLiveKg = 100_000;
    p.recoveryRate = 1;
    p.commercialWasteRate = 0;
    p.inboundTransportPerUnit = 0;
    p.slaughterCostPerUnit = 0;
    p.processingCostPerUnit = 0;
    p.packagingMaterialPerUnit = 0;
    p.packingLaborPerUnit = 0;
    p.variableStoragePerUnit = 0;
    p.otherDirectProdPerUnit = 0;
    p.allocatedProdOverheadPerUnit = 0;
    p.pricingUnit = 'per_unit';
    s.products.push(p);

    const cp = structuredClone(defaultState.scenarios.base.channelPlans[0]);
    cp.productId = p.id;
    cp.monthlyVolumes = [1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    cp.sellPrice = 200_000; // Revenue = 200tr, COGS = 100tr
    cp.discountRate = 0;
    cp.monthlyReturnsValue = 0;
    cp.commissionValue = 0;
    cp.orderStaffBonusPerUnit = 0;
    cp.deliveryCostPerUnit = 0;
    cp.paymentFeePct = 0;
    cp.customerServicePerUnit = 0;
    cp.promoAsExpensePerUnit = 0;
    cp.otherVariablePerUnit = 0;
    s.channelPlans.push(cp);

    s.operatingCosts.push({
      ...defaultState.scenarios.base.operatingCosts[0],
      id: 'TEST-OPEX-50M',
      quantity: 1,
      unitPrice: 50_000_000, // 100tr COGS + 50tr OpEx = 150tr Operating Cash Out
      frequency: 'once',
      startMonth: 1,
      endMonth: 1,
      includeInPnl: true,
      isMemoAllocationOnly: false,
    });
    s.assets.push({
      ...defaultState.scenarios.base.assets[0],
      id: 'TEST-CAPEX-80M',
      quantity: 1,
      unitPrice: 80_000_000,
      paymentMonth: 1,
      inServiceMonth: 2,
      monthlyFixedOpCost: 0,
      monthlyMaintenanceCost: 0,
    });

    const res = computeScenario(s);
    const endM1 = res.monthlyCashFlow[0].endingCash;
    const passed = Math.abs(endM1 - 70_000_000) < 1;

    results.push({
      id: 'TEST-07',
      title: 'Kiểm thử dòng tiền (100tr + 200tr - 150tr - 80tr)',
      expected: 'Tiền cuối kỳ T1 = 70.000.000 đ',
      actual: `Tiền cuối kỳ T1 = ${Math.round(endM1).toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  // 8. Kiểm thử đối chiếu tổng hợp & không có NaN/Infinity
  {
    const baseRes = computeScenario(defaultState.scenarios.base);
    const sumChannelNetRev = baseRes.channelSummaries.reduce((s, c) => s + c.netRevenue, 0);
    const sumChannelCm = baseRes.channelSummaries.reduce((s, c) => s + c.contributionMargin, 0);
    const revMatch = Math.abs(sumChannelNetRev - baseRes.annualPnl.netRevenue) < 1;
    const cmMatch = Math.abs(sumChannelCm - baseRes.annualPnl.contributionMargin) < 1;
    const noNaN =
      Number.isFinite(baseRes.annualPnl.netProfit) &&
      Number.isFinite(baseRes.annualCashFlow.endingCash) &&
      baseRes.monthlyPnl.every((m) => Number.isFinite(m.operatingProfit)) &&
      baseRes.monthlyCashFlow.every((c) => Number.isFinite(c.endingCash));

    results.push({
      id: 'TEST-08',
      title: 'Kiểm thử đối chiếu tổng hợp Kênh <-> P&L & Không lỗi NaN/Infinity',
      expected: 'Tổng kênh khớp P&L công ty và tất cả chỉ tiêu hữu hạn',
      actual: `Chênh lệch DT = ${Math.abs(sumChannelNetRev - baseRes.annualPnl.netRevenue).toFixed(0)} đ; Chênh lệch CM = ${Math.abs(sumChannelCm - baseRes.annualPnl.contributionMargin).toFixed(0)} đ; Hữu hạn = ${noNaN ? 'Đạt' : 'Lỗi'}`,
      passed: revMatch && cmMatch && noNaN,
    });
  }

  // 9. Module 07 - Kiểm thử 01: CTV bán 10 con/ngày × 26 ngày (1,4kg TP × 180k, hoa hồng 15k/con)
  {
    const base = defaultState.scenarios.base;
    const ctv01 = base.salesProfiles!.find((p) => p.id === 'HS-CTV-01')!;
    const res = computeSalesProfile(ctv01, base).summary;
    const passed =
      Math.abs(res.totalMonthlyQty - 260) < 0.01 &&
      Math.abs(res.totalGrossRevenue - 65_520_000) < 1 &&
      Math.abs(res.totalCommission - 3_900_000) < 1 &&
      Math.abs(res.grossIncome - 3_900_000) < 1;

    results.push({
      id: 'M07-01',
      title: 'Module 07 – CTV bán 10 con gà/ngày × 26 ngày (1,4kg × 180k, HH 15k/con)',
      expected: '260 con · Doanh thu 65.520.000 đ · Thu nhập 3.900.000 đ',
      actual: `${res.totalMonthlyQty} con · DT ${res.totalGrossRevenue.toLocaleString('vi-VN')} đ · Thu nhập ${res.grossIncome.toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  // 10. Module 07 - Kiểm thử 02: CTV bán 20 con/ngày (520 con -> 131.040.000 đ DT, 7.800.000 đ thu nhập)
  {
    const base = defaultState.scenarios.base;
    const ctv01 = structuredClone(base.salesProfiles!.find((p) => p.id === 'HS-CTV-01')!);
    ctv01.items[0].dailyQty = 20;
    const res = computeSalesProfile(ctv01, base).summary;
    const passed =
      Math.abs(res.totalMonthlyQty - 520) < 0.01 &&
      Math.abs(res.totalGrossRevenue - 131_040_000) < 1 &&
      Math.abs(res.grossIncome - 7_800_000) < 1;

    results.push({
      id: 'M07-02',
      title: 'Module 07 – CTV bán 20 con gà/ngày × 26 ngày',
      expected: '520 con · Doanh thu 131.040.000 đ · Thu nhập 7.800.000 đ',
      actual: `${res.totalMonthlyQty} con · DT ${res.totalGrossRevenue.toLocaleString('vi-VN')} đ · Thu nhập ${res.grossIncome.toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  // 11. Module 07 - Kiểm thử 03: Nhân viên bán 10 con/ngày (Lương 7tr + 3,9tr thưởng = 10,9tr)
  {
    const base = defaultState.scenarios.base;
    const nv01 = base.salesProfiles!.find((p) => p.id === 'HS-NV-01')!;
    const res = computeSalesProfile(nv01, base).summary;
    const passed =
      Math.abs(res.totalMonthlyQty - 260) < 0.01 &&
      Math.abs(res.fixedSalaryAndAllowance - 7_000_000) < 1 &&
      Math.abs(res.totalCommission - 3_900_000) < 1 &&
      Math.abs(res.grossIncome - 10_900_000) < 1;

    results.push({
      id: 'M07-03',
      title: 'Module 07 – Nhân viên lương 7tr + bán 10 con/ngày (HH 15k/con)',
      expected: '260 con · Lương 7.000.000 đ + HH 3.900.000 đ = 10.900.000 đ',
      actual: `${res.totalMonthlyQty} con · Lương ${res.fixedSalaryAndAllowance.toLocaleString('vi-VN')} đ + HH ${res.totalCommission.toLocaleString('vi-VN')} đ = ${res.grossIncome.toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  // 12. Module 07 - Kiểm thử 04: Tính ngược mục tiêu 10.000.000 đ (HH 15k/con -> 667 con, ~25,65 con/ngày)
  {
    const base = defaultState.scenarios.base;
    const ctv01 = base.salesProfiles!.find((p) => p.id === 'HS-CTV-01')!;
    const solved = solveTargetIncome(ctv01, base, 10_000_000);
    const passed =
      solved.feasible &&
      solved.requiredMonthlyQty === 667 &&
      Math.abs(solved.requiredDailyAvgQty - 667 / 26) < 0.01;

    results.push({
      id: 'M07-04',
      title: 'Module 07 – Tính ngược mục tiêu CTV 10.000.000 đ/tháng (15k/con, 26 ngày)',
      expected: 'Tối thiểu 667 con/tháng (~25,65 con/ngày)',
      actual: `${solved.requiredMonthlyQty} con/tháng (~${solved.requiredDailyAvgQty.toFixed(2)} con/ngày)`,
      passed,
    });
  }

  // 13. Module 07 - Kiểm thử 05: Chống tính trùng chi phí khi áp dụng vào P&L + Bậc thưởng lũy tiến vs toàn bộ
  {
    const base = defaultState.scenarios.base;
    const ctv01 = base.salesProfiles!.find((p) => p.id === 'HS-CTV-01')!;
    const appliedScenario = applyProfileToScenarioPlan(base, ctv01, 'replace', 1);
    const appliedRes = computeScenario(appliedScenario);
    const ctvM1Lines = appliedRes.monthlyLineItems.filter(
      (l) => l.month === 1 && l.channelId === 'ctv' && l.productId === 'SP-GA-TM'
    );
    const commInPnl = ctvM1Lines.reduce((s, l) => s + l.ctvCommission, 0);

    const tiers = [
      { minQty: 0, maxQty: 49, ratePerUnit: 10000, fixedBonus: 0 },
      { minQty: 50, maxQty: 99, ratePerUnit: 15000, fixedBonus: 0 },
      { minQty: 100, maxQty: null, ratePerUnit: 20000, fixedBonus: 0 },
    ];
    const whole100 = computeVolumeBonus(100, 'tier_whole', tiers);
    const prog100 = computeVolumeBonus(100, 'tier_progressive', tiers);

    const passed =
      Math.abs(commInPnl - 3_900_000) < 1 &&
      Math.abs(whole100 - 2_000_000) < 1 &&
      Math.abs(prog100 - 1_250_000) < 1;

    results.push({
      id: 'M07-05',
      title: 'Module 07 – Không trùng hoa hồng P&L (3,9tr) & Thưởng bậc toàn bộ (2tr) vs lũy tiến (1,25tr)',
      expected: 'HH P&L = 3.900.000 đ; Toàn bộ = 2.000.000 đ; Lũy tiến = 1.250.000 đ',
      actual: `HH P&L = ${Math.round(commInPnl).toLocaleString('vi-VN')} đ; Toàn bộ = ${whole100.toLocaleString('vi-VN')} đ; Lũy tiến = ${prog100.toLocaleString('vi-VN')} đ`,
      passed,
    });
  }

  return results;
}
