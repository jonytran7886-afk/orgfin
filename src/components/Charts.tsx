import React, { useState } from 'react';
import { ComputedChannelSummary, ComputedMonthlyPnl } from '../types/finance';
import { formatPct, formatVnd } from '../utils/format';

interface MonthlyChartProps {
  monthlyPnl: ComputedMonthlyPnl[];
}

export const MonthlyRevenueCostProfitChart: React.FC<MonthlyChartProps> = ({
  monthlyPnl,
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const costs = monthlyPnl.map(
    (m) => m.cogs + m.variableSellingCost + m.totalFixedOperatingCost
  );
  const maxVal = Math.max(
    1,
    ...monthlyPnl.map((m) => m.netRevenue),
    ...costs,
    ...monthlyPnl.map((m) => Math.abs(m.operatingProfit))
  );
  const minVal = Math.min(0, ...monthlyPnl.map((m) => m.operatingProfit));
  const range = maxVal - minVal || 1;

  const width = 680;
  const height = 250;
  const padL = 56;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const yOf = (val: number) => padT + ((maxVal - val) / range) * plotH;
  const zeroY = yOf(0);
  const slotW = plotW / 12;
  const barW = Math.min(16, slotW * 0.32);

  const profitPoints = monthlyPnl
    .map((m, idx) => {
      const cx = padL + idx * slotW + slotW / 2;
      const cy = yOf(m.operatingProfit);
      return `${cx},${cy}`;
    })
    .join(' ');

  const activeData =
    hoveredMonth !== null ? monthlyPnl[hoveredMonth - 1] : null;

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-emerald-700" />
            Doanh thu thuần
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-slate-300" />
            Tổng chi phí
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-amber-600" />
            Lợi nhuận hoạt động (EBIT)
          </span>
        </div>
        <div className="min-h-[20px] font-num text-xs text-slate-700">
          {activeData ? (
            <span>
              T{activeData.month}: DT{' '}
              <strong className="text-emerald-700">
                {formatVnd(activeData.netRevenue, true)}
              </strong>{' '}
              · CP{' '}
              <strong>
                {formatVnd(
                  activeData.cogs +
                    activeData.variableSellingCost +
                    activeData.totalFixedOperatingCost,
                  true
                )}
              </strong>{' '}
              · EBIT{' '}
              <strong
                className={
                  activeData.operatingProfit >= 0
                    ? 'text-amber-700'
                    : 'text-red-700'
                }
              >
                {formatVnd(activeData.operatingProfit, true)}
              </strong>
            </span>
          ) : (
            <span className="text-slate-400">Di chuột qua tháng để xem chi tiết</span>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-60 w-full select-none overflow-visible"
        role="img"
        aria-label="Biểu đồ doanh thu, chi phí và lợi nhuận hoạt động 12 tháng"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const val = minVal + (1 - t) * range;
          const y = padT + t * plotH;
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={Math.abs(val) < 1 ? undefined : '3 3'}
                strokeWidth={Math.abs(val) < 1 ? 1.2 : 1}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-500 font-num text-[10px]"
              >
                {formatVnd(val, true).replace(' đ', '')}
              </text>
            </g>
          );
        })}

        {monthlyPnl.map((m, idx) => {
          const totalCost =
            m.cogs + m.variableSellingCost + m.totalFixedOperatingCost;
          const slotX = padL + idx * slotW;
          const revX = slotX + slotW / 2 - barW - 1.5;
          const costX = slotX + slotW / 2 + 1.5;
          const revY = yOf(m.netRevenue);
          const costY = yOf(totalCost);
          const isHovered = hoveredMonth === m.month;

          return (
            <g
              key={m.month}
              onMouseEnter={() => setHoveredMonth(m.month)}
              onMouseLeave={() => setHoveredMonth(null)}
              className="cursor-pointer"
            >
              <rect
                x={slotX}
                y={padT}
                width={slotW}
                height={plotH}
                fill={isHovered ? 'rgba(15, 23, 42, 0.03)' : 'transparent'}
              />
              <rect
                x={revX}
                y={Math.min(revY, zeroY)}
                width={barW}
                height={Math.max(1, Math.abs(zeroY - revY))}
                rx={2}
                fill={isHovered ? '#166534' : '#15803d'}
              />
              <rect
                x={costX}
                y={Math.min(costY, zeroY)}
                width={barW}
                height={Math.max(1, Math.abs(zeroY - costY))}
                rx={2}
                fill={isHovered ? '#94a3b8' : '#cbd5e1'}
              />
              <text
                x={slotX + slotW / 2}
                y={height - 8}
                textAnchor="middle"
                className={`font-num text-[11px] ${
                  isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                }`}
              >
                T{m.month}
              </text>
            </g>
          );
        })}

        <polyline
          fill="none"
          stroke="#d97706"
          strokeWidth={2.2}
          strokeLinejoin="round"
          points={profitPoints}
        />
        {monthlyPnl.map((m, idx) => {
          const cx = padL + idx * slotW + slotW / 2;
          const cy = yOf(m.operatingProfit);
          const isNeg = m.operatingProfit < 0;
          return (
            <circle
              key={`pt-${m.month}`}
              cx={cx}
              cy={cy}
              r={hoveredMonth === m.month ? 4.5 : 3}
              fill={isNeg ? '#dc2626' : '#d97706'}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
    </div>
  );
};

interface CostStructureChartProps {
  items: { label: string; amount: number; pct: number }[];
}

const COST_COLORS = [
  'bg-emerald-700',
  'bg-emerald-500',
  'bg-slate-600',
  'bg-amber-600',
  'bg-slate-400',
  'bg-slate-300',
];

export const CostStructureChart: React.FC<CostStructureChartProps> = ({
  items,
}) => {
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-3.5 w-full overflow-hidden rounded-sm bg-slate-100">
        {items.map((item, idx) =>
          item.pct > 0 ? (
            <div
              key={item.label}
              style={{ width: `${item.pct}%` }}
              className={`${COST_COLORS[idx % COST_COLORS.length]} transition-all`}
              title={`${item.label}: ${formatPct(item.pct)}`}
            />
          ) : null
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 py-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-xs ${
                  COST_COLORS[idx % COST_COLORS.length]
                }`}
              />
              <span className="truncate text-slate-700">{item.label}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 font-num">
              <span className="text-slate-900 font-medium">
                {formatVnd(item.amount, true)}
              </span>
              <span className="w-12 text-right text-slate-500">
                {formatPct(item.pct, 1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs font-semibold text-slate-900">
        <span>Tổng chi phí hoạt động & giá vốn</span>
        <span className="font-num">{formatVnd(total, true)}</span>
      </div>
    </div>
  );
};

interface ChannelChartProps {
  channels: ComputedChannelSummary[];
}

export const ChannelContributionChart: React.FC<ChannelChartProps> = ({
  channels,
}) => {
  const maxAbs = Math.max(
    1,
    ...channels.map((c) => Math.max(c.netRevenue, Math.abs(c.contributionMargin)))
  );

  return (
    <div className="space-y-3">
      {channels.map((c) => {
        const revWidth = Math.max(0, (c.netRevenue / maxAbs) * 100);
        const cmWidth = Math.max(0, (Math.abs(c.contributionMargin) / maxAbs) * 100);
        const isNeg = c.contributionMargin < 0;

        return (
          <div key={c.channelId} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-800 truncate">
                {c.channelName}
              </span>
              <div className="flex shrink-0 items-center gap-3 font-num">
                <span className="text-slate-500">
                  DT: {formatVnd(c.netRevenue, true)}
                </span>
                <span
                  className={`font-semibold ${
                    isNeg ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  CM: {formatVnd(c.contributionMargin, true)} (
                  {formatPct(c.cmMarginPct, 1)})
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-full rounded-xs bg-slate-100">
                <div
                  className="h-2 rounded-xs bg-slate-300"
                  style={{ width: `${revWidth}%` }}
                />
              </div>
              <div className="h-2 w-full rounded-xs bg-slate-100">
                <div
                  className={`h-2 rounded-xs ${
                    isNeg ? 'bg-red-600' : 'bg-emerald-700'
                  }`}
                  style={{ width: `${cmWidth}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
