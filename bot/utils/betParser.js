/**
 * Parse format taruhan user:
 * B100, K50, GA200, GE100, BGA150, BGE100, KGA100, KGE100
 * 11J100, T100, L100, P100, TB100
 * 5DS100, 5TS100, N100, H100, S100
 */
function parseBet(text) {
  const input = text.trim().toUpperCase();

  // === Single-digit spesifik (DS / TS) ===
  let match = input.match(/^([1-6])(DS|TS)(\d+)$/);
  if (match) {
    return { betType: match[2], diceSpecific: parseInt(match[1]), betAmount: parseInt(match[3]) };
  }

  // === Jumlah (J) ===
  match = input.match(/^(\d+)J(\d+)$/);
  if (match) {
    const total = parseInt(match[1]);
    if (total < 4 || total > 17) return null;
    return { betType: 'J', jumlah: total, betAmount: parseInt(match[2]) };
  }

  // === Kombinasi 2-3 huruf ===
  const comboTypes = ['BGA', 'BGE', 'KGA', 'KGE'];
  for (const type of comboTypes) {
    if (input.startsWith(type)) {
      const amt = parseInt(input.slice(type.length));
      if (!isNaN(amt)) return { betType: type, betAmount: amt };
    }
  }

  // === 2-huruf GA / GE / TB ===
  const twoLetterTypes = ['GA', 'GE', 'TB'];
  for (const type of twoLetterTypes) {
    if (input.startsWith(type)) {
      const amt = parseInt(input.slice(type.length));
      if (!isNaN(amt)) return { betType: type, betAmount: amt };
    }
  }

  // === 1-huruf B / K / T / L / P / N / H / S ===
  const oneLetterTypes = ['B', 'K', 'T', 'L', 'P', 'N', 'H', 'S'];
  for (const type of oneLetterTypes) {
    if (input.startsWith(type) && !isNaN(input.slice(type.length)) && input.slice(type.length).length > 0) {
      return { betType: type, betAmount: parseInt(input.slice(type.length)) };
    }
  }

  return null;
}

module.exports = { parseBet };
