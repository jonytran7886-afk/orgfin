export type DataStatus =
  | 'unentered'
  | 'assumed'
  | 'quoted'
  | 'confirmed'
  | 'approved';

export interface AuditMeta {
  status: DataStatus;
  source: string;
  updatedAt: string;
  owner: string;
  note: string;
}

export type ScenarioId = 'conservative' | 'base' | 'growth';

export type ProductGroup = 'Gà' | 'Lợn' | 'Bò' | 'Trứng' | 'Rau củ' | 'Khác';

export type SupplyType = 'purchased' | 'self_farmed';

export type PricingUnit = 'per_kg_finished' | 'per_head' | 'per_unit';

export interface SelfFarmedCostBreakdown {
  batchStandardLiveKg: number;
  batchStandardHeads: number;
  mortalityRate: number; // 0..1
  chickCost: number;
  feedCost: number;
  herbCost: number;
  vetMedicineCost: number;
  directFarmLaborCost: number;
  utilitiesBeddingCost: number;
  coopOpsCost: number;
  farmDepreciationCost: number;
  farmOverheadCost: number;
  mortalityLossCost: number;
  otherFarmCost: number;
}

export interface ProductItem extends AuditMeta {
  id: string;
  name: string;
  group: ProductGroup;
  supplyType: SupplyType;
  inputUnit: string;
  sellUnit: string;
  pricingUnit: PricingUnit;
  avgLiveWeightKg: number; // Trọng lượng sống bình quân/con (nếu bán theo kg/hộp không phải con sống = 1)
  purchasePricePerLiveKg: number; // Giá mua/kg sống (nếu thu mua) hoặc đơn giá nhập
  plannedInputCount: number; // Số con / đơn vị đầu vào tham chiếu (để mô phỏng lô chuẩn)
  recoveryRate: number; // 0..1 (vd: 0.70 = 70%)
  commercialWasteRate: number; // 0..1 (hao hụt thương mại sau thu hồi)
  // Chi phí giết mổ, sơ chế, đóng gói tính trên 1 con / 1 đơn vị đầu vào
  inboundTransportPerUnit: number;
  slaughterCostPerUnit: number;
  processingCostPerUnit: number;
  packagingMaterialPerUnit: number;
  packingLaborPerUnit: number;
  variableStoragePerUnit: number;
  otherDirectProdPerUnit: number;
  allocatedProdOverheadPerUnit: number;
  // Giá bán & thuế
  targetSellPrice: number;
  priceIncludesVat: boolean;
  vatRate: number; // 0..1
  selfFarmedCosts?: SelfFarmedCostBreakdown;
}

export type ChannelId =
  | 'direct'
  | 'ctv'
  | 'agency'
  | 'store'
  | 'b2b'
  | 'internal_transfer';

export type CommissionMethod =
  | 'fixed_per_unit'
  | 'pct_net_revenue'
  | 'pct_cm_before_comm';

export interface ChannelPlanItem extends AuditMeta {
  id: string;
  productId: string;
  channelId: ChannelId;
  isInternalTransfer: boolean;
  // Sản lượng bán dự kiến theo 12 tháng (index 0 = Tháng 1 .. index 11 = Tháng 12)
  monthlyVolumes: number[];
  sellPrice: number;
  discountRate: number; // 0..1 (tỷ lệ giảm giá / chiết khấu thương mại)
  monthlyReturnsValue: number; // Giá trị hàng trả lại bình quân/tháng hoặc tỷ lệ
  commissionMethod: CommissionMethod;
  commissionValue: number; // VNĐ/đơn vị nếu fixed_per_unit, hoặc 0..1 nếu %
  kpiBonusMonthly: number;
  newCustomerBonusMonthly: number;
  repeatCustomerBonusMonthly: number;
  otherBonusMonthly: number;
  maxRewardBudgetPct: number; // 0..1 trần thưởng tối đa trên lãi đóng góp trước thưởng
  guaranteedMinCommission: number;
  orderStaffBonusPerUnit: number;
  deliveryCostPerUnit: number;
  paymentFeePct: number; // 0..1
  customerServicePerUnit: number;
  promoAsExpensePerUnit: number;
  otherVariablePerUnit: number;
  allocatedChannelVarMonthly: number;
}

