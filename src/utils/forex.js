/**
 * Helper: Shared Forex asset category detection and PnL calculation
 */

export function isForexCategory(symbol = '', assetClass = '') {
  const symUpper = String(symbol || '').toUpperCase().replace('/', '').trim();
  const clsLower = String(assetClass || '').toLowerCase();
  return clsLower === 'forex' ||
    /^(EUR|GBP|USD|JPY|AUD|CAD|CHF|NZD){2}$/.test(symUpper) ||
    symUpper.startsWith('XAU') || symUpper.startsWith('XAG') ||
    symUpper === 'GOLD' || symUpper === 'SILVER';
}

export function calculateForexPnL(symbol = '', assetClass = '', side = 'LONG', entryPrice = 0, exitPrice = 0, quantity = 1) {
  const entry = parseFloat(entryPrice);
  const exit = parseFloat(exitPrice);
  const qty = parseFloat(quantity) || 1;

  if (isNaN(entry) || isNaN(exit) || entry <= 0) {
    return { pnl: 0, pnlPercent: 0 };
  }

  const isLong = (side === 'LONG' || side === 'BUY');
  const priceDiff = isLong ? (exit - entry) : (entry - exit);
  const pnlPercent = (priceDiff / entry) * 100;

  const symUpper = String(symbol || '').toUpperCase().replace('/', '').trim();

  if (!isForexCategory(symbol, assetClass)) {
    const pnl = priceDiff * qty;
    return { pnl, pnlPercent };
  }

  let lots = qty;
  if (qty >= 500) {
    lots = qty / 100000;
  }

  let contractSize = 100000;
  if (symUpper.includes('XAU') || symUpper === 'GOLD') {
    contractSize = 100;
  } else if (symUpper.includes('XAG') || symUpper === 'SILVER') {
    contractSize = 5000;
  }

  let pnl = 0;
  if (symUpper.endsWith('USD') || symUpper === 'GOLD' || symUpper === 'SILVER') {
    pnl = priceDiff * lots * contractSize;
  } else if (symUpper.startsWith('USD')) {
    pnl = (priceDiff * lots * contractSize) / exit;
  } else if (symUpper.endsWith('JPY')) {
    const usdJpyEst = exit > 50 ? (exit / 1.30) : 150;
    pnl = (priceDiff * lots * contractSize) / usdJpyEst;
  } else if (symUpper.endsWith('GBP')) {
    pnl = priceDiff * lots * contractSize * 1.28;
  } else if (symUpper.endsWith('AUD')) {
    pnl = priceDiff * lots * contractSize * 0.66;
  } else if (symUpper.endsWith('CAD')) {
    pnl = (priceDiff * lots * contractSize) / 1.36;
  } else if (symUpper.endsWith('CHF')) {
    pnl = (priceDiff * lots * contractSize) / 0.90;
  } else if (symUpper.endsWith('NZD')) {
    pnl = priceDiff * lots * contractSize * 0.60;
  } else {
    pnl = priceDiff * lots * contractSize;
  }

  return { pnl, pnlPercent };
}
