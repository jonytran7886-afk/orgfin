import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Play,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  ComputedScenarioResult,
  FinancialAssumptions,
  PlannerState,
  ScenarioData,
  ScenarioId,
} from '../types/finance';
import {
  VerificationTestResult,
  runAcceptanceVerification,
} from '../engine/verification';
import {
  exportPlanToExcel,
  exportPlanToJson,
  parseAndValidateImportedJson,
} from '../utils/exportImport';
import { ConfirmModal } from './ConfirmModal';
import { NumericCell, StatusSelect } from './EditableCell';

interface SettingsDataViewProps {
  state: PlannerState;
  scenario: ScenarioData;
  resultsByScenario: Record<ScenarioId, ComputedScenarioResult>;
  onUpdateScenario: (updater: (prev: ScenarioData) => ScenarioData) => void;
  onReplaceAllState: (nextState: PlannerState) => void;
  onResetToDefault: () => void;
}

export const SettingsDataView: React.FC<SettingsDataViewProps> = ({
  state,
  scenario,
  resultsByScenario,
  onUpdateScenario,
  onReplaceAllState,
  onResetToDefault,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [verificationResults, setVerificationResults] = useState<
    VerificationTestResult[] | null
  >(null);

  const assumptions = scenario.assumptions;

  const updateAssumptions = (patch: Partial<FinancialAssumptions>) => {
    onUpdateScenario((prev) => ({
      ...prev,
      assumptions: {
        ...prev.assumptions,
        ...patch,
        updatedAt: new Date().toISOString().slice(0, 10),
      },
    }));
  };

  const updateMonthArray = (
    key:
      | 'equityInjectionByMonth'
      | 'loanDrawdownByMonth'
      | 'loanPrincipalRepaymentByMonth'
      | 'loanInterestByMonth',
    monthIdx: number,
    val: number
  ) => {
    const next = [...assumptions[key]];
    next[monthIdx] = val;
    updateAssumptions({ [key]: next });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const parsed = parseAndValidateImportedJson(content);
      if (!parsed.ok) {
        setImportFeedback({ type: 'error', message: parsed.error });
      } else {
        onReplaceAllState(parsed.data);
        setImportFeedback({
          type: 'success',
          message: `Đã phục hồi thành công toàn bộ 3 kịch bản từ tệp "${file.name}".`,
        });
      }
    };
    reader.onerror = () => {
      setImportFeedback({
        type: 'error',
        message: 'Không thể đọc tệp từ máy tính. Vui lòng thử lại.',
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Thông số tài chính, sao lưu & kiểm chứng dữ liệu
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Cấu hình vốn lưu động, công nợ, thuế thu nhập, tài trợ vốn và sao lưu/phục hồi kế hoạch qua tệp JSON hoặc Excel.
        </p>
      </div>

      {/* Browser Storage Notice (Section XVI) */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <strong>Lưu ý về lưu trữ cục bộ (Không dùng máy chủ database):</strong>{' '}
          Mọi thay đổi được tự động lưu ngay trên trình duyệt hiện tại của bạn. Dữ liệu trên trình duyệt này sẽ <strong>không tự đồng bộ</strong> sang trình duyệt hoặc máy tính khác. Hãy sử dụng nút <strong>Xuất JSON</strong> để sao lưu định kỳ.
        </div>
      </div>

      {/* Backup / Restore / Export Controls */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="font-display text-sm font-semibold text-slate-900">
          Sao lưu, Phục hồi & Xuất báo cáo
        </h3>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => exportPlanToExcel(state, resultsByScenario)}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Xuất Excel (.xlsx) đầy đủ 8 sheet
          </button>

          <button
            type="button"
            onClick={() => exportPlanToJson(state)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            Sao lưu toàn bộ cấu hình (JSON)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4" />
            Phục hồi từ tệp JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Khôi phục dữ liệu mẫu mặc định
          </button>
        </div>

        {importFeedback && (
          <div
            className={`mt-3 rounded border px-3 py-2 text-xs font-medium ${
              importFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {importFeedback.message}
          </div>
        )}
      </div>

      {/* Global Assumptions Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Giả định công nợ, thuế & dự trữ tiền mặt ({scenario.name})
            </h3>
            <StatusSelect
              value={assumptions.status}
              onChange={(s) => updateAssumptions({ status: s })}
            />
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Tiền mặt đầu kỳ (Đầu Tháng 1)</span>
              <div className="w-36">
                <NumericCell
                  value={assumptions.openingCash}
                  mode="currency"
                  min={0}
                  onChange={(v) => updateAssumptions({ openingCash: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Mức dự trữ tiền mặt tối thiểu</span>
              <div className="w-36">
                <NumericCell
                  value={assumptions.minCashReserve}
                  mode="currency"
                  min={0}
                  onChange={(v) => updateAssumptions({ minCashReserve: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Tỷ lệ thu tiền ngay trong tháng (%)</span>
              <div className="w-28">
                <NumericCell
                  value={assumptions.immediateCollectionPct}
                  mode="percent"
                  decimals={0}
                  min={0}
                  max={1}
                  onChange={(v) => updateAssumptions({ immediateCollectionPct: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Kỳ thu công nợ còn lại (số tháng)</span>
              <div className="w-24">
                <NumericCell
                  value={assumptions.arDelayMonths}
                  mode="number"
                  min={0}
                  max={3}
                  onChange={(v) =>
                    updateAssumptions({ arDelayMonths: Math.round(v) })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Tỷ lệ thanh toán ngay NCC (%)</span>
              <div className="w-28">
                <NumericCell
                  value={assumptions.immediateSupplierPayPct}
                  mode="percent"
                  decimals={0}
                  min={0}
                  max={1}
                  onChange={(v) => updateAssumptions({ immediateSupplierPayPct: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Kỳ trả công nợ NCC (số tháng)</span>
              <div className="w-24">
                <NumericCell
                  value={assumptions.apDelayMonths}
                  mode="number"
                  min={0}
                  max={3}
                  onChange={(v) =>
                    updateAssumptions({ apDelayMonths: Math.round(v) })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Thuế suất TNDN dự kiến (%)</span>
              <div className="w-28">
                <NumericCell
                  value={assumptions.citRate}
                  mode="percent"
                  decimals={1}
                  min={0}
                  max={0.5}
                  onChange={(v) => updateAssumptions({ citRate: v })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-slate-700">Điều chỉnh thu nhập chịu thuế/tháng</span>
              <div className="w-36">
                <NumericCell
                  value={assumptions.taxAdjustmentMonthly}
                  mode="currency"
                  onChange={(v) => updateAssumptions({ taxAdjustmentMonthly: v })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financing Schedule Table */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Lịch góp vốn, vay vốn & trả nợ theo tháng (T1 – T12)
          </h3>
          <div className="mt-3 max-h-[340px] overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                  <th className="py-2">Tháng</th>
                  <th className="py-2 text-right">Vốn góp nhận</th>
                  <th className="py-2 text-right">Giải ngân vay</th>
                  <th className="py-2 text-right">Trả gốc vay</th>
                  <th className="py-2 text-right">Trả lãi vay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 12 }, (_, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 font-num font-medium text-slate-700">
                      T{idx + 1}
                    </td>
                    <td className="py-1 px-1">
                      <NumericCell
                        value={assumptions.equityInjectionByMonth[idx] || 0}
                        mode="currency"
                        min={0}
                        onChange={(v) =>
                          updateMonthArray('equityInjectionByMonth', idx, v)
                        }
                      />
                    </td>
                    <td className="py-1 px-1">
                      <NumericCell
                        value={assumptions.loanDrawdownByMonth[idx] || 0}
                        mode="currency"
                        min={0}
                        onChange={(v) =>
                          updateMonthArray('loanDrawdownByMonth', idx, v)
                        }
                      />
                    </td>
                    <td className="py-1 px-1">
                      <NumericCell
                        value={assumptions.loanPrincipalRepaymentByMonth[idx] || 0}
                        mode="currency"
                        min={0}
                        onChange={(v) =>
                          updateMonthArray('loanPrincipalRepaymentByMonth', idx, v)
                        }
                      />
                    </td>
                    <td className="py-1 px-1">
                      <NumericCell
                        value={assumptions.loanInterestByMonth[idx] || 0}
                        mode="currency"
                        min={0}
                        onChange={(v) =>
                          updateMonthArray('loanInterestByMonth', idx, v)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section XVII Acceptance Formula Audit */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Kiểm chứng tự động bộ công thức tài chính (Tiêu chí nghiệm thu Mục XVII)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Chạy 8 bài kiểm thử đối chiếu giá vốn gà, hoa hồng CTV, định phí, khấu hao đầu tư, điểm hòa vốn, bình quân gia quyền kênh và dòng tiền.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVerificationResults(runAcceptanceVerification())}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-700 bg-white px-3.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            Chạy kiểm thử công thức
          </button>
        </div>

        {verificationResults && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Nội dung kiểm thử</th>
                  <th className="px-3 py-2">Kết quả kỳ vọng</th>
                  <th className="px-3 py-2">Hệ thống tính</th>
                  <th className="px-3 py-2 text-right">Kết luận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verificationResults.map((vr) => (
                  <tr key={vr.id}>
                    <td className="px-3 py-2 font-num text-slate-500">{vr.id}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {vr.title}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{vr.expected}</td>
                    <td className="px-3 py-2 font-num text-slate-800">{vr.actual}</td>
                    <td className="px-3 py-2 text-right">
                      {vr.passed ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đạt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-red-700">
                          <XCircle className="h-3.5 w-3.5" />
                          Chưa đạt
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmResetOpen}
        title="Khôi phục dữ liệu mẫu mặc định?"
        description="Toàn bộ các thay đổi bạn đã nhập trong 3 kịch bản trên trình duyệt sẽ được thay thế bằng bộ dữ liệu mẫu chuẩn Organic Việt Nam. Bạn nên xuất sao lưu JSON trước khi thực hiện."
        confirmLabel="Khôi phục mặc định"
        destructive
        onConfirm={() => {
          onResetToDefault();
          setConfirmResetOpen(false);
          setImportFeedback({
            type: 'success',
            message: 'Đã khôi phục dữ liệu mẫu Organic Việt Nam.',
          });
        }}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