export interface StaffMember extends AuditMeta {
  id: string;
  roleTitle: string;
  department: 'Kinh doanh' | 'Marketing' | 'Vận hành' | 'Kho & Logistics' | 'Cửa hàng' | 'Quản lý';
  headcount: number;
  baseSalary: number;
  allowance: number;
  insuranceEmployer: number;
  otherFixedHr: number;
  // Thưởng doanh số cố định kỳ (không trùng với thưởng theo đơn ở kênh bán)
  periodicSalesBonus: number;
  startMonth: number;
  endMonth: number;
  includeInPnl: boolean;
}

export type CostGroup =
  | 'Sản xuất và giá vốn'
  | 'Giết mổ và sơ chế'
  | 'Bao bì và đóng gói'
  | 'Kho và bảo quản'
  | 'Logistics và giao hàng'
  | 'Nhân sự'
  | 'CTV và đại lý'
  | 'Marketing'
  | 'Truyền thông'
  | 'Văn phòng'
  | 'Cửa hàng và điểm bán'
  | 'Công nghệ và quản lý'
  | 'Chi phí tài chính'
  | 'Dự phòng và chi phí khác';

export type CostBehavior = 'fixed' | 'variable';

export type AccountingClass =
  | 'cogs'
  | 'selling_fixed'
  | 'marketing'
  | 'media'
  | 'admin'
  | 'other_op_fixed'
  | 'financial';

export type CostFrequency = 'once' | 'monthly' | 'quarterly' | 'yearly';

export interface OperatingCostItem extends AuditMeta {
  id: string;
  group: CostGroup;
  name: string;
  department: string;
  costCenter: string;
  linkedTarget: string;
  costBehavior: CostBehavior;
  accountingClass: AccountingClass;
  quantity: number;
  unitPrice: number;
  variableRatePerUnit: number; // Nếu costBehavior === 'variable'
  frequency: CostFrequency;
  startMonth: number; // 1..12
  endMonth: number; // 1..12
  allocationPct: number; // 0..100
  isMemoAllocationOnly: boolean; // True = chỉ để phân bổ quản trị, không cộng lại vào P&L tổng công ty
  includeInPnl: boolean;
  monthlyBudgetLimit: number;
}

export type AssetCategory =
  | 'Xây dựng, cải tạo văn phòng'
  | 'Nội thất văn phòng'
  | 'Thiết bị làm việc'
  | 'Xây dựng cửa hàng'
  | 'Kệ và quầy trưng bày'
  | 'Tủ mát, tủ đông'
  | 'Thiết bị bảo quản'
  | 'Máy đóng gói'
  | 'Kho lạnh'
  | 'Xe vận chuyển'
  | 'Thiết bị tại điểm bán'
  | 'Hạ tầng công nghệ'
  | 'Đầu tư khác';

export type DeploymentStatus = 'planned' | 'purchasing' | 'in_service';

export interface AssetItem extends AuditMeta {
  id: string;
  name: string;
  category: AssetCategory;
  locationId: string;
  quantity: number;
  unitPrice: number;
  paymentMonth: number; // 1..12
  inServiceMonth: number; // 1..12
  depreciableMonths: number;
  salvageValue: number;
  isDepreciable: boolean;
  monthlyFixedOpCost: number;
  monthlyMaintenanceCost: number;
  deploymentStatus: DeploymentStatus;
}

export type LocationType = 'store' | 'office' | 'warehouse';

export interface LocationItem extends AuditMeta {
  id: string;
  name: string;
  type: LocationType;
  isActive: boolean;
  openMonth: number; // 1..12
  monthlyRent: number;
  monthlyFixedPayroll: number;
  monthlyUtilities: number;
  monthlyInternet: number;
  monthlyMaintenance: number;
  monthlyOtherFixed: number;
  allocatedSharedCostPct: number; // 0..100 (% chi phí quản lý chung phân bổ về điểm bán để xem P&L điểm bán)
  storeRevenueSharePct: number; // 0..100 (% sản lượng kênh cửa hàng thuộc điểm bán này)
}

export type MarketingPillar = 'conversion' | 'brand' | 'pos';

