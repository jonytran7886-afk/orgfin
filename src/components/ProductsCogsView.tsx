import React, { useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ChannelId,
  ChannelPlanItem,
  CommissionMethod,
  ComputedScenarioResult,
  PricingUnit,
  ProductGroup,
  ProductItem,
  ScenarioData,
  StaffMember,
  SupplyType,
} from '../types/finance';
import {
  CHANNEL_LABELS,
  formatNumber,
  formatPct,
  formatVnd,
} from '../utils/format';
import { ConfirmModal } from './ConfirmModal';
import { NumericCell, StatusSelect, TextCell } from './EditableCell';
import { SalesIncomeView } from './SalesIncomeView';

interface ProductsCogsViewProps {
  scenario: ScenarioData;
  result: ComputedScenarioResult;
  onUpdateScenario: (updater: (prev: ScenarioData) => ScenarioData) => void;
}

type SubTab = 'products' | 'channels' | 'staff' | 'income';

export const ProductsCogsView: React.FC<ProductsCogsViewProps> = ({
  scenario,
  result,
  onUpdateScenario,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('products');
  const [selectedProductId, setSelectedProductId] = useState<string>(
    scenario.products[0]?.id || ''
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = Cả năm, 1..12 = Tháng cụ thể
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'product' | 'channel' | 'staff';
    id: string;
    label: string;
  } | null>(null);

  const selectedProduct =
    scenario.products.find((p) => p.id === selectedProductId) ??
    scenario.products[0];
  const selectedCogs = selectedProduct
    ? result.productCogsMap[selectedProduct.id]
    : undefined;

  const updateProduct = (id: string, patch: Partial<ProductItem>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === id
          ? { ...p, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : p
      ),
    }));
  };

  const addProduct = () => {
    const newId = `SP-${Date.now().toString().slice(-4)}`;
    const newProd: ProductItem = {
      id: newId,
      name: 'Sản phẩm hữu cơ mới',
      group: 'Gà',
      supplyType: 'purchased',
      inputUnit: 'con',
      sellUnit: 'kg thành phẩm',
      pricingUnit: 'per_kg_finished',
      avgLiveWeightKg: 2.0,
      purchasePricePerLiveKg: 65000,
      plannedInputCount: 1,
      recoveryRate: 0.70,
      commercialWasteRate: 0.0,
      inboundTransportPerUnit: 4000,
      slaughterCostPerUnit: 8000,
      processingCostPerUnit: 5000,
      packagingMaterialPerUnit: 3500,
      packingLaborPerUnit: 3000,
      variableStoragePerUnit: 1500,
      otherDirectProdPerUnit: 0,
      allocatedProdOverheadPerUnit: 0,
      targetSellPrice: 180000,
      priceIncludesVat: false,
      vatRate: 0,
      status: 'assumed',
      source: 'Nhập mới',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Phòng Thu mua',
      note: '',
    };
    onUpdateScenario((prev) => ({
      ...prev,
      products: [...prev.products, newProd],
    }));
    setSelectedProductId(newId);
  };

  const duplicateProduct = (p: ProductItem) => {
    const newId = `${p.id}-COPY-${Date.now().toString().slice(-3)}`;
    const copy: ProductItem = {
      ...structuredClone(p),
      id: newId,
      name: `${p.name} (Bản sao)`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onUpdateScenario((prev) => ({
      ...prev,
      products: [...prev.products, copy],
    }));
    setSelectedProductId(newId);
  };

  const updateChannelPlan = (id: string, patch: Partial<ChannelPlanItem>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      channelPlans: prev.channelPlans.map((c) =>
        c.id === id
          ? { ...c, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : c
      ),
    }));
  };

  const addChannelPlan = () => {
    const firstProd = scenario.products[0];
    const newId = `KB-${Date.now().toString().slice(-4)}`;
    const newPlan: ChannelPlanItem = {
      id: newId,
      productId: firstProd?.id || '',
      channelId: 'direct',
      isInternalTransfer: false,
      monthlyVolumes: new Array(12).fill(300),
      sellPrice: firstProd?.targetSellPrice || 180000,
      discountRate: 0.02,
      monthlyReturnsValue: 0,
      commissionMethod: 'fixed_per_unit',
      commissionValue: 0,
      kpiBonusMonthly: 0,
      newCustomerBonusMonthly: 0,
      repeatCustomerBonusMonthly: 0,
      otherBonusMonthly: 0,
      maxRewardBudgetPct: 0.35,
      guaranteedMinCommission: 0,
      orderStaffBonusPerUnit: 1000,
      deliveryCostPerUnit: 8000,
      paymentFeePct: 0.01,
      customerServicePerUnit: 1000,
      promoAsExpensePerUnit: 0,
      otherVariablePerUnit: 0,
      allocatedChannelVarMonthly: 0,
      status: 'assumed',
      source: 'Nhập mới',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Phòng Kinh doanh',
      note: '',
    };
    onUpdateScenario((prev) => ({
      ...prev,
      channelPlans: [...prev.channelPlans, newPlan],
    }));
  };

  const duplicateChannelPlan = (cp: ChannelPlanItem) => {
    const copy: ChannelPlanItem = {
      ...structuredClone(cp),
      id: `${cp.id}-COPY-${Date.now().toString().slice(-3)}`,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    onUpdateScenario((prev) => ({
      ...prev,
      channelPlans: [...prev.channelPlans, copy],
    }));
  };

  const updateStaff = (id: string, patch: Partial<StaffMember>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      staff: prev.staff.map((s) =>
        s.id === id
          ? { ...s, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : s
      ),
    }));
  };

  const addStaff = () => {
    const newStaff: StaffMember = {
      id: `NS-${Date.now().toString().slice(-4)}`,
      roleTitle: 'Vị trí nhân sự mới',
      department: 'Kinh doanh',
      headcount: 1,
      baseSalary: 12000000,
      allowance: 1000000,
      insuranceEmployer: 2500000,
      otherFixedHr: 0,
      periodicSalesBonus: 0,
      startMonth: 1,
      endMonth: 12,
      includeInPnl: true,
      status: 'assumed',
      source: 'Nhập mới',
      updatedAt: new Date().toISOString().slice(0, 10),
      owner: 'Nhân sự',
      note: '',
    };
    onUpdateScenario((prev) => ({
      ...prev,
      staff: [...prev.staff, newStaff],
    }));
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'product') {
      onUpdateScenario((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== deleteTarget.id),
      }));
    } else if (deleteTarget.type === 'channel') {
      onUpdateScenario((prev) => ({
        ...prev,
        channelPlans: prev.channelPlans.filter((c) => c.id !== deleteTarget.id),
      }));
    } else if (deleteTarget.type === 'staff') {
      onUpdateScenario((prev) => ({
        ...prev,
        staff: prev.staff.filter((s) => s.id !== deleteTarget.id),
      }));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Sản phẩm, giá vốn và doanh thu kênh bán
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Phân tách trọng lượng sống và thành phẩm, tính giá vốn theo Công thức 01–08 và lãi đóng góp từng kênh (Công thức 09–25).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {[
            { id: 'products', label: 'Sản phẩm & Giá vốn' },
            { id: 'channels', label: 'Kênh bán & Hoa hồng CTV' },
            { id: 'staff', label: 'Nhân sự & Lương cố định' },
            { id: 'income', label: 'Thu nhập nhân viên & CTV' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as SubTab)}
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

      {/* TAB 1: PRODUCTS & COGS */}
      {subTab === 'products' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Bảng cấu trúc sản phẩm & giá vốn (Chỉnh trực tiếp trên ô)
                </h3>
                <p className="text-xs text-slate-500">
                  Các cột nền xám nhạt là giá trị tự động tính (Calculated) — không chỉnh tay trực tiếp.
                </p>
              </div>
              <button
                type="button"
                onClick={addProduct}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm sản phẩm
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="px-2.5 py-2.5 whitespace-nowrap">Mã</th>
                    <th className="px-2 py-2.5 w-[165px] max-w-[165px]">Tên sản phẩm</th>
                    <th className="px-1.5 py-2.5 whitespace-nowrap">Nhóm</th>
                    <th className="px-1.5 py-2.5 whitespace-nowrap">Nguồn cung</th>
                    <th className="px-1.5 py-2.5 whitespace-nowrap">Định giá</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap" title="Trọng lượng sống / đơn vị (kg)">TL sống (kg)</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Giá/kg sống</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Thu hồi (%)</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap" title="Hao hụt thương mại (%)">Hao hụt (%)</th>
                    <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap" title="Trọng lượng thành phẩm (kg)">TL TP (kg)</th>
                    <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap">Giá vốn/đv</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Giá bán MT</th>
                    <th className="px-2 py-2.5 whitespace-nowrap">Trạng thái</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scenario.products.map((p) => {
                    const c = result.productCogsMap[p.id];
                    const isSelected = selectedProduct?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProductId(p.id)}
                        className={`transition-colors ${
                          isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-2.5 py-2 font-num text-[11px] font-medium text-slate-600 whitespace-nowrap">
                          {p.id}
                        </td>
                        <td className="px-1.5 py-1.5 w-[165px] max-w-[165px]">
                          <TextCell
                            value={p.name}
                            onChange={(v) => updateProduct(p.id, { name: v })}
                          />
                        </td>
                        <td className="px-1.5 py-1.5 whitespace-nowrap">
                          <select
                            value={p.group}
                            onChange={(e) =>
                              updateProduct(p.id, {
                                group: e.target.value as ProductGroup,
                              })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800"
                          >
                            {(['Gà', 'Lợn', 'Bò', 'Trứng', 'Rau củ', 'Khác'] as ProductGroup[]).map(
                              (g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              )
                            )}
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5 whitespace-nowrap">
                          <select
                            value={p.supplyType}
                            onChange={(e) => {
                              const nextType = e.target.value as SupplyType;
                              updateProduct(p.id, {
                                supplyType: nextType,
                                selfFarmedCosts:
                                  nextType === 'self_farmed' && !p.selfFarmedCosts
                                    ? {
                                        batchStandardLiveKg: 2000,
                                        batchStandardHeads: 1000,
                                        mortalityRate: 0.05,
                                        chickCost: 18000000,
                                        feedCost: 60000000,
                                        herbCost: 8000000,
                                        vetMedicineCost: 4000000,
                                        directFarmLaborCost: 14000000,
                                        utilitiesBeddingCost: 5000000,
                                        coopOpsCost: 4000000,
                                        farmDepreciationCost: 5000000,
                                        farmOverheadCost: 3000000,
                                        mortalityLossCost: 2500000,
                                        otherFarmCost: 1500000,
                                      }
                                    : p.selfFarmedCosts,
                              });
                            }}
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800"
                          >
                            <option value="purchased">Thu mua</option>
                            <option value="self_farmed">Tự sản xuất</option>
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5 whitespace-nowrap">
                          <select
                            value={p.pricingUnit}
                            onChange={(e) =>
                              updateProduct(p.id, {
                                pricingUnit: e.target.value as PricingUnit,
                              })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800"
                          >
                            <option value="per_kg_finished">Theo kg TP</option>
                            <option value="per_head">Nguyên con</option>
                            <option value="per_unit">Theo đơn vị</option>
                          </select>
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={p.avgLiveWeightKg}
                            mode="decimal"
                            decimals={2}
                            min={0.01}
                            onChange={(v) => updateProduct(p.id, { avgLiveWeightKg: v })}
                          />
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          {p.supplyType === 'purchased' ? (
                            <NumericCell
                              value={p.purchasePricePerLiveKg}
                              mode="currency"
                              min={0}
                              onChange={(v) =>
                                updateProduct(p.id, { purchasePricePerLiveKg: v })
                              }
                            />
                          ) : (
                            <div className="px-2 py-1 text-right font-num text-xs text-emerald-700 whitespace-nowrap">
                              {formatVnd(c?.effectiveLiveKgCost ?? 0)}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={p.recoveryRate}
                            mode="percent"
                            decimals={1}
                            min={0.05}
                            max={1}
                            onChange={(v) => updateProduct(p.id, { recoveryRate: v })}
                          />
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={p.commercialWasteRate}
                            mode="percent"
                            decimals={1}
                            min={0}
                            max={0.9}
                            onChange={(v) =>
                              updateProduct(p.id, { commercialWasteRate: v })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-num bg-slate-50 font-medium text-slate-800 whitespace-nowrap">
                          {formatNumber(
                            p.avgLiveWeightKg * p.recoveryRate,
                            2
                          )}{' '}
                          kg
                        </td>
                        <td className="px-2 py-1.5 text-right font-num bg-slate-50 font-semibold text-slate-900 whitespace-nowrap">
                          {c?.cogsPerSellUnit !== null && c?.cogsPerSellUnit !== undefined ? (
                            formatVnd(c.cogsPerSellUnit)
                          ) : (
                            <span className="text-red-700">Cảnh báo = 0</span>
                          )}
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={p.targetSellPrice}
                            mode="currency"
                            min={0}
                            onChange={(v) => updateProduct(p.id, { targetSellPrice: v })}
                          />
                        </td>
                        <td className="px-1.5 py-1.5 whitespace-nowrap">
                          <StatusSelect
                            value={p.status}
                            onChange={(st) => updateProduct(p.id, { status: st })}
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateProduct(p);
                              }}
                              title="Nhân bản sản phẩm"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({
                                  type: 'product',
                                  id: p.id,
                                  label: p.name,
                                });
                              }}
                              title="Xóa sản phẩm"
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

          {/* Selected Product Detailed Cost Breakdown & Formula 01-08 Inspector */}
          {selectedProduct && selectedCogs && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-7">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      Chi tiết chi phí chế biến & đóng gói – {selectedProduct.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tính trên 1 {selectedProduct.inputUnit} đầu vào (Không bao gồm giao hàng khách & hoa hồng CTV)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  {[
                    { key: 'inboundTransportPerUnit', label: 'Vận chuyển đầu vào (đ/đv)' },
                    { key: 'slaughterCostPerUnit', label: 'Chi phí giết mổ (đ/đv)' },
                    { key: 'processingCostPerUnit', label: 'Chi phí sơ chế (đ/đv)' },
                    { key: 'packagingMaterialPerUnit', label: 'Chi phí bao bì (đ/đv)' },
                    { key: 'packingLaborPerUnit', label: 'Chi phí đóng gói (đ/đv)' },
                    { key: 'variableStoragePerUnit', label: 'Bảo quản biến đổi (đ/đv)' },
                    { key: 'otherDirectProdPerUnit', label: 'SX trực tiếp khác (đ/đv)' },
                    { key: 'allocatedProdOverheadPerUnit', label: 'SX chung phân bổ (đ/đv)' },
                  ].map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between rounded border border-slate-100 bg-slate-50/50 px-3 py-2"
                    >
                      <span className="text-slate-700">{field.label}</span>
                      <div className="w-28">
                        <NumericCell
                          value={
                            selectedProduct[
                              field.key as keyof ProductItem
                            ] as number
                          }
                          mode="currency"
                          min={0}
                          onChange={(val) =>
                            updateProduct(selectedProduct.id, {
                              [field.key]: val,
                            } as Partial<ProductItem>)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Self-farmed 11 cost breakdown if self_farmed */}
                {selectedProduct.supplyType === 'self_farmed' &&
                  selectedProduct.selfFarmedCosts && (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <h4 className="font-display text-xs font-semibold text-emerald-800">
                        Cơ cấu giá thành tự nuôi theo lứa (Mục 4.3 – Không cộng trùng)
                      </h4>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                        <div className="flex items-center justify-between rounded border border-emerald-100 bg-emerald-50/30 px-3 py-1.5">
                          <span className="text-slate-700">Tổng kg sống đạt chuẩn</span>
                          <div className="w-28">
                            <NumericCell
                              value={selectedProduct.selfFarmedCosts.batchStandardLiveKg}
                              mode="number"
                              min={1}
                              onChange={(v) =>
                                updateProduct(selectedProduct.id, {
                                  selfFarmedCosts: {
                                    ...selectedProduct.selfFarmedCosts!,
                                    batchStandardLiveKg: v,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                        {(
                          [
                            ['chickCost', 'Con giống'],
                            ['feedCost', 'Thức ăn'],
                            ['herbCost', 'Thảo dược'],
                            ['vetMedicineCost', 'Thuốc, vaccine, thú y'],
                            ['directFarmLaborCost', 'Nhân công trực tiếp'],
                            ['utilitiesBeddingCost', 'Điện, nước, độn chuồng'],
                            ['coopOpsCost', 'Vận hành chuồng trại'],
                            ['farmDepreciationCost', 'Khấu hao trại'],
                            ['farmOverheadCost', 'Chi phí SX chung'],
                            ['mortalityLossCost', 'Hao hụt & tỷ lệ chết'],
                            ['otherFarmCost', 'Chi phí khác'],
                          ] as const
                        ).map(([k, lbl]) => (
                          <div
                            key={k}
                            className="flex items-center justify-between rounded border border-slate-100 px-3 py-1.5"
                          >
                            <span className="text-slate-700">{lbl}</span>
                            <div className="w-32">
                              <NumericCell
                                value={selectedProduct.selfFarmedCosts![k]}
                                mode="currency"
                                min={0}
                                onChange={(v) =>
                                  updateProduct(selectedProduct.id, {
                                    selfFarmedCosts: {
                                      ...selectedProduct.selfFarmedCosts!,
                                      [k]: v,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Formula 01-08 Verification Card */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-5">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Calculator className="h-4 w-4 text-emerald-700" />
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Kiểm tra công thức 01–08 (1 {selectedProduct.inputUnit})
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">01. Trọng lượng sống đầu vào</span>
                    <span className="font-num font-medium text-slate-900">
                      {formatNumber(selectedProduct.avgLiveWeightKg, 2)} kg
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">02. Chi phí nguyên liệu gốc</span>
                    <span className="font-num font-medium text-slate-900">
                      {formatVnd(selectedCogs.rawMaterialPerInputUnit)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">03. Trọng lượng thành phẩm</span>
                    <span className="font-num font-medium text-slate-900">
                      {formatNumber(
                        selectedProduct.avgLiveWeightKg * selectedProduct.recoveryRate,
                        2
                      )}{' '}
                      kg
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">04. Khối lượng bán được</span>
                    <span className="font-num font-medium text-slate-900">
                      {formatNumber(
                        selectedProduct.avgLiveWeightKg *
                          selectedProduct.recoveryRate *
                          (1 - selectedProduct.commercialWasteRate),
                        2
                      )}{' '}
                      kg
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">05. Tổng giá vốn thành phẩm/đv</span>
                    <span className="font-num font-semibold text-slate-900">
                      {formatVnd(selectedCogs.cogsPerInputUnit)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">06. Giá vốn / kg thành phẩm</span>
                    <span className="font-num font-semibold text-emerald-700">
                      {selectedCogs.cogsPerFinishedKg !== null
                        ? formatVnd(selectedCogs.cogsPerFinishedKg)
                        : 'Cảnh báo: KL TP = 0'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600">08. Doanh thu gộp chuẩn / 1 đv nhập</span>
                    <span className="font-num font-semibold text-slate-900">
                      {formatVnd(selectedCogs.sampleUnitSellRevenue)}
                    </span>
                  </div>
                </div>

                {selectedCogs.hasBelowCostWarning && (
                  <div className="mt-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Giá bán mục tiêu đang thấp hơn giá vốn/đơn vị bán. Cần điều chỉnh giá bán hoặc tối ưu tỷ lệ thu hồi.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHANNEL PLANS & COMMISSIONS */}
      {subTab === 'channels' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Kế hoạch sản lượng, giá bán & hoa hồng theo kênh
                </h3>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  aria-label="Chọn tháng hiển thị"
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                >
                  <option value={0}>Tổng hợp 12 tháng (Cả năm)</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      Tháng {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={addChannelPlan}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm dòng kênh bán
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="px-2.5 py-2.5 w-[150px] max-w-[150px]">Sản phẩm</th>
                    <th className="px-1.5 py-2.5 w-[135px] max-w-[135px]">Kênh bán</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">
                      {selectedMonth === 0
                        ? 'SL BQ/tháng'
                        : `SL T${selectedMonth}`}
                    </th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Giá bán</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Giảm (%)</th>
                    <th className="px-1.5 py-2.5 whitespace-nowrap">Cơ chế CTV</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Mức CTV</th>
                    <th className="px-2 py-2.5 text-right whitespace-nowrap">Giao hàng/đv</th>
                    <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap">
                      DT thuần
                    </th>
                    <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap">
                      Lãi ĐG
                    </th>
                    <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap">Biên CM</th>
                    <th className="px-1.5 py-2.5 whitespace-nowrap">Trạng thái</th>
                    <th className="px-2.5 py-2.5 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scenario.channelPlans.map((cp) => {
                    const computedLines = result.monthlyLineItems.filter(
                      (l) =>
                        l.planId === cp.id &&
                        (selectedMonth === 0 || l.month === selectedMonth)
                    );
                    const sumNetRev = computedLines.reduce(
                      (s, l) => s + l.netRevenue,
                      0
                    );
                    const sumCm = computedLines.reduce(
                      (s, l) => s + l.contributionMargin,
                      0
                    );
                    const sumOverCap = computedLines.reduce(
                      (s, l) => s + l.rewardOverCapAmount,
                      0
                    );
                    const cmPct = sumNetRev > 0 ? (sumCm / sumNetRev) * 100 : null;

                    const displayVol =
                      selectedMonth === 0
                        ? cp.monthlyVolumes.reduce((s, v) => s + v, 0) / 12
                        : cp.monthlyVolumes[selectedMonth - 1] || 0;

                    const prodName =
                      scenario.products.find((p) => p.id === cp.productId)?.name || '';

                    return (
                      <tr key={cp.id} className="hover:bg-slate-50/70">
                        <td className="px-1.5 py-1.5 w-[150px] max-w-[150px]">
                          <select
                            value={cp.productId}
                            title={prodName}
                            onChange={(e) =>
                              updateChannelPlan(cp.id, { productId: e.target.value })
                            }
                            className="w-full max-w-[145px] truncate rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900"
                          >
                            {scenario.products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1.5 py-1.5 w-[135px] max-w-[135px]">
                          <select
                            value={cp.channelId}
                            title={CHANNEL_LABELS[cp.channelId]}
                            onChange={(e) => {
                              const cid = e.target.value as ChannelId;
                              updateChannelPlan(cp.id, {
                                channelId: cid,
                                isInternalTransfer: cid === 'internal_transfer',
                              });
                            }}
                            className="w-full max-w-[130px] truncate rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-900"
                          >
                            {(Object.keys(CHANNEL_LABELS) as ChannelId[]).map((cid) => (
                              <option key={cid} value={cid}>
                                {CHANNEL_LABELS[cid]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={displayVol}
                            mode="number"
                            min={0}
                            onChange={(val) => {
                              const rounded = Math.round(val);
                              if (selectedMonth === 0) {
                                updateChannelPlan(cp.id, {
                                  monthlyVolumes: new Array(12).fill(rounded),
                                });
                              } else {
                                const nextVols = [...cp.monthlyVolumes];
                                nextVols[selectedMonth - 1] = rounded;
                                updateChannelPlan(cp.id, { monthlyVolumes: nextVols });
                              }
                            }}
                          />
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={cp.sellPrice}
                            mode="currency"
                            min={0}
                            onChange={(val) =>
                              updateChannelPlan(cp.id, { sellPrice: val })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={cp.discountRate}
                            mode="percent"
                            decimals={1}
                            min={0}
                            max={0.8}
                            onChange={(val) =>
                              updateChannelPlan(cp.id, { discountRate: val })
                            }
                          />
                        </td>
                        <td className="px-1.5 py-1.5 whitespace-nowrap">
                          <select
                            value={cp.commissionMethod}
                            onChange={(e) =>
                              updateChannelPlan(cp.id, {
                                commissionMethod: e.target.value as CommissionMethod,
                                commissionValue:
                                  e.target.value === 'fixed_per_unit' ? 10000 : 0.05,
                              })
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800"
                          >
                            <option value="fixed_per_unit">Cố định/đv</option>
                            <option value="pct_net_revenue">% Doanh thu</option>
                            <option value="pct_cm_before_comm">% Lãi đóng góp</option>
                          </select>
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={cp.commissionValue}
                            mode={
                              cp.commissionMethod === 'fixed_per_unit'
                                ? 'currency'
                                : 'percent'
                            }
                            decimals={1}
                            min={0}
                            onChange={(val) =>
                              updateChannelPlan(cp.id, { commissionValue: val })
                            }
                          />
                        </td>
                        <td className="px-1 py-1.5 whitespace-nowrap">
                          <NumericCell
                            value={cp.deliveryCostPerUnit}
                            mode="currency"
                            min={0}
                            onChange={(val) =>
                              updateChannelPlan(cp.id, { deliveryCostPerUnit: val })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-num bg-slate-50 font-medium text-slate-900 whitespace-nowrap">
                          {cp.isInternalTransfer ? (
                            <span className="text-slate-400">Nội bộ (0 đ)</span>
                          ) : (
                            formatVnd(sumNetRev, true)
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-num bg-slate-50 whitespace-nowrap">
                          {cp.isInternalTransfer ? (
                            <span className="text-slate-400">0 đ</span>
                          ) : (
                            <div>
                              <span
                                className={`font-semibold ${
                                  sumCm >= 0 ? 'text-emerald-700' : 'text-red-700'
                                }`}
                              >
                                {formatVnd(sumCm, true)}
                              </span>
                              {sumOverCap > 0 && (
                                <div className="text-[10px] text-amber-700">
                                  Vượt trần: {formatVnd(sumOverCap, true)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-num bg-slate-50 text-slate-700 whitespace-nowrap">
                          {cp.isInternalTransfer ? '—' : formatPct(cmPct, 1)}
                        </td>
                        <td className="px-1.5 py-1.5 whitespace-nowrap">
                          <StatusSelect
                            value={cp.status}
                            onChange={(st) => updateChannelPlan(cp.id, { status: st })}
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => duplicateChannelPlan(cp)}
                              title="Nhân bản dòng"
                              className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'channel',
                                  id: cp.id,
                                  label: `${CHANNEL_LABELS[cp.channelId]}`,
                                })
                              }
                              title="Xóa dòng"
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

          {/* Channel Aggregation Table (Formulas 18 & 19) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Tổng hợp hiệu quả theo 5 kênh bán (Cả năm – Không tính chuyển kho nội bộ)
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 pr-3 max-w-[180px]">Kênh bán</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Tổng sản lượng</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Doanh thu thuần</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Giá vốn</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">CP bán hàng biến đổi</th>
                    <th className="py-2 px-3 text-right whitespace-nowrap">Lãi đóng góp</th>
                    <th className="py-2 pl-3 text-right whitespace-nowrap">Biên CM (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.channelSummaries.map((cs) => (
                    <tr key={cs.channelId}>
                      <td
                        className="py-2 pr-3 max-w-[180px] truncate font-medium text-slate-900"
                        title={cs.channelName}
                      >
                        {cs.channelName}
                      </td>
                      <td className="py-2 px-3 text-right font-num whitespace-nowrap">
                        {formatNumber(Math.round(cs.volume))}
                      </td>
                      <td className="py-2 px-3 text-right font-num whitespace-nowrap">
                        {formatVnd(cs.netRevenue)}
                      </td>
                      <td className="py-2 px-3 text-right font-num whitespace-nowrap">
                        {formatVnd(cs.cogs)}
                      </td>
                      <td className="py-2 px-3 text-right font-num whitespace-nowrap">
                        {formatVnd(cs.variableSellingCost)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-num font-semibold whitespace-nowrap ${
                          cs.contributionMargin >= 0
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {formatVnd(cs.contributionMargin)}
                      </td>
                      <td className="py-2 pl-3 text-right font-num whitespace-nowrap">
                        {formatPct(cs.cmMarginPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SALES STAFF & HR */}
      {subTab === 'staff' && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Bảng lương cố định & nghĩa vụ nhân sự (Công thức 25)
              </h3>
              <p className="text-xs text-slate-500">
                Thưởng biến đổi theo đơn đã tính trong Kênh bán; không cộng trùng tại đây.
              </p>
            </div>
            <button
              type="button"
              onClick={addStaff}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm vị trí nhân sự
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="px-3 py-2.5 w-[185px] max-w-[185px]">Vị trí / Chức danh</th>
                  <th className="px-2 py-2.5 whitespace-nowrap">Bộ phận</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Số người</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Lương CB/người</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Phụ cấp/người</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">BH & Nghĩa vụ DN</th>
                  <th className="px-2 py-2.5 text-right whitespace-nowrap">Thưởng định kỳ</th>
                  <th className="px-2 py-2.5 text-right bg-slate-100 whitespace-nowrap">Tổng CP/tháng</th>
                  <th className="px-2 py-2.5 whitespace-nowrap">Trạng thái</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scenario.staff.map((st) => {
                  const monthlyTotal =
                    st.headcount *
                      (st.baseSalary +
                        st.allowance +
                        st.insuranceEmployer +
                        st.otherFixedHr) +
                    st.periodicSalesBonus;
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="px-2 py-1.5 w-[185px] max-w-[185px]">
                        <TextCell
                          value={st.roleTitle}
                          onChange={(v) => updateStaff(st.id, { roleTitle: v })}
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <select
                          value={st.department}
                          onChange={(e) =>
                            updateStaff(st.id, {
                              department: e.target.value as StaffMember['department'],
                            })
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          {[
                            'Kinh doanh',
                            'Marketing',
                            'Vận hành',
                            'Kho & Logistics',
                            'Cửa hàng',
                            'Quản lý',
                          ].map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={st.headcount}
                          mode="number"
                          min={0}
                          onChange={(v) =>
                            updateStaff(st.id, { headcount: Math.round(v) })
                          }
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={st.baseSalary}
                          mode="currency"
                          min={0}
                          onChange={(v) => updateStaff(st.id, { baseSalary: v })}
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={st.allowance}
                          mode="currency"
                          min={0}
                          onChange={(v) => updateStaff(st.id, { allowance: v })}
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={st.insuranceEmployer}
                          mode="currency"
                          min={0}
                          onChange={(v) =>
                            updateStaff(st.id, { insuranceEmployer: v })
                          }
                        />
                      </td>
                      <td className="px-1 py-1.5 whitespace-nowrap">
                        <NumericCell
                          value={st.periodicSalesBonus}
                          mode="currency"
                          min={0}
                          onChange={(v) =>
                            updateStaff(st.id, { periodicSalesBonus: v })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-num bg-slate-50 font-semibold text-slate-900 whitespace-nowrap">
                        {formatVnd(monthlyTotal)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <StatusSelect
                          value={st.status}
                          onChange={(s) => updateStaff(st.id, { status: s })}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'staff',
                              id: st.id,
                              label: st.roleTitle,
                            })
                          }
                          className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
                          title="Xóa vị trí"
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
      )}

      {/* TAB 4: SALES INCOME SIMULATOR (MODULE 07) */}
      {subTab === 'income' && (
        <SalesIncomeView
          scenario={scenario}
          result={result}
          onUpdateScenario={onUpdateScenario}
        />
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        title="Xác nhận xóa dòng dữ liệu"
        description={`Bạn có chắc muốn xóa "${deleteTarget?.label}"? Bạn vẫn có thể khôi phục bằng nút Hoàn tác (Undo) nếu cần.`}
        confirmLabel="Xóa dòng"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
