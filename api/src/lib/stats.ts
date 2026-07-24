function median(sorted: number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 !== 0) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quartiles(values: number[]): { q1: number; q3: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted.slice(0, mid);
  const upper = sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);
  return { q1: median(lower), q3: median(upper) };
}

// Detecção de outlier por IQR (1.5x), contra a mediana/faixa dos preços atuais da cidade.
// Amostra pequena (<4 postos) ou sem variação de preço não dá base estatística — não marca outlier.
export function isPriceOutlier(value: number, cityPrices: number[]): boolean {
  if (cityPrices.length < 4) return false;
  const { q1, q3 } = quartiles(cityPrices);
  const iqr = q3 - q1;
  if (iqr === 0) return false;
  return value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr;
}