export interface MarketingCampaign extends AuditMeta {
  id: string;
  month: number; // 1..12 (0 = áp dụng đều từng tháng)
  name: string;
  pillar: MarketingPillar;
  totalBudget: number;
  allocatedBudget: number;
  adSpend: number;
  contentCost: number;
  videoCost: number;
  designCost: number;
  posmCost: number;
  samplingCost: number;
  posDevCost: number;
  leads: number;
  newCustomers: number;
  orders: number;
  attributedRevenue: number;
  attributedCmBeforeMkt: number;
  includeInPnl: boolean; // Chống tính trùng nếu đã nhập trong bảng Chi phí hoạt động
}

export interface FinancialAssumptions extends AuditMeta {
  openingCash: number;
  minCashReserve: number;
  immediateCollectionPct: number; // 0..1
  arDelayMonths: number; // 0, 1, 2
  immediateSupplierPayPct: number; // 0..1
  apDelayMonths: number; // 0, 1, 2
  citRate: number; // 0..1 (e.g. 0.20)
  taxAdjustmentMonthly: number; // Chênh lệch thu nhập chịu thuế vs lợi nhuận kế toán
  otherIncomeByMonth: number[]; // 12 months
  otherExpenseByMonth: number[]; // 12 months
  equityInjectionByMonth: number[]; // 12 months
  loanDrawdownByMonth: number[]; // 12 months
  loanPrincipalRepaymentByMonth: number[]; // 12 months
  loanInterestByMonth: number[]; // 12 months
  dividendOutflowByMonth: number[]; // 12 months
  assetDisposalInflowByMonth: number[]; // 12 months
}

export type SellerType = 'ctv' | 'staff';

export type SalesVolumeInputMode = 'daily' | 'monthly';

export type SellingUnitBasis = 'per_head' | 'sell_unit';

export type VolumeBonusMode =
  | 'none'
  | 'threshold_fixed'
  | 'tier_whole'
  | 'tier_progressive';

export interface VolumeBonusTier {
  minQty: number;
  maxQty: number | null;
  ratePerUnit: number;
  fixedBonus: number;
}

export type KpiTargetMetric = 'quantity' | 'revenue' | 'contribution' | 'new_customers';

export interface SalesProfileProductItem {
  id: string;
  productId: string;
  inputMode: SalesVolumeInputMode;
  dailyQty: number;
  monthlyQty: number;
  sellingUnitBasis: SellingUnitBasis; // 'per_head' (vd: con gà 1,4kg TP) hoặc 'sell_unit' (kg TP / hộp)
  usePolicyPrice: boolean;
  overrideSellPrice: number;
  commissionMethod: 'use_policy' | CommissionMethod;
  commissionValue: number; // VNĐ/đv (theo sellingUnitBasis) hoặc 0..1 nếu %
}

export interface SalesProfile extends AuditMeta {
  id: string;
  name: string;
  sellerType: SellerType;
  region: string;
  channelId: ChannelId;
  sellingDaysPerMonth: number;
  baseSalary: number;
  allowances: number;
  employerInsurance: number;
  otherEmployerCost: number;
  volumeBonusMode: VolumeBonusMode;
  volumeBonusTiers: VolumeBonusTier[];
  kpiTargetMetric: KpiTargetMetric;
  kpiTargetValue: number; // 0 = chưa thiết lập mục tiêu
  kpiBonusAt100: number;
  kpiExtraPerPctOver100: number;
  newCustomersCount: number;
  newCustomerBonusPerUnit: number;
  repeatCustomersCount: number;
  repeatCustomerBonusPerUnit: number;
  otherBonus: number;
  hasDeductionConfig: boolean;
  taxWithholdingRate: number; // 0..1
  employeeInsuranceRate: number; // 0..1
  otherDeductions: number;
  allocatedFixedOpCostMonthly: number;
  effectiveDate: string;
  approvalState: 'simulated' | 'approved';
  appliedToPlan: boolean;
  appliedMonth: number; // 0 = cả 12 tháng, 1..12 = tháng cụ thể
  appliedMode: 'replace' | 'add';
  items: SalesProfileProductItem[];
}

