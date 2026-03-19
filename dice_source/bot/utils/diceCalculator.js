const settingsService = require('../../api/services/settingsService');

function calculateBet(bet, dice) {
  const [d1, d2, d3] = dice;
  const total = d1 + d2 + d3;
  const isTriple = d1 === d2 && d2 === d3;

  const { betType, betAmount, jumlah, diceSpecific } = bet;

  if (isTriple && betType !== 'T' && betType !== 'TS') {
    return { isWin: false, odds: 0, payout: 0, profit: -betAmount };
  }

  const config = settingsService.getSettings();
  if (!config) return { isWin: false, odds: 0, payout: 0, profit: -betAmount };
  
  const O = config.odds;
  let odds = 0;
  let isWin = false;

  switch (betType) {
    case 'B': isWin = total >= 11 && total <= 18; odds = O.standard; break;
    case 'K': isWin = total >= 3 && total <= 10; odds = O.standard; break;
    case 'GA': isWin = total % 2 !== 0; odds = O.standard; break;
    case 'GE': isWin = total % 2 === 0; odds = O.standard; break;
    
    case 'BGA': isWin = [11, 13, 15, 17].includes(total); odds = O.BGA_KGE; break;
    case 'BGE': isWin = [12, 14, 16, 18].includes(total); odds = O.BGE_KGA; break;
    case 'KGA': isWin = [3, 5, 7, 9].includes(total); odds = O.BGE_KGA; break;
    case 'KGE': isWin = [4, 6, 8, 10].includes(total); odds = O.BGA_KGE; break;
    
    case 'J': isWin = total === jumlah; odds = getJumlahOdds(jumlah, O); break;
    case 'T': isWin = isTriple; odds = O.T; break;
    
    case 'L': {
      const sorted = [d1, d2, d3].sort((a, b) => a - b);
      isWin = (sorted[1] === sorted[0] + 1) && (sorted[2] === sorted[1] + 1);
      odds = O.L;
      break;
    }
    case 'P': isWin = (d1 === d2 || d2 === d3 || d1 === d3) && !isTriple; odds = O.P; break;
    case 'TB': {
      const allDiff = d1 !== d2 && d2 !== d3 && d1 !== d3;
      const sorted = [d1, d2, d3].sort((a, b) => a - b);
      const straight = (sorted[1] === sorted[0] + 1) && (sorted[2] === sorted[1] + 1);
      isWin = allDiff && !straight; odds = O.TB;
      break;
    }
    case 'DS': {
      const count = [d1, d2, d3].filter(d => d === diceSpecific).length;
      if (count === 0) { isWin = false; odds = 0; }
      else if (count === 1) { isWin = true; odds = O.DS1; }
      else if (count === 2) { isWin = true; odds = O.DS2; }
      else { isWin = true; odds = O.DS3; }
      break;
    }
    case 'TS': isWin = isTriple && d1 === diceSpecific; odds = O.TS; break;
    case 'N': isWin = d1 > d3; odds = O.N_H; break;
    case 'H': isWin = d3 > d1; odds = O.N_H; break;
    case 'S': isWin = d1 === d3; odds = O.S; break;
    default: return { isWin: false, odds: 0, payout: 0, profit: -betAmount };
  }

  const payout = isWin ? Number((betAmount * odds).toFixed(2)) : 0;
  const profit = isWin ? Number((payout - betAmount).toFixed(2)) : -betAmount;

  return { isWin, odds, payout, profit };
}

function getJumlahOdds(j, O) {
  if (j === 4 || j === 17) return O.J4_17;
  if (j === 5 || j === 16) return O.J5_16;
  if (j === 6 || j === 15) return O.J6_15;
  if (j === 7 || j === 14) return O.J7_14;
  if (j === 8 || j === 13) return O.J8_13;
  if (j === 9 || j === 12) return O.J9_12;
  if (j === 10 || j === 11) return O.J10_11;
  return 0;
}

function getMaxBet(betType, jumlah) {
  const config = settingsService.getSettings();
  if (!config) return 25000; // grace fallback
  const B = config.bounds;

  if (betType === 'B' || betType === 'K' || betType === 'GA' || betType === 'GE') return B.maxStandard;
  if (['BGA', 'BGE', 'KGA', 'KGE'].includes(betType)) return B.maxKombinasi;
  if (betType === 'J') {
    if (jumlah === 4 || jumlah === 17) return B.maxJ4_17;
    if (jumlah === 5 || jumlah === 16) return B.maxJ5_16;
    if (jumlah === 6 || jumlah === 15) return B.maxJ6_15;
    return 5000; // default for 7-14 if needed (should be mapped)
  }
  if (betType === 'T') return B.maxT;
  if (betType === 'L') return B.maxL;
  if (betType === 'P') return B.maxP;
  if (betType === 'TB') return B.maxTB;
  if (betType === 'DS') return B.maxDS;
  if (betType === 'TS') return B.maxTS;
  if (['N', 'H', 'S'].includes(betType)) return B.maxTie;
  
  return 0;
}

function getMatchingCategories(dice) {
  const [d1, d2, d3] = dice;
  const total = d1 + d2 + d3;
  const isTriple = d1 === d2 && d2 === d3;
  const categories = [];

  if (isTriple) {
    categories.push('Triple');
    return categories; // triple override
  }

  if (total >= 11) categories.push('Besar');
  else categories.push('Kecil');

  if (total % 2 !== 0) categories.push('Ganjil');
  else categories.push('Genap');

  if ([11, 13, 15, 17].includes(total)) categories.push('BGA');
  if ([12, 14, 16, 18].includes(total)) categories.push('BGE');
  if ([3, 5, 7, 9].includes(total)) categories.push('KGA');
  if ([4, 6, 8, 10].includes(total)) categories.push('KGE');

  const sorted = [...dice].sort((a, b) => a - b);
  if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) categories.push('Lurus');
  
  if ((d1 === d2 || d2 === d3 || d1 === d3)) categories.push('Pasangan');

  const allDiff = d1 !== d2 && d2 !== d3 && d1 !== d3;
  const straight = sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1;
  if (allDiff && !straight) categories.push('Tiga Berbeda');

  if (d1 > d3) categories.push('Naga');
  else if (d3 > d1) categories.push('Harimau');
  else categories.push('Seri');

  return categories;
}

module.exports = { calculateBet, getMaxBet, getMatchingCategories };

