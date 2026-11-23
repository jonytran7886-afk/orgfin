import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Database,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Undo2,
  X,
} from 'lucide-react';
import { createDefaultPlannerState } from './data/defaultPlan';
import { computeScenario } from './engine/calculator';
import {
  ComputedScenarioResult,
  PlannerState,
  ScenarioData,
  ScenarioId,
} from './types/finance';
import { exportPlanToExcel, exportPlanToJson } from './utils/exportImport';
import { DashboardView } from './components/DashboardView';
import { ProductsCogsView } from './components/ProductsCogsView';
import { OperatingCostsView } from './components/OperatingCostsView';
import { InvestmentsStoresView } from './components/InvestmentsStoresView';
import { FinancialPlanView } from './components/FinancialPlanView';
import { SettingsDataView } from './components/SettingsDataView';

const STORAGE_KEY = 'organic_vn_planner_v1';
const MAX_UNDO = 30;

type NavSection =
  | 'dashboard'
  | 'products'
  | 'costs'
  | 'investments'
  | 'financial'
  | 'settings';

const NAV_ITEMS: {
  id: NavSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: '1. Tổng quan – Dashboard', icon: LayoutDashboard },
  { id: 'products', label: '2. Sản phẩm & Doanh thu', icon: Package },
  { id: 'costs', label: '3. Chi phí hoạt động', icon: Receipt },
  { id: 'investments', label: '4. Đầu tư & Điểm bán', icon: Building2 },
  { id: 'financial', label: '5. Kế hoạch tài chính', icon: BarChart3 },
  { id: 'settings', label: '6. Thông số và dữ liệu', icon: Database },
];

const SCENARIO_TABS: { id: ScenarioId; label: string }[] = [
  { id: 'conservative', label: 'Thận trọng' },
  { id: 'base', label: 'Cơ sở' },
  { id: 'growth', label: 'Tăng trưởng' },
];

function loadInitialState(): PlannerState {
  const defaults = createDefaultPlannerState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlannerState;
      if (
        parsed?.scenarios?.base &&
        parsed?.scenarios?.conservative &&
        parsed?.scenarios?.growth
      ) {
        for (const sid of ['base', 'conservative', 'growth'] as ScenarioId[]) {
          if (!Array.isArray(parsed.scenarios[sid].salesProfiles)) {
            parsed.scenarios[sid].salesProfiles = defaults.scenarios[sid].salesProfiles;
          }
        }
        return parsed;
      }
    }
  } catch {
    // Fallback to clean default dataset
  }
  return defaults;
}