export interface ComputedSalesItemResult {
  itemId: string;
  productId: string;
  productName: string;
  monthlyInputQty: number; // Số con / đơn vị nhập bán được
  dailyAvgQty: number;
  revenueEquivalentQty: number; // Số kg thành phẩm hoặc đơn vị tính giá bán
  sellUnitLabel: string;
  inputUnitLabel: string;
  unitSellPrice: number;
  grossRevenue: number;
  netRevenue: number;
  cogs: number;
  variableSellingCostBeforeComm: number;
  contributionBeforeComm: number;
  commission: number;
}

export interface ComputedSalesProfileResult {
  profileId: string;
  totalMonthlyQty: number;
  totalDailyAvgQty: number;
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalCogs: number;
  totalVariableSellingBeforeComm: number;
  totalCommission: number;
  volumeBonus: number;
  kpiCompletionPct: number | null; // null nếu kpiTargetValue === 0
  kpiBonus: number;
  newCustomerBonus: number;
  repeatCustomerBonus: number;
  otherBonus: number;
  totalAllBonuses: number; // Volume + KPI + New + Repeat + Other
  fixedSalaryAndAllowance: number;
  grossIncome: number; // CTV hoặc Nhân viên trước khấu trừ (F12 / F13)
  estimatedDeductions: number;
  estimatedNetIncome: number | null; // null nếu chưa cấu hình đầy đủ khấu trừ (F14)
  companySellingCost: number; // F15
  organicContribution: number; // F16
  organicAllocatedProfit: number; // F17
}

export interface TargetIncomeSolverResult {
  targetIncome: number;
  feasible: boolean;
  reasonIfInfeasible: string;
  requiredMonthlyQty: number;
  requiredDailyAvgQty: number;
  roundedUpDailyQty: number;
  recalculatedMonthlyFromDaily: number;
  resultingRevenue: number;
  resultingCommission: number;
  resultingBonuses: number;
  resultingFixedIncome: number;
  resultingGrossIncome: number;
}

export interface ScenarioData {
  id: ScenarioId;
  name: string;
  description: string;
  products: ProductItem[];
  channelPlans: ChannelPlanItem[];
  staff: StaffMember[];
  operatingCosts: OperatingCostItem[];
  assets: AssetItem[];
  locations: LocationItem[];
  marketingCampaigns: MarketingCampaign[];
  assumptions: FinancialAssumptions;
  salesProfiles?: SalesProfile[];
}

export interface PlannerState {
  activeScenario: ScenarioId;
  scenarios: Record<ScenarioId, ScenarioData>;
  lastSavedAt: string;
}

// ---------- COMPUTED OUTPUT TYPES ----------

export interface ComputedProductCogs {
  productId: string;
  liveWeightPerUnitKg: number;
  batchLiveWeightKg: number;
  effectiveLiveKgCost: number;
  rawMaterialCostBatch: number;
  rawMaterialPerInputUnit: number;
  finishedWeightBatchKg: number;
  sellableWeightBatchKg: number;
  processingTotalBatch: number;
  totalCogsBatch: number;
  cogsPerFinishedKg: number | null;
  cogsPerInputUnit: number | null;
  cogsPerSellUnit: number | null;
  grossRevenueSampleBatch: number;
  sampleUnitSellRevenue: number;
  hasZeroFinishedWarning: boolean;
  hasBelowCostWarning: boolean;
}

export interface ComputedChannelLineMonthly {
  planId: string;
  productId: string;
  channelId: ChannelId;
  month: number;
  isInternalTransfer: boolean;
  volume: number;
  sellPrice: number;
  grossRevenue: number;
  tradeDiscount: number;
  returnsValue: number;
  revenueDeductions: number;
  netRevenue: number;
  unitCogs: number;
  cogs: number;
  grossProfit: number;
  cmBeforeCommission: number;
  ctvCommission: number;
  totalSalesReward: number;
  maxRewardCap: number;
  rewardOverCapAmount: number;
  variableSellingCost: number;
  contributionMargin: number;
  cmMarginPct: number | null;
  cmPerUnit: number | null;
}

