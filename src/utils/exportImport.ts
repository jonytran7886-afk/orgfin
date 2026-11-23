import * as XLSX from 'xlsx';
import { createDefaultPlannerState } from '../data/defaultPlan';
import { computeSalesProfile } from '../engine/salesIncome';
import {
  ComputedScenarioResult,
  PlannerState,
  ScenarioId,
} from '../types/finance';
import { CHANNEL_LABELS, PILLAR_LABELS, STATUS_LABELS } from './format';

export function exportPlanToJson(state: PlannerState): void {
  const payload = {
    app: 'Organic Vietnam Financial Planner',
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `organic-vietnam-ke-hoach-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseAndValidateImportedJson(
  rawText: string
): { ok: true; data: PlannerState } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawText);
    const candidate = parsed?.state ?? parsed;
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      !candidate.scenarios ||
      !candidate.scenarios.base ||
      !candidate.scenarios.conservative ||
      !candidate.scenarios.growth
    ) {
      return {
        ok: false,
        error:
          'Tệp JSON không đúng cấu trúc Organic Việt Nam (thiếu 3 kịch bản base / conservative / growth).',
      };
    }

    const requiredArrays = [
      'products',
      'channelPlans',
      'staff',
      'operatingCosts',
      'assets',
      'locations',
      'marketingCampaigns',
    ];
    for (const sid of ['base', 'conservative', 'growth'] as ScenarioId[]) {
      const sc = candidate.scenarios[sid];
      for (const key of requiredArrays) {
        if (!Array.isArray(sc[key])) {
          return {
            ok: false,
            error: `Kịch bản "${sid}" thiếu danh sách hợp lệ cho trường "${key}".`,
          };
        }
      }
      if (!sc.assumptions || typeof sc.assumptions.openingCash !== 'number') {
        return {
          ok: false,
          error: `Kịch bản "${sid}" thiếu thông số tài chính (assumptions).`,
        };
      }
      if (!Array.isArray(sc.salesProfiles)) {
        const defaults = createDefaultPlannerState();
        sc.salesProfiles = defaults.scenarios[sid].salesProfiles;
      }
    }

    return {
      ok: true,
      data: {
        activeScenario: candidate.activeScenario || 'base',
        scenarios: candidate.scenarios,
        lastSavedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: `Không thể đọc tệp JSON: ${err instanceof Error ? err.message : 'Lỗi định dạng'}`,
    };
  }
}

export function exportPlanToExcel(
  state: PlannerState,
  resultsByScenario: Record<ScenarioId, ComputedScenarioResult>
): void {
  const wb = XLSX.utils.book_new();
  const activeId = state.activeScenario;
  const sc = state.scenarios[activeId];
  const res = resultsByScenario[activeId];

  // Sheet 1: Báo cáo P&L 12 tháng
  const pnlRows = [
    ['CHỈ TIÊU P&L (VNĐ)', ...res.monthlyPnl.map((m) => `Tháng ${m.month}`), 'CẢ NĂM'],
    ['1. Doanh thu gộp', ...res.monthlyPnl.map((m) => Math.round(m.grossRevenue)), Math.round(res.annualPnl.grossRevenue)],
    ['2. Giảm trừ doanh thu', ...res.monthlyPnl.map((m) => Math.round(m.revenueDeductions)), Math.round(res.annualPnl.revenueDeductions)],
    ['3. Doanh thu thuần', ...res.monthlyPnl.map((m) => Math.round(m.netRevenue)), Math.round(res.annualPnl.netRevenue)],
    ['4. Giá vốn hàng bán', ...res.monthlyPnl.map((m) => Math.round(m.cogs)), Math.round(res.annualPnl.cogs)],
    ['5. Lợi nhuận gộp', ...res.monthlyPnl.map((m) => Math.round(m.grossProfit)), Math.round(res.annualPnl.grossProfit)],
    ['6. Chi phí bán hàng biến đổi', ...res.monthlyPnl.map((m) => Math.round(m.variableSellingCost)), Math.round(res.annualPnl.variableSellingCost)],
    ['7. Lãi đóng góp', ...res.monthlyPnl.map((m) => Math.round(m.contributionMargin)), Math.round(res.annualPnl.contributionMargin)],
    ['8. Chi phí bán hàng cố định', ...res.monthlyPnl.map((m) => Math.round(m.fixedSellingCost)), Math.round(res.annualPnl.fixedSellingCost)],
    ['9. Marketing', ...res.monthlyPnl.map((m) => Math.round(m.marketingCost)), Math.round(res.annualPnl.marketingCost)],
    ['10. Truyền thông', ...res.monthlyPnl.map((m) => Math.round(m.mediaCost)), Math.round(res.annualPnl.mediaCost)],
    ['11. Chi phí quản lý', ...res.monthlyPnl.map((m) => Math.round(m.adminCost)), Math.round(res.annualPnl.adminCost)],
    ['12. Chi phí vận hành cố định khác', ...res.monthlyPnl.map((m) => Math.round(m.otherFixedOpCost)), Math.round(res.annualPnl.otherFixedOpCost)],
    ['13. Khấu hao / phân bổ', ...res.monthlyPnl.map((m) => Math.round(m.depreciationCost)), Math.round(res.annualPnl.depreciationCost)],
    ['14. Lợi nhuận hoạt động (EBIT)', ...res.monthlyPnl.map((m) => Math.round(m.operatingProfit)), Math.round(res.annualPnl.operatingProfit)],
    ['15. Thu nhập / Chi phí tài chính ròng', ...res.monthlyPnl.map((m) => Math.round(m.financialAndOtherNet)), Math.round(res.annualPnl.financialAndOtherNet)],
    ['16. Lợi nhuận trước thuế', ...res.monthlyPnl.map((m) => Math.round(m.profitBeforeTax)), Math.round(res.annualPnl.profitBeforeTax)],
    ['17. Thuế TNDN dự kiến', ...res.monthlyPnl.map((m) => Math.round(m.estimatedCit)), Math.round(res.annualPnl.estimatedCit)],
    ['18. Lợi nhuận sau thuế', ...res.monthlyPnl.map((m) => Math.round(m.netProfit)), Math.round(res.annualPnl.netProfit)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pnlRows), 'Bao_cao_PnL');

  // Sheet 2: Dòng tiền 12 tháng
  const cfRows = [
    ['CHỈ TIÊU DÒNG TIỀN (VNĐ)', ...res.monthlyCashFlow.map((c) => `Tháng ${c.month}`)],
    ['Tiền đầu kỳ', ...res.monthlyCashFlow.map((c) => Math.round(c.openingCash))],
    ['Thu tiền khách hàng', ...res.monthlyCashFlow.map((c) => Math.round(c.customerReceipts))],
    ['Thanh toán nhà cung cấp', ...res.monthlyCashFlow.map((c) => Math.round(c.supplierPayments))],
    ['Chi lương & nhân sự', ...res.monthlyCashFlow.map((c) => Math.round(c.hrCashOut))],
    ['Chi Marketing & Truyền thông', ...res.monthlyCashFlow.map((c) => Math.round(c.marketingMediaCashOut))],
    ['Chi quản lý, cửa hàng & biến đổi khác', ...res.monthlyCashFlow.map((c) => Math.round(c.adminStoreOtherCashOut))],
    ['Chi thuế TNDN', ...res.monthlyCashFlow.map((c) => Math.round(c.taxCashOut))],
    ['Dòng tiền hoạt động (OCF)', ...res.monthlyCashFlow.map((c) => Math.round(c.operatingCashFlow))],
    ['Chi đầu tư CapEx', ...res.monthlyCashFlow.map((c) => Math.round(c.capexCashOut))],
    ['Dòng tiền đầu tư (ICF)', ...res.monthlyCashFlow.map((c) => Math.round(c.investingCashFlow))],
    ['Dòng tiền tài chính (FCF)', ...res.monthlyCashFlow.map((c) => Math.round(c.financingCashFlow))],
    ['Tiền cuối kỳ', ...res.monthlyCashFlow.map((c) => Math.round(c.endingCash))],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cfRows), 'Dong_tien');

  // Sheet 3: Sản phẩm & Giá vốn
  const prodRows = [
    [
      'Mã SP',
      'Tên sản phẩm',
      'Nhóm',
      'Nguồn cung',
      'TL sống/đv (kg)',
      'Giá đầu vào/kg sống',
      'Tỷ lệ thu hồi (%)',
      'Hao hụt TM (%)',
      'Giá vốn/kg TP',
      'Giá vốn/đv bán',
      'Giá bán mục tiêu',
      'Trạng thái',
    ],
    ...sc.products.map((p) => {
      const c = res.productCogsMap[p.id];
      return [
        p.id,
        p.name,
        p.group,
        p.supplyType === 'purchased' ? 'Thu mua' : 'Tự sản xuất',
        p.avgLiveWeightKg,
        Math.round(c?.effectiveLiveKgCost ?? p.purchasePricePerLiveKg),
        Number((p.recoveryRate * 100).toFixed(1)),
        Number((p.commercialWasteRate * 100).toFixed(1)),
        c?.cogsPerFinishedKg ? Math.round(c.cogsPerFinishedKg) : 0,
        c?.cogsPerSellUnit ? Math.round(c.cogsPerSellUnit) : 0,
        p.targetSellPrice,
        STATUS_LABELS[p.status],
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prodRows), 'San_pham_Gia_von');

  // Sheet 4: Kênh bán
  const channelRows = [
    ['Kênh bán', 'Sản lượng năm', 'Doanh thu gộp', 'Doanh thu thuần', 'Giá vốn', 'Chi phí BH biến đổi', 'Lãi đóng góp', 'Biên CM (%)'],
    ...res.channelSummaries.map((cs) => [
      cs.channelName,
      Math.round(cs.volume),
      Math.round(cs.grossRevenue),
      Math.round(cs.netRevenue),
      Math.round(cs.cogs),
      Math.round(cs.variableSellingCost),
      Math.round(cs.contributionMargin),
      cs.cmMarginPct !== null ? Number(cs.cmMarginPct.toFixed(1)) : 0,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(channelRows), 'Kenh_ban');

  // Sheet 5: Chi phí hoạt động
  const opRows = [
    ['Mã CP', 'Nhóm chi phí', 'Hạng mục', 'Loại', 'Tần suất', 'Đơn giá', 'Số lượng', 'Tháng BĐ-KT', 'Trạng thái'],
    ...sc.operatingCosts.map((o) => [
      o.id,
      o.group,
      o.name,
      o.costBehavior === 'fixed' ? 'Cố định' : 'Biến đổi',
      o.frequency,
      o.unitPrice,
      o.quantity,
      `T${o.startMonth}-T${o.endMonth}`,
      STATUS_LABELS[o.status],
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(opRows), 'Chi_phi_hoat_dong');

  // Sheet 6: Đầu tư & Điểm bán
  const assetRows = [
    ['Mã TS', 'Tên hạng mục', 'Nhóm tài sản', 'Số lượng', 'Đơn giá', 'Tổng vốn', 'Tháng TT', 'Tháng SD', 'Số tháng KH', 'Trạng thái'],
    ...sc.assets.map((a) => [
      a.id,
      a.name,
      a.category,
      a.quantity,
      a.unitPrice,
      a.quantity * a.unitPrice,
      `T${a.paymentMonth}`,
      `T${a.inServiceMonth}`,
      a.depreciableMonths,
      STATUS_LABELS[a.status],
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assetRows), 'Dau_tu_Tai_san');

  // Sheet 7: Marketing
  const mktRows = [
    ['Mã', 'Chiến dịch', 'Trụ cột', 'Chi phí tổng', 'CAC', 'Tỷ lệ CĐ (%)', 'ROAS', 'Hiệu quả đóng góp MKT'],
    ...res.marketingSummaries.map((ms) => [
      ms.campaignId,
      ms.name,
      PILLAR_LABELS[ms.pillar],
      Math.round(ms.totalCost),
      ms.cac !== null ? Math.round(ms.cac) : 'Không xác định',
      ms.conversionRatePct !== null ? Number(ms.conversionRatePct.toFixed(1)) : 0,
      ms.roas !== null ? Number(ms.roas.toFixed(2)) : 0,
      Math.round(ms.contributionEffect),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mktRows), 'Marketing');

  // Sheet 8: Mô phỏng thu nhập NV & CTV
  const salesProfRows = [
    [
      'Mã hồ sơ',
      'Tên người bán / Kịch bản',
      'Loại',
      'Kênh bán',
      'Sản lượng/tháng',
      'Doanh thu tạo ra',
      'Hoa hồng',
      'Tổng thưởng',
      'Lương CĐ',
      'Tổng thu nhập trước KT',
      'Lãi đóng góp Organic',
    ],
    ...(sc.salesProfiles || []).map((sp) => {
      const sRes = computeSalesProfile(sp, sc, res.productCogsMap).summary;
      return [
        sp.id,
        sp.name,
        sp.sellerType === 'ctv' ? 'CTV' : 'Nhân viên',
        CHANNEL_LABELS[sp.channelId],
        Math.round(sRes.totalMonthlyQty),
        Math.round(sRes.totalGrossRevenue),
        Math.round(sRes.totalCommission),
        Math.round(sRes.totalAllBonuses),
        Math.round(sRes.fixedSalaryAndAllowance),
        Math.round(sRes.grossIncome),
        Math.round(sRes.organicContribution),
      ];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesProfRows), 'Thu_nhap_NV_CTV');

  // Sheet 9: So sánh 3 kịch bản
  const cons = resultsByScenario.conservative;
  const base = resultsByScenario.base;
  const grow = resultsByScenario.growth;
  const cmpRows = [
    ['CHỈ TIÊU CẢ NĂM', 'Thận trọng', 'Cơ sở', 'Tăng trưởng'],
    ['Doanh thu thuần', Math.round(cons.annualPnl.netRevenue), Math.round(base.annualPnl.netRevenue), Math.round(grow.annualPnl.netRevenue)],
    ['Giá vốn hàng bán', Math.round(cons.annualPnl.cogs), Math.round(base.annualPnl.cogs), Math.round(grow.annualPnl.cogs)],
    ['Lãi đóng góp', Math.round(cons.annualPnl.contributionMargin), Math.round(base.annualPnl.contributionMargin), Math.round(grow.annualPnl.contributionMargin)],
    ['Chi phí cố định', Math.round(cons.annualPnl.totalFixedOperatingCost), Math.round(base.annualPnl.totalFixedOperatingCost), Math.round(grow.annualPnl.totalFixedOperatingCost)],
    ['Lợi nhuận hoạt động', Math.round(cons.annualPnl.operatingProfit), Math.round(base.annualPnl.operatingProfit), Math.round(grow.annualPnl.operatingProfit)],
    ['Sản lượng hòa vốn/năm', cons.breakEven.breakEvenUnitsAnnual ? Math.round(cons.breakEven.breakEvenUnitsAnnual) : 'N/A', base.breakEven.breakEvenUnitsAnnual ? Math.round(base.breakEven.breakEvenUnitsAnnual) : 'N/A', grow.breakEven.breakEvenUnitsAnnual ? Math.round(grow.breakEven.breakEvenUnitsAnnual) : 'N/A'],
    ['Vốn cần bổ sung tối thiểu', Math.round(cons.annualCashFlow.additionalCapitalNeeded), Math.round(base.annualCashFlow.additionalCapitalNeeded), Math.round(grow.annualCashFlow.additionalCapitalNeeded)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cmpRows), 'So_sanh_kich_ban');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Organic-VN-Ke-hoach-${activeId}-${dateStr}.xlsx`);
}

export function getChannelShortName(id: keyof typeof CHANNEL_LABELS): string {
  return CHANNEL_LABELS[id] || id;
}