export default function App() {
  const [state, setState] = useState<PlannerState>(() => loadInitialState());
  const [undoStack, setUndoStack] = useState<PlannerState[]>([]);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Auto-save to localStorage on every state update
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota issues gracefully
    }
  }, [state]);

  const commitStateChange = useCallback(
    (updater: (prev: PlannerState) => PlannerState) => {
      setState((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        setUndoStack((hist) => [...hist.slice(-(MAX_UNDO - 1)), prev]);
        return {
          ...next,
          lastSavedAt: new Date().toISOString(),
        };
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoStack((hist) => {
      if (hist.length === 0) return hist;
      const previous = hist[hist.length - 1];
      setState(previous);
      return hist.slice(0, -1);
    });
  }, []);

  // Keyboard Ctrl+Z / Cmd+Z undo shortcut (when not typing in an input)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (!isEditingField && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo]);

  const updateActiveScenario = useCallback(
    (updater: (prev: ScenarioData) => ScenarioData) => {
      commitStateChange((prev) => ({
        ...prev,
        scenarios: {
          ...prev.scenarios,
          [prev.activeScenario]: updater(prev.scenarios[prev.activeScenario]),
        },
      }));
    },
    [commitStateChange]
  );

  const setActiveScenarioId = (id: ScenarioId) => {
    setState((prev) => ({ ...prev, activeScenario: id }));
  };

  const handleCloneScenarioTo = (targetId: ScenarioId) => {
    commitStateChange((prev) => {
      const source = structuredClone(prev.scenarios[prev.activeScenario]);
      const targetMeta =
        targetId === 'conservative'
          ? 'Kịch bản Thận trọng'
          : targetId === 'base'
          ? 'Kịch bản Cơ sở'
          : 'Kịch bản Tăng trưởng';
      return {
        ...prev,
        scenarios: {
          ...prev.scenarios,
          [targetId]: {
            ...source,
            id: targetId,
            name: targetMeta,
          },
        },
      };
    });
  };

  const handleResetToDefault = () => {
    commitStateChange(() => createDefaultPlannerState());
  };

  const handleReplaceAllState = (nextState: PlannerState) => {
    commitStateChange(() => nextState);
  };

  // Compute all 3 scenarios live so switching & comparison are instantaneous
  const resultsByScenario = useMemo<Record<ScenarioId, ComputedScenarioResult>>(
    () => ({
      conservative: computeScenario(state.scenarios.conservative),
      base: computeScenario(state.scenarios.base),
      growth: computeScenario(state.scenarios.growth),
    }),
    [state.scenarios]
  );

  const activeScenarioData = state.scenarios[state.activeScenario];
  const activeResult = resultsByScenario[state.activeScenario];
  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeNav) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar (3-zone contract) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 lg:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Mở menu điều hướng"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Organic Việt Nam
          </span>
        </div>

        <nav
          aria-label="Phạm vi khu vực"
          className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-500"
        >
          <span className="text-slate-900 whitespace-nowrap shrink-0">
            {activeNavMeta.label}
          </span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap shrink-0">
            {activeScenarioData.name}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-num whitespace-nowrap shrink-0">
            Chưa xác nhận: {activeResult.dataGovernance.unconfirmedCount}/
            {activeResult.dataGovernance.totalTrackedItems}
          </span>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => exportPlanToExcel(state, resultsByScenario)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Xuất Excel
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation (6 Core Sections) */}
        <aside
          className={`fixed inset-y-14 left-0 z-20 w-64 border-r border-slate-200 bg-white transition-transform lg:static lg:inset-auto lg:block lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col justify-between p-4">
            <nav aria-label="Điều hướng chính" className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
              <div className="font-medium text-slate-700">Lưu trữ cục bộ</div>
              <p className="mt-1">
                Dữ liệu lưu trên trình duyệt này và không tự đồng bộ sang máy khác.
              </p>
              <button
                type="button"
                onClick={() => exportPlanToJson(state)}
                className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
              >
                <Download className="h-3 w-3" />
                Sao lưu JSON ngay
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="min-w-0 flex-1">
          {/* Workspace Toolbar: Scenario Switcher, Undo & Save Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 lg:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Kịch bản:
              </span>
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {SCENARIO_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveScenarioId(tab.id)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      state.activeScenario === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Hoàn tác thao tác gần nhất (Ctrl+Z)"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Hoàn tác ({undoStack.length})
              </button>

              <button
                type="button"
                onClick={() => exportPlanToJson(state)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Sao lưu JSON
              </button>

              <span className="hidden sm:inline font-num text-[11px] text-slate-400 whitespace-nowrap">
                Đã lưu cục bộ lúc{' '}
                {new Date(state.lastSavedAt).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Active View */}
          <div className="mx-auto max-w-[1440px] p-4 lg:p-6">
            {activeNav === 'dashboard' && (
              <DashboardView
                scenario={activeScenarioData}
                result={activeResult}
                onUpdateScenario={updateActiveScenario}
                onNavigateTab={(tab) => setActiveNav(tab as NavSection)}
              />
            )}
            {activeNav === 'products' && (
              <ProductsCogsView
                scenario={activeScenarioData}
                result={activeResult}
                onUpdateScenario={updateActiveScenario}
              />
            )}
            {activeNav === 'costs' && (
              <OperatingCostsView
                scenario={activeScenarioData}
                result={activeResult}
                onUpdateScenario={updateActiveScenario}
              />
            )}
            {activeNav === 'investments' && (
              <InvestmentsStoresView
                scenario={activeScenarioData}
                result={activeResult}
                onUpdateScenario={updateActiveScenario}
              />
            )}
            {activeNav === 'financial' && (
              <FinancialPlanView
                activeScenarioId={state.activeScenario}
                scenario={activeScenarioData}
                resultsByScenario={resultsByScenario}
                onCloneScenarioTo={handleCloneScenarioTo}
              />
            )}
            {activeNav === 'settings' && (
              <SettingsDataView
                state={state}
                scenario={activeScenarioData}
                resultsByScenario={resultsByScenario}
                onUpdateScenario={updateActiveScenario}
                onReplaceAllState={handleReplaceAllState}
                onResetToDefault={handleResetToDefault}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