export interface ComputedMonthlyPnl {
  month: number;
  soldVolumeTotal: number;
  grossRevenue: number;
  revenueDeductions: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  variableSellingCost: number;
  contributionMargin: number;
  fixedSellingCost: number;
  marketingCost: number;
  mediaCost: number;
  adminCost: number;
  otherFixedOpCost: number;
  depreciationCost: number;
  totalFixedOperatingCost: number;
  operatingProfit: number; // EBIT
  financialAndOtherNet: number;
  profitBeforeTax: number; // EBT
  estimatedCit: number;
  netProfit: number;
  netMarginPct: number | null;
  operatingMarginPct: number | null;
  profitPerUnit: number | null;
}

export interface ComputedMonthlyCashFlow {
  month: number;
  openingCash: number;
  customerReceipts: number;
  supplierPayments: number;
  hrCashOut: number;
  marketingMediaCashOut: number;
  adminStoreOtherCashOut: number;
  taxCashOut: number;
  operatingCashFlow: number;
  assetDisposalInflow: number;
  capexCashOut: number;
  investingCashFlow: number;
  loanDrawdown: number;
  equityInjection: number;
  loanPrincipalRepayment: number;
  loanInterestOut: number;
  dividendOutflow: number;
  financingCashFlow: number;
  endingCash: number;
}

export interface ComputedStoreSummary {
  locationId: string;
  name: string;
  type: LocationType;
  annualContributionMargin: number;
  annualDirectFixedCost: number;
  annualAssetDepreciation: number;
  annualAllocatedSharedCost: number;
  annualProfitBeforeAlloc: number;
  annualProfitAfterAlloc: number;
  monthlyAvgFixedCost: number;
  breakEvenUnitsMonthly: number | null;
}

export interface ComputedMarketingSummary {
  campaignId: string;
  name: string;
  pillar: MarketingPillar;
  totalCost: number;
  adSpend: number;
  costPerOrder: number | null;
  cac: number | null;
  conversionRatePct: number | null;
  roas: number | null;
  contributionEffect: number;
  overBudgetAmount: number;
}

export interface SystemWarning {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  month?: number;
}

export interface ComputedChannelSummary {
  channelId: ChannelId;
  channelName: string;
  volume: number;
  grossRevenue: number;
  netRevenue: number;
  cogs: number;
  variableSellingCost: number;
  contributionMargin: number;
  cmMarginPct: number | null;
  cmPerUnit: number | null;
}

export interface ComputedScenarioResult {
  scenarioId: ScenarioId;
  productCogsMap: Record<string, ComputedProductCogs>;
  monthlyLineItems: ComputedChannelLineMonthly[];
  monthlyPnl: ComputedMonthlyPnl[];
  annualPnl: ComputedMonthlyPnl;
  monthlyCashFlow: ComputedMonthlyCashFlow[];
  annualCashFlow: {
    openingCash: number;
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
    endingCash: number;
    lowestEndingCash: number;
    lowestCashMonth: number | null;
    additionalCapitalNeeded: number;
    additionalCapitalWithReserve: number;
  };
  channelSummaries: ComputedChannelSummary[];
  costStructure: { label: string; amount: number; pct: number }[];
  totalCapex: number;
  breakEven: {
    weightedAvgCmPerUnit: number | null;
    weightedCmRatio: number | null;
    monthlyAvgFixedCosts: number;
    annualFixedCosts: number;
    breakEvenUnitsMonthly: number | null;
    breakEvenUnitsAnnual: number | null;
    breakEvenRevenueAnnual: number | null;
    marginOfSafetyPct: number | null;
    plannedAnnualUnits: number;
  };
  storeSummaries: ComputedStoreSummary[];
  marketingSummaries: ComputedMarketingSummary[];
  dataGovernance: {
    totalTrackedItems: number;
    unconfirmedCount: number;
    confirmedCount: number;
    unenteredCount: number;
    assumedCount: number;
    quotedCount: number;
    approvedCount: number;
  };
  warnings: SystemWarning[];
}

export interface SensitivityInput {
  purchasePriceDeltaPct: number; // e.g. -10 to +30
  sellPriceDeltaPct: number;
  recoveryRateDeltaPctPoints: number; // e.g. -5 to +5
  volumeDeltaPct: number;
  commissionDeltaPctPoints: number;
  marketingDeltaPct: number;
  hrDeltaPct: number;
  extraStoresCount: number;
  capexDeltaPct: number;
}
