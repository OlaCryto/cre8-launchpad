/**
 * Format a token price for display.
 * - Very small prices: show with subscript-style zeros, e.g. 0.0₆1 for 0.0000001
 * - Normal prices: show up to 6 decimals
 */
export function formatPrice(price: number): string {
  if (price === 0) return '0';
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (price >= 0.001) return price.toFixed(6);

  // Count leading zeros after "0."
  const str = price.toFixed(18);
  const afterDot = str.split('.')[1] || '';
  let zeros = 0;
  for (const ch of afterDot) {
    if (ch === '0') zeros++;
    else break;
  }

  // Get first 4 significant digits
  const significant = afterDot.slice(zeros, zeros + 4).replace(/0+$/, '');

  if (zeros >= 4) {
    // Use subscript notation: 0.0₅1234
    return `0.0\u2080${subscriptDigit(zeros)}${significant}`;
  }

  // Just show the decimal
  return price.toFixed(Math.min(zeros + 4, 18)).replace(/0+$/, '');
}

function subscriptDigit(n: number): string {
  const subscripts = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
  return String(n).split('').map(d => subscripts[parseInt(d)]).join('');
}
