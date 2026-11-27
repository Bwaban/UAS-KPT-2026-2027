export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${formatNumber(value, decimals)}%`;
}

export function formatSeconds(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return "0 dtk";
  return `${formatNumber(value, decimals)} dtk`;
}
