import xlsx from 'xlsx';

/**
 * Maps trading symbol to asset class
 */
export function detectAssetClass(symbol = '') {
  const sym = symbol.toUpperCase();
  if (/^(BTC|ETH|SOL|XRP|DOGE|AVAX|ADA|DOT|LINK|LTC|BNB)/.test(sym) || sym.endsWith('USDT')) {
    return 'Crypto';
  }
  if (/^(SPX|NAS|US30|NQ|ES|DOW|DAX|GER30|XAU|USO|OIL|GOLD|SILVER)/.test(sym)) {
    return 'Futures';
  }
  if (sym.length === 6 && /(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)/.test(sym)) {
    return 'Forex';
  }
  return 'Forex';
}

/**
 * Format MT5 date string "2026.06.30 10:08:33" -> "2026-06-30T10:08:33"
 */
function parseMT5Date(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const match = str.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, y, m, d, hh, mm, ss = '00'] = match;
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  }
  return null;
}

/**
 * Clean numeric string from MT5
 */
function parseMT5Number(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  const cleaned = String(val)
    .replace(/&nbsp;/gi, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Extract Account metadata from raw header strings
 */
function extractAccountInfo(rawAccountStr = '', rawNameStr = '') {
  const accClean = (rawAccountStr || '').replace(/&nbsp;/gi, ' ').trim();
  const nameClean = (rawNameStr || '').replace(/&nbsp;/gi, ' ').trim();

  const accNumMatch = accClean.match(/\b(\d{5,10})\b/);
  const accountNumber = accNumMatch ? accNumMatch[1] : '';

  let companyName = '';
  if (nameClean) {
    const parts = nameClean.split('-');
    companyName = parts[0].trim();
  }

  if (!companyName && accClean) {
    const match = accClean.match(/([A-Za-z0-9]+)-Server/i);
    if (match) companyName = match[1];
  }

  let accountName = 'MT5 Account';
  if (accountNumber && companyName) {
    accountName = `${accountNumber} (${companyName})`;
  } else if (accountNumber) {
    accountName = `MT5 Account #${accountNumber}`;
  } else if (companyName) {
    accountName = `MT5 (${companyName})`;
  }

  return {
    accountNumber: accountNumber || '114564',
    accountName: accountName || '114564 (Hola Prime)',
    rawAccount: accClean,
    rawName: nameClean,
  };
}

/**
 * Parses MT5 HTML Report
 */
function parseMT5Html(buffer) {
  let content = '';
  const isUtf16Le = (buffer[0] === 0xff && buffer[1] === 0xfe) ||
                    (buffer[0] === 0xfe && buffer[1] === 0xff) ||
                    (buffer.slice(0, 100).includes(0x00));
  if (isUtf16Le) {
    content = buffer.toString('utf16le');
  } else {
    content = buffer.toString('utf8');
  }

  content = content.replace(/^\uFEFF/, '');

  // Extract account header info
  const accMatch = content.match(/Account:[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/i);
  const nameMatch = content.match(/Name:[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/i);
  const accountInfo = extractAccountInfo(
    accMatch ? accMatch[1] : '',
    nameMatch ? nameMatch[1] : ''
  );

  const trMatches = content.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const parsedTrades = [];

  let isPositionsSection = false;

  for (let i = 0; i < trMatches.length; i++) {
    const trHtml = trMatches[i];
    const tdMatches = trHtml.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
    const cellTexts = tdMatches.map((cell) => {
      return cell
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .trim();
    });

    const fullRowText = cellTexts.join(' ').trim();

    if (fullRowText === 'Positions') {
      isPositionsSection = true;
      continue;
    }

    if (isPositionsSection && (fullRowText === 'Orders' || fullRowText === 'Deals' || fullRowText === 'Summary')) {
      isPositionsSection = false;
      break;
    }

    if (!isPositionsSection) continue;

    if (cellTexts.includes('Position') && cellTexts.includes('Symbol') && cellTexts.includes('Type')) {
      continue;
    }

    if (cellTexts.length >= 13) {
      let openTimeStr, ticketStr, symbolStr, typeStr;
      let volumeStr, openPriceStr, slStr, tpStr, closeTimeStr, closePriceStr, commissionStr, swapStr, profitStr;

      if (cellTexts.length >= 14) {
        [
          openTimeStr,
          ticketStr,
          symbolStr,
          typeStr,
          ,
          volumeStr,
          openPriceStr,
          slStr,
          tpStr,
          closeTimeStr,
          closePriceStr,
          commissionStr,
          swapStr,
          profitStr,
        ] = cellTexts;
      } else {
        [
          openTimeStr,
          ticketStr,
          symbolStr,
          typeStr,
          volumeStr,
          openPriceStr,
          slStr,
          tpStr,
          closeTimeStr,
          closePriceStr,
          commissionStr,
          swapStr,
          profitStr,
        ] = cellTexts;
      }

      const entry_date = parseMT5Date(openTimeStr);
      const exit_date = parseMT5Date(closeTimeStr);
      const symbol = (symbolStr || '').trim().toUpperCase();
      const rawType = (typeStr || '').trim().toLowerCase();
      const side = rawType === 'buy' ? 'LONG' : rawType === 'sell' ? 'SHORT' : null;

      if (!entry_date || !symbol || !side) continue;

      const entry_price = parseMT5Number(openPriceStr);
      const exit_price = parseMT5Number(closePriceStr);
      const quantity = parseMT5Number(volumeStr) || 1;
      const stop_loss = parseMT5Number(slStr);
      const take_profit = parseMT5Number(tpStr);
      const commission = parseMT5Number(commissionStr) || 0;
      const swap = parseMT5Number(swapStr) || 0;
      const grossProfit = parseMT5Number(profitStr) || 0;

      const pnl = Math.round((grossProfit + commission + swap) * 100) / 100;

      let pnl_percent = 0;
      if (entry_price && exit_price) {
        if (side === 'LONG') {
          pnl_percent = ((exit_price - entry_price) / entry_price) * 100;
        } else {
          pnl_percent = ((entry_price - exit_price) / entry_price) * 100;
        }
        pnl_percent = Math.round(pnl_percent * 100) / 100;
      }

      let status = 'BREAKEVEN';
      if (Math.abs(pnl) < 0.01) status = 'BREAKEVEN';
      else if (pnl > 0) status = 'WIN';
      else status = 'LOSS';

      const asset_class = detectAssetClass(symbol);
      const ticket = (ticketStr || '').trim();

      parsedTrades.push({
        ticket,
        symbol,
        side,
        asset_class,
        entry_date,
        exit_date,
        entry_price,
        exit_price,
        quantity,
        stop_loss,
        take_profit,
        pnl,
        pnl_percent,
        status,
        setup: 'MT5 Import',
        timeframe: 'Execution',
        notes: ticket ? `MT5 Position #${ticket}` : 'Imported from MT5 Report',
        rating: status === 'WIN' ? 5 : status === 'LOSS' ? 2 : 3,
      });
    }
  }

  return { accountInfo, trades: parsedTrades };
}

/**
 * Parses MT5 XLSX Report
 */
function parseMT5Xlsx(buffer) {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let rawNameStr = '';
  let rawAccountStr = '';

  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i];
    if (Array.isArray(row)) {
      if (row[0] === 'Name:') rawNameStr = String(row[row.length - 1] || '');
      if (row[0] === 'Account:') rawAccountStr = String(row[row.length - 1] || '');
    }
  }

  const accountInfo = extractAccountInfo(rawAccountStr, rawNameStr);

  const parsedTrades = [];
  let isPositionsSection = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;

    const firstCell = String(row[0] || '').trim();

    if (firstCell === 'Positions') {
      isPositionsSection = true;
      continue;
    }

    if (isPositionsSection && (firstCell === 'Orders' || firstCell === 'Deals' || firstCell === 'Summary')) {
      isPositionsSection = false;
      break;
    }

    if (!isPositionsSection) continue;

    if (row.includes('Position') && row.includes('Symbol') && row.includes('Type')) {
      continue;
    }

    if (row.length >= 13) {
      const [
        openTimeRaw,
        ticketRaw,
        symbolRaw,
        typeRaw,
        volumeRaw,
        openPriceRaw,
        slRaw,
        tpRaw,
        closeTimeRaw,
        closePriceRaw,
        commissionRaw,
        swapRaw,
        profitRaw,
      ] = row;

      const entry_date = parseMT5Date(openTimeRaw);
      const exit_date = parseMT5Date(closeTimeRaw);
      const symbol = String(symbolRaw || '').trim().toUpperCase();
      const rawType = String(typeRaw || '').trim().toLowerCase();
      const side = rawType === 'buy' ? 'LONG' : rawType === 'sell' ? 'SHORT' : null;

      if (!entry_date || !symbol || !side) continue;

      const entry_price = parseMT5Number(openPriceRaw);
      const exit_price = parseMT5Number(closePriceRaw);
      const quantity = parseMT5Number(volumeRaw) || 1;
      const stop_loss = parseMT5Number(slRaw);
      const take_profit = parseMT5Number(tpRaw);
      const commission = parseMT5Number(commissionRaw) || 0;
      const swap = parseMT5Number(swapRaw) || 0;
      const grossProfit = parseMT5Number(profitRaw) || 0;

      const pnl = Math.round((grossProfit + commission + swap) * 100) / 100;

      let pnl_percent = 0;
      if (entry_price && exit_price) {
        if (side === 'LONG') {
          pnl_percent = ((exit_price - entry_price) / entry_price) * 100;
        } else {
          pnl_percent = ((entry_price - exit_price) / entry_price) * 100;
        }
        pnl_percent = Math.round(pnl_percent * 100) / 100;
      }

      let status = 'BREAKEVEN';
      if (Math.abs(pnl) < 0.01) status = 'BREAKEVEN';
      else if (pnl > 0) status = 'WIN';
      else status = 'LOSS';

      const asset_class = detectAssetClass(symbol);
      const ticket = String(ticketRaw || '').trim();

      parsedTrades.push({
        ticket,
        symbol,
        side,
        asset_class,
        entry_date,
        exit_date,
        entry_price,
        exit_price,
        quantity,
        stop_loss,
        take_profit,
        pnl,
        pnl_percent,
        status,
        setup: 'MT5 Import',
        timeframe: 'Execution',
        notes: ticket ? `MT5 Position #${ticket}` : 'Imported from MT5 Report',
        rating: status === 'WIN' ? 5 : status === 'LOSS' ? 2 : 3,
      });
    }
  }

  return { accountInfo, trades: parsedTrades };
}

/**
 * Main parser entry point
 */
export function parseMT5FileBuffer(buffer, originalFilename = '') {
  const ext = originalFilename.toLowerCase();
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    return parseMT5Xlsx(buffer);
  }
  return parseMT5Html(buffer);
}
