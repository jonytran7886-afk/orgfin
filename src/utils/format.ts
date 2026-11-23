import { ChannelId, DataStatus, MarketingPillar } from '../types/finance';

export const STATUS_LABELS: Record<DataStatus, string> = {
  unentered: 'Chưa nhập',
  assumed: 'Giả định',
  quoted: 'Đã có báo giá',
  confirmed: 'Đã xác nhận',
  approved: 'Đã phê duyệt',
};

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  direct: 'Khách hàng trực tiếp',
  ctv: 'CTV',
  agency: 'Đại lý',
  store: 'Cửa hàng Organic Việt Nam',
  b2b: 'Khách hàng tổ chức / Bếp ăn',
  internal_transfer: 'Chuyển kho nội bộ (Không tính DT)',
};

export const PILLAR_LABELS: Record<MarketingPillar, string> = {
  conversion: 'Marketing chuyển đổi bán hàng',
  brand: 'Truyền thông & xây dựng thương hiệu',
  pos: 'Hỗ trợ bán hàng tại điểm bán',
};

export function formatVnd(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Không xác định';
  }
  if (compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000_000) {
      return `${sign}${(abs / 1_000_000_000).toLocaleString('vi-VN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} tỷ`;
    }
    if (abs >= 1_000_000) {
      return `${sign}${(abs / 1_000_000).toLocaleString('vi-VN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} tr`;
    }
  }
  return `${Math.round(value).toLocaleString('vi-VN')} đ`;
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Không xác định';
  }
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Không xác định';
  }
  return `${value.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export function safeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function getStatusColorClass(status: DataStatus): string {
  switch (status) {
    case 'approved':
    case 'confirmed':
      return 'text-emerald-700';
    case 'quoted':
    case 'assumed':
      return 'text-amber-700';
    case 'unentered':
    default:
      return 'text-red-700';
  }
}

export function isUnconfirmedStatus(status: DataStatus): boolean {
  return status === 'unentered' || status === 'assumed' || status === 'quoted';
}
