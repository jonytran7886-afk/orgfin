import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Clock, FileQuestion } from 'lucide-react';
import { DataStatus } from '../types/finance';
import { STATUS_LABELS, getStatusColorClass } from '../utils/format';

interface NumericCellProps {
  value: number;
  mode?: 'currency' | 'percent' | 'number' | 'decimal';
  decimals?: number;
  onChange: (nextVal: number) => void;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}

export const NumericCell: React.FC<NumericCellProps> = ({
  value,
  mode = 'currency',
  decimals = 0,
  onChange,
  min,
  max,
  className = '',
  ariaLabel,
}) => {
  const displayScale = mode === 'percent' ? 100 : 1;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!editing) {
      const scaled = value * displayScale;
      setDraft(
        Number.isFinite(scaled)
          ? mode === 'decimal' || mode === 'percent'
            ? Number(scaled.toFixed(decimals || 1)).toString()
            : Math.round(scaled).toString()
          : '0'
      );
    }
  }, [value, editing, displayScale, decimals, mode]);

  const commit = () => {
    setEditing(false);
    const normalized = draft.replace(/\s+/g, '').replace(',', '.');
    let parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return;
    }
    let next = parsed / displayScale;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (next !== value) {
      onChange(next);
    }
  };

  const formattedText = (() => {
    if (!Number.isFinite(value)) return '0';
    if (mode === 'currency') {
      return `${Math.round(value).toLocaleString('vi-VN')} đ`;
    }
    if (mode === 'percent') {
      return `${(value * 100).toLocaleString('vi-VN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}%`;
    }
    return value.toLocaleString('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  })();

  if (editing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          } else if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
        className={`w-full min-w-[64px] whitespace-nowrap rounded border border-emerald-600 bg-white px-2 py-1 text-right font-num text-xs text-slate-900 outline-none ring-2 ring-emerald-600/20 ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const scaled = value * displayScale;
        setDraft(
          mode === 'decimal' || mode === 'percent'
            ? Number(scaled.toFixed(decimals || 1)).toString()
            : Math.round(scaled).toString()
        );
        setEditing(true);
      }}
      aria-label={ariaLabel}
      title={`${formattedText} (Nhấp để chỉnh sửa)`}
      className={`w-full whitespace-nowrap cursor-text rounded border border-transparent px-2 py-1 text-right font-num text-xs text-slate-900 transition-colors hover:border-slate-300 hover:bg-emerald-50/40 focus-visible:border-emerald-600 focus-visible:outline-none ${className}`}
    >
      {formattedText}
    </button>
  );
};

interface TextCellProps {
  value: string;
  onChange: (nextVal: string) => void;
  className?: string;
  placeholder?: string;
}

export const TextCell: React.FC<TextCellProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) {
      onChange(draft);
    }
  };

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={`w-full rounded border border-emerald-600 bg-white px-2 py-1 text-xs text-slate-900 outline-none ring-2 ring-emerald-600/20 ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title={value ? `${value} (Nhấp để sửa)` : placeholder || 'Nhấp để sửa nội dung'}
      className={`block w-full cursor-text truncate rounded border border-transparent px-2 py-1 text-left text-xs text-slate-900 transition-colors hover:border-slate-300 hover:bg-emerald-50/40 focus-visible:border-emerald-600 focus-visible:outline-none ${className}`}
    >
      {value || <span className="text-slate-400">{placeholder || '—'}</span>}
    </button>
  );
};

interface StatusSelectProps {
  value: DataStatus;
  onChange: (next: DataStatus) => void;
}

export const StatusSelect: React.FC<StatusSelectProps> = ({ value, onChange }) => {
  const Icon =
    value === 'approved' || value === 'confirmed'
      ? CheckCircle2
      : value === 'unentered'
      ? AlertCircle
      : value === 'quoted'
      ? Clock
      : FileQuestion;

  return (
    <div
      title={STATUS_LABELS[value]}
      className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium ${getStatusColorClass(value)}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DataStatus)}
        aria-label="Trạng thái dữ liệu"
        className="cursor-pointer bg-transparent py-0.5 pr-1 text-xs font-medium whitespace-nowrap outline-none hover:underline focus-visible:ring-1 focus-visible:ring-emerald-600"
      >
        {(Object.keys(STATUS_LABELS) as DataStatus[]).map((st) => (
          <option key={st} value={st} className="text-slate-900">
            {STATUS_LABELS[st]}
          </option>
        ))}
      </select>
    </div>
  );
};
