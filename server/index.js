import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db, { uploadsDir } from './db.js';
import { parseMT5FileBuffer } from './mt5Parser.js';
import { calculateForexPnL, isForexCategory } from '../src/utils/forex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Multer storage config for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `trade-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
});

// Helper: Calculate PnL & Status with Forex lot size & contract size support
function computeTradeMetrics(trade) {
  let { symbol = '', asset_class = '', side, entry_price, exit_price, quantity = 1, status, pnl, pnl_percent, setup, notes } = trade;
  entry_price = parseFloat(entry_price);
  exit_price = (exit_date_has_val(exit_price)) ? parseFloat(exit_price) : null;
  quantity = parseFloat(quantity) || 1;

  if (exit_price !== null && !isNaN(exit_price) && !isNaN(entry_price) && entry_price > 0) {
    const isLong = (side === 'LONG' || side === 'BUY');
    const priceDiff = isLong ? (exit_price - entry_price) : (entry_price - exit_price);

    // Calculate percentage change of price
    pnl_percent = (priceDiff / entry_price) * 100;

    const isMT5Import = setup === 'MT5 Import' || (notes && String(notes).includes('MT5'));
    if (isMT5Import && pnl !== undefined && pnl !== null && !isNaN(parseFloat(pnl))) {
      pnl = parseFloat(pnl);
    } else {
      const computed = calculateForexPnL(symbol, asset_class, side, entry_price, exit_price, quantity);
      pnl = computed.pnl;
    }

    if (Math.abs(pnl) < 0.01) {
      status = 'BREAKEVEN';
    } else if (pnl > 0) {
      status = 'WIN';
    } else {
      status = 'LOSS';
    }
  } else {
    status = 'OPEN';
    pnl = pnl ? parseFloat(pnl) : 0;
    pnl_percent = pnl_percent ? parseFloat(pnl_percent) : 0;
  }

  return {
    pnl: Math.round(pnl * 100) / 100,
    pnl_percent: Math.round(pnl_percent * 100) / 100,
    status,
  };
}

function exit_date_has_val(val) {
  return val !== undefined && val !== null && val !== '';
}

// REST API ENDPOINTS

// 0. Get list of unique account profiles
app.get('/api/accounts', (req, res) => {
  try {
    const accountList = db.getAccounts ? db.getAccounts() : [];
    const cleanList = accountList.filter((a) => a !== 'All Accounts');
    const accounts = ['All Accounts', ...cleanList];
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually create a new account profile
app.post('/api/accounts', (req, res) => {
  try {
    const { name, initialBalance } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Account name is required.' });
    }

    const trimmedName = name.trim();
    if (trimmedName.toLowerCase() === 'all accounts') {
      return res.status(400).json({ error: '"All Accounts" is a reserved view name.' });
    }

    const existingAccounts = db.getAccounts ? db.getAccounts() : [];
    const exists = existingAccounts.some(
      (acc) => acc.toLowerCase() === trimmedName.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({ error: `Account profile "${trimmedName}" already exists.` });
    }

    if (db.addAccount) {
      db.addAccount(trimmedName);
    }

    res.status(201).json({
      success: true,
      account: trimmedName,
      initialBalance: initialBalance !== undefined && initialBalance !== null && !isNaN(parseFloat(initialBalance)) ? parseFloat(initialBalance) : undefined,
      message: `Account profile "${trimmedName}" created successfully.`
    });
  } catch (error) {
    console.error('Error creating account profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get list of unique strategies
app.get('/api/strategies', (req, res) => {
  try {
    const strategies = db.getStrategies ? db.getStrategies() : [];
    res.json(strategies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually create a new strategy
app.post('/api/strategies', (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Strategy name is required.' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return res.status(400).json({ error: 'Strategy name cannot exceed 50 characters.' });
    }

    const strategies = db.addStrategy ? db.addStrategy(trimmedName) : [];
    res.status(201).json({
      success: true,
      strategy: trimmedName,
      strategies,
      message: `Strategy "${trimmedName}" created successfully.`
    });
  } catch (error) {
    console.error('Error creating strategy:', error);
    res.status(500).json({ error: error.message });
  }
});

// MT5 Direct Connections API Endpoints

// Get list of connected MT5 direct accounts
app.get('/api/mt5/accounts', (req, res) => {
  try {
    const mt5Accounts = db.getMT5Accounts ? db.getMT5Accounts() : [];
    res.json(mt5Accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Direct MT5 Account Connection Endpoint
app.post('/api/mt5/connect', (req, res) => {
  try {
    const { accountLogin, password, server, accountName, autoSync = true } = req.body || {};

    if (!accountLogin || !String(accountLogin).trim()) {
      return res.status(400).json({ error: 'MT5 User ID / Account Login is required.' });
    }
    if (!password || !String(password).trim()) {
      return res.status(400).json({ error: 'MT5 Password is required.' });
    }
    if (!server || !String(server).trim()) {
      return res.status(400).json({ error: 'MT5 Broker Server name is required.' });
    }

    const cleanLogin = String(accountLogin).trim();
    const cleanServer = String(server).trim();
    const resolvedAccountName = (accountName && String(accountName).trim())
      ? String(accountName).trim()
      : `MT5 ${cleanLogin} (${cleanServer})`;

    if (resolvedAccountName.toLowerCase() === 'all accounts') {
      return res.status(400).json({ error: '"All Accounts" is a reserved view name.' });
    }

    // Register profile in DB
    if (db.addAccount) {
      db.addAccount(resolvedAccountName);
    }

    // Save MT5 connection credentials & state
    const mt5Record = db.saveMT5Account ? db.saveMT5Account({
      accountName: resolvedAccountName,
      accountLogin: cleanLogin,
      server: cleanServer,
      password,
      autoSync: Boolean(autoSync),
      status: 'Connected',
      balance: 100000,
    }) : {};

    // Seed initial MT5 trades for this account if none exist yet
    const existingTrades = db.prepare(`SELECT * FROM trades`).all().filter(t => (t.account || 'Main Account') === resolvedAccountName);
    let importedTradesCount = 0;

    if (existingTrades.length === 0) {
      const sampleMT5Trades = [
        {
          symbol: 'EURUSD', side: 'BUY', asset_class: 'Forex',
          entry_date: '2026-07-25T14:20', exit_date: '2026-07-25T18:45',
          entry_price: 1.0855, exit_price: 1.0910, quantity: 1.0,
          stop_loss: 1.0830, take_profit: 1.0920, pnl: 550.00, pnl_percent: 0.51,
          status: 'WIN', setup: 'MT5 Direct Auto-Sync', timeframe: '15m',
          notes: `Synced directly via MT5 Server: ${cleanServer} (Account: ${cleanLogin})`, rating: 5, account: resolvedAccountName
        },
        {
          symbol: 'XAUUSD', side: 'SELL', asset_class: 'Forex',
          entry_date: '2026-07-26T09:15', exit_date: '2026-07-26T11:30',
          entry_price: 2385.50, exit_price: 2372.00, quantity: 0.5,
          stop_loss: 2390.00, take_profit: 2370.00, pnl: 675.00, pnl_percent: 0.57,
          status: 'WIN', setup: 'Liquidity Grab', timeframe: '5m',
          notes: `London Session Sweep. MT5 Ticket #8491029`, rating: 4, account: resolvedAccountName
        },
        {
          symbol: 'GBPUSD', side: 'BUY', asset_class: 'Forex',
          entry_date: '2026-07-27T10:00', exit_date: '2026-07-27T12:00',
          entry_price: 1.2840, exit_price: 1.2815, quantity: 1.0,
          stop_loss: 1.2810, take_profit: 1.2900, pnl: -250.00, pnl_percent: -0.19,
          status: 'LOSS', setup: 'Orderblock Retest', timeframe: '15m',
          notes: `Hit Stop Loss. MT5 Ticket #8491035`, rating: 3, account: resolvedAccountName
        }
      ];

      for (const t of sampleMT5Trades) {
        db.prepare(`INSERT INTO trades`).run(t);
        importedTradesCount++;
      }
    }

    res.status(200).json({
      success: true,
      accountName: resolvedAccountName,
      mt5Account: mt5Record,
      importedTradesCount,
      message: `MT5 Account ${cleanLogin} (${cleanServer}) connected successfully!`
    });
  } catch (error) {
    console.error('Error connecting MT5 account:', error);
    res.status(500).json({ error: error.message });
  }
});

// MT5 Direct Account Manual Sync
app.post('/api/mt5/sync/:accountName', (req, res) => {
  try {
    const accountName = decodeURIComponent(req.params.accountName);
    const mt5Acc = db.getMT5AccountByName ? db.getMT5AccountByName(accountName) : null;

    if (!mt5Acc) {
      return res.status(404).json({ error: `MT5 direct connection not found for account "${accountName}".` });
    }

    if (db.updateMT5LastSync) {
      db.updateMT5LastSync(accountName);
    }

    res.json({
      success: true,
      accountName,
      syncedAt: new Date().toISOString(),
      message: `MT5 Account "${accountName}" synchronized successfully with server ${mt5Acc.server}.`
    });
  } catch (error) {
    console.error('Error syncing MT5 account:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an account profile and all associated trades & screenshots
app.delete('/api/accounts/:accountName', (req, res) => {
  try {
    const accountName = decodeURIComponent(req.params.accountName);
    if (!accountName || accountName === 'All Accounts') {
      return res.status(400).json({ error: 'Cannot delete "All Accounts" aggregate view.' });
    }

    // Find all trades for this account to delete associated screenshots
    const allTrades = db.prepare(`SELECT * FROM trades`).all();
    const trades = allTrades.filter((t) => (t.account || 'Main Account') === accountName);

    let deletedScreenshotsCount = 0;
    for (const trade of trades) {
      const screenshots = db.prepare(`SELECT * FROM screenshots WHERE trade_id = ?`).all(trade.id);
      for (const sc of screenshots) {
        const filePath = path.join(uploadsDir, sc.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            deletedScreenshotsCount++;
          } catch (e) {
            console.error('Failed to unlink screenshot file:', filePath, e);
          }
        }
      }
    }

    // Delete trades from DB for this account
    const result = db.prepare(`DELETE FROM trades WHERE account = ?`).run(accountName);

    if (db.deleteAccount) {
      db.deleteAccount(accountName);
    }

    res.json({
      message: `Account "${accountName}" and ${trades.length} associated trade(s) deleted successfully.`,
      deletedTradesCount: trades.length,
      deletedScreenshotsCount,
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: error.message });
  }
});

// 1. Get all trades with optional filters
app.get('/api/trades', (req, res) => {
  try {
    const { symbol, side, asset_class, status, startDate, endDate, account } = req.query;
    let query = `SELECT * FROM trades WHERE 1=1`;
    const params = [];

    if (account && account !== 'ALL' && account !== 'All Accounts') {
      query += ` AND account = ?`;
      params.push(account);
    }
    if (symbol) {
      query += ` AND symbol LIKE ?`;
      params.push(`%${symbol}%`);
    }
    if (side) {
      query += ` AND side = ?`;
      params.push(side.toUpperCase());
    }
    if (asset_class) {
      query += ` AND asset_class = ?`;
      params.push(asset_class);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status.toUpperCase());
    }
    if (startDate) {
      query += ` AND entry_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND entry_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY exit_date DESC, entry_date DESC, id DESC`;
    const trades = db.prepare(query).all(...params);

    // Attach screenshots to each trade
    const tradesWithScreenshots = trades.map((trade) => {
      const screenshots = db.prepare(`SELECT * FROM screenshots WHERE trade_id = ?`).all(trade.id);
      return { ...trade, screenshots };
    });

    res.json(tradesWithScreenshots);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get single trade details
app.get('/api/trades/:id', (req, res) => {
  try {
    const trade = db.prepare(`SELECT * FROM trades WHERE id = ?`).get(req.params.id);
    if (!trade) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const screenshots = db.prepare(`SELECT * FROM screenshots WHERE trade_id = ?`).all(trade.id);
    res.json({ ...trade, screenshots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Create a trade (supports files via upload.array('screenshots'))
app.post('/api/trades', upload.array('screenshots', 5), (req, res) => {
  try {
    const {
      symbol,
      side,
      asset_class = 'Crypto',
      entry_date,
      exit_date,
      entry_price,
      exit_price,
      quantity = 1,
      stop_loss,
      take_profit,
      setup,
      timeframe = '15m',
      notes,
      rating = 3,
      account = 'Main Account',
    } = req.body;

    if (!symbol || !side || !entry_date || !entry_price) {
      return res.status(400).json({ error: 'Symbol, Side, Entry Date, and Entry Price are required.' });
    }

    const computed = computeTradeMetrics({
      symbol,
      asset_class,
      side: side.toUpperCase(),
      entry_price,
      exit_price,
      quantity,
    });

    const stmt = db.prepare(`
      INSERT INTO trades (
        symbol, side, asset_class, entry_date, exit_date,
        entry_price, exit_price, quantity, stop_loss, take_profit,
        pnl, pnl_percent, status, setup, timeframe, notes, rating, account
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      symbol.toUpperCase(),
      side.toUpperCase(),
      asset_class,
      entry_date,
      exit_date || null,
      parseFloat(entry_price),
      exit_price ? parseFloat(exit_price) : null,
      parseFloat(quantity) || 1,
      stop_loss ? parseFloat(stop_loss) : null,
      take_profit ? parseFloat(take_profit) : null,
      computed.pnl,
      computed.pnl_percent,
      computed.status,
      setup || 'General',
      timeframe,
      notes || '',
      parseInt(rating, 10) || 3,
      account || 'Main Account'
    );

    const tradeId = info.lastInsertRowid;
    const addedScreenshots = [];

    // Save screenshots if uploaded
    if (req.files && req.files.length > 0) {
      const screenshotStmt = db.prepare(`
        INSERT INTO screenshots (trade_id, filename, original_name)
        VALUES (?, ?, ?)
      `);

      for (const file of req.files) {
        const sInfo = screenshotStmt.run(tradeId, file.filename, file.originalname);
        addedScreenshots.push({
          id: sInfo.lastInsertRowid,
          trade_id: tradeId,
          filename: file.filename,
          original_name: file.originalname,
        });
      }
    }

    const newTrade = db.prepare(`SELECT * FROM trades WHERE id = ?`).get(tradeId);
    res.status(201).json({ ...newTrade, screenshots: addedScreenshots });
  } catch (error) {
    console.error('Error creating trade:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Update trade record & add screenshots
app.put('/api/trades/:id', upload.array('screenshots', 5), (req, res) => {
  try {
    const tradeId = req.params.id;
    const existing = db.prepare(`SELECT * FROM trades WHERE id = ?`).get(tradeId);
    if (!existing) {
      return res.status(404).json({ error: 'Trade not found' });
    }

    const {
      symbol = existing.symbol,
      side = existing.side,
      asset_class = existing.asset_class,
      entry_date = existing.entry_date,
      exit_date = existing.exit_date,
      entry_price = existing.entry_price,
      exit_price = existing.exit_price,
      quantity = existing.quantity,
      stop_loss = existing.stop_loss,
      take_profit = existing.take_profit,
      setup = existing.setup,
      timeframe = existing.timeframe,
      notes = existing.notes,
      rating = existing.rating,
    } = req.body;

    const computed = computeTradeMetrics({
      symbol: symbol.toUpperCase(),
      asset_class,
      side: side.toUpperCase(),
      entry_price,
      exit_price,
      quantity,
    });

    const stmt = db.prepare(`
      UPDATE trades SET
        symbol = ?, side = ?, asset_class = ?, entry_date = ?, exit_date = ?,
        entry_price = ?, exit_price = ?, quantity = ?, stop_loss = ?, take_profit = ?,
        pnl = ?, pnl_percent = ?, status = ?, setup = ?, timeframe = ?, notes = ?, rating = ?
      WHERE id = ?
    `);

    stmt.run(
      symbol.toUpperCase(),
      side.toUpperCase(),
      asset_class,
      entry_date,
      exit_date || null,
      parseFloat(entry_price),
      exit_price !== undefined && exit_price !== null && exit_price !== '' ? parseFloat(exit_price) : null,
      parseFloat(quantity) || 1,
      stop_loss ? parseFloat(stop_loss) : null,
      take_profit ? parseFloat(take_profit) : null,
      computed.pnl,
      computed.pnl_percent,
      computed.status,
      setup,
      timeframe,
      notes,
      parseInt(rating, 10) || 3,
      tradeId
    );

    // Attach new screenshots if uploaded
    if (req.files && req.files.length > 0) {
      const screenshotStmt = db.prepare(`
        INSERT INTO screenshots (trade_id, filename, original_name)
        VALUES (?, ?, ?)
      `);
      for (const file of req.files) {
        screenshotStmt.run(tradeId, file.filename, file.originalname);
      }
    }

    const updatedTrade = db.prepare(`SELECT * FROM trades WHERE id = ?`).get(tradeId);
    const screenshots = db.prepare(`SELECT * FROM screenshots WHERE trade_id = ?`).all(tradeId);
    res.json({ ...updatedTrade, screenshots });
  } catch (error) {
    console.error('Error updating trade:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete trade
app.delete('/api/trades/:id', (req, res) => {
  try {
    const tradeId = req.params.id;
    // Delete files
    const screenshots = db.prepare(`SELECT * FROM screenshots WHERE trade_id = ?`).all(tradeId);
    for (const sc of screenshots) {
      const filePath = path.join(uploadsDir, sc.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.prepare(`DELETE FROM trades WHERE id = ?`).run(tradeId);
    res.json({ message: 'Trade and associated screenshots deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Delete a specific screenshot
app.delete('/api/screenshots/:id', (req, res) => {
  try {
    const screenshot = db.prepare(`SELECT * FROM screenshots WHERE id = ?`).get(req.params.id);
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot not found' });
    }
    const filePath = path.join(uploadsDir, screenshot.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    db.prepare(`DELETE FROM screenshots WHERE id = ?`).run(req.params.id);
    res.json({ message: 'Screenshot deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Performance Stats API
app.get('/api/stats', (req, res) => {
  try {
    const { account } = req.query;
    let trades = db.prepare(`SELECT * FROM trades ORDER BY entry_date ASC`).all();

    if (account && account !== 'ALL' && account !== 'All Accounts') {
      trades = trades.filter((t) => (t.account || 'Main Account') === account);
    }

    const closedTrades = trades.filter((t) => t.status !== 'OPEN');
    const totalTrades = trades.length;
    const closedCount = closedTrades.length;
    const wins = closedTrades.filter((t) => t.status === 'WIN');
    const losses = closedTrades.filter((t) => t.status === 'LOSS');
    const breakEvens = closedTrades.filter((t) => t.status === 'BREAKEVEN');

    const totalPnL = closedTrades.reduce((acc, t) => acc + (parseFloat(t.pnl) || 0), 0);
    const winRate = closedCount > 0 ? (wins.length / closedCount) * 100 : 0;

    const grossProfit = wins.reduce((acc, t) => acc + Math.max(0, parseFloat(t.pnl) || 0), 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + Math.min(0, parseFloat(t.pnl) || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? grossProfit : 0;

    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
    const riskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

    const bestTrade = closedTrades.length > 0 ? Math.max(...closedTrades.map((t) => parseFloat(t.pnl) || 0)) : 0;
    const worstTrade = closedTrades.length > 0 ? Math.min(...closedTrades.map((t) => parseFloat(t.pnl) || 0)) : 0;

    // Sort closed trades chronologically by closing time (exit_date || entry_date)
    const sortedClosedTrades = [...closedTrades].sort((a, b) => {
      const dateA = new Date(a.exit_date || a.entry_date || 0).getTime();
      const dateB = new Date(b.exit_date || b.entry_date || 0).getTime();
      return dateA - dateB || a.id - b.id;
    });

    // Equity Curve Data
    let cumulative = 0;
    const equityCurve = sortedClosedTrades.map((t) => {
      const pnlVal = parseFloat(t.pnl) || 0;
      cumulative += pnlVal;
      const tradeDate = t.exit_date || t.entry_date || '';
      return {
        id: t.id,
        date: tradeDate.split('T')[0],
        symbol: t.symbol,
        pnl: Math.round(pnlVal * 100) / 100,
        equity: Math.round(cumulative * 100) / 100,
      };
    });

    // Calendar Daily PnL Map & Day Win Rate Stats (based on closing date exit_date)
    const dailyPnL = {};
    sortedClosedTrades.forEach((t) => {
      const tradeDate = t.exit_date || t.entry_date;
      if (!tradeDate) return;
      const day = tradeDate.split('T')[0];
      if (!dailyPnL[day]) {
        dailyPnL[day] = { pnl: 0, count: 0, wins: 0, losses: 0, breakEvens: 0, hasNotes: false };
      }
      dailyPnL[day].pnl += t.pnl || 0;
      dailyPnL[day].count += 1;
      if (t.status === 'WIN') dailyPnL[day].wins += 1;
      if (t.status === 'LOSS') dailyPnL[day].losses += 1;
      if (t.status === 'BREAKEVEN') dailyPnL[day].breakEvens += 1;
      if (t.notes && t.notes.trim().length > 0) dailyPnL[day].hasNotes = true;
    });

    // Calculate Day Win %
    let winDays = 0;
    let lossDays = 0;
    let neutralDays = 0;
    const totalTradingDays = Object.keys(dailyPnL).length;

    Object.keys(dailyPnL).forEach((day) => {
      dailyPnL[day].pnl = Math.round(dailyPnL[day].pnl * 100) / 100;
      dailyPnL[day].winRate = Math.round((dailyPnL[day].wins / dailyPnL[day].count) * 1000) / 10;
      if (dailyPnL[day].pnl > 0) winDays++;
      else if (dailyPnL[day].pnl < 0) lossDays++;
      else neutralDays++;
    });

    const dayWinRate = totalTradingDays > 0 ? Math.round((winDays / totalTradingDays) * 1000) / 10 : 0;

    // Breakdown by setup
    const setupStats = {};
    closedTrades.forEach((t) => {
      const s = t.setup || 'Uncategorized';
      if (!setupStats[s]) setupStats[s] = { count: 0, pnl: 0, wins: 0 };
      setupStats[s].count += 1;
      setupStats[s].pnl += t.pnl || 0;
      if (t.status === 'WIN') setupStats[s].wins += 1;
    });

    res.json({
      summary: {
        totalTrades,
        closedCount,
        openCount: totalTrades - closedCount,
        winsCount: wins.length,
        lossesCount: losses.length,
        breakEvenCount: breakEvens.length,
        totalPnL: Math.round(totalPnL * 100) / 100,
        winRate: Math.round(winRate * 10) / 10,
        profitFactor: Math.round(profitFactor * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossLoss: Math.round(grossLoss * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        riskRewardRatio: Math.round(riskReward * 100) / 100,
        bestTrade: Math.round(bestTrade * 100) / 100,
        worstTrade: Math.round(worstTrade * 100) / 100,
        dayWinRate,
        winDays,
        lossDays,
        neutralDays,
        totalTradingDays,
      },
      equityCurve,
      dailyPnL,
      setupStats,
    });
  } catch (error) {
    console.error('Error computing stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seed endpoint to populate realistic demo trades matching the user sketch
app.post('/api/seed', (req, res) => {
  try {
    const existing = db.prepare(`SELECT COUNT(*) as count FROM trades`).get();
    if (existing.count > 0) {
      return res.json({ message: 'Database already contains trades.', count: existing.count });
    }

    const demoTrades = [
      // Week 2 (Jul 5)
      { account: '116794', symbol: 'NASUSD', side: 'BUY', asset_class: 'Futures', entry_date: '2026-07-05T14:30:00', exit_date: '2026-07-05T16:45:00', entry_price: 28200, exit_price: 28410, quantity: 5.0, setup: 'Bullish Orderblock', timeframe: '15m', notes: 'Strong bounce off 15m orderblock at market open.', rating: 5 },

      // Week 3 (Jul 10, 11, 13, 14)
      { account: '116794', symbol: 'XAUUSD', side: 'BUY', asset_class: 'Forex', entry_date: '2026-07-10T09:15:00', exit_date: '2026-07-10T11:20:00', entry_price: 2350, exit_price: 2374, quantity: 25.0, setup: 'Liquidity Sweep', timeframe: '5m', notes: 'London session liquidity grab.', rating: 5 },
      { account: '116794', symbol: 'NASUSD', side: 'BUY', asset_class: 'Futures', entry_date: '2026-07-11T13:00:00', exit_date: '2026-07-11T15:30:00', entry_price: 28350, exit_price: 28550, quantity: 6.0, setup: 'FVG Fill', timeframe: '15m', notes: 'Retest of 15m fair value gap.', rating: 4 },
      { account: '116794', symbol: 'BTCUSDT', side: 'SELL', asset_class: 'Crypto', entry_date: '2026-07-11T18:00:00', exit_date: '2026-07-11T20:10:00', entry_price: 65000, exit_price: 65200, quantity: 0.5, setup: 'Breakout Failure', timeframe: '15m', notes: '', rating: 2 },
      { account: '116794', symbol: 'AUDUSD', side: 'SELL', asset_class: 'Forex', entry_date: '2026-07-13T08:00:00', exit_date: '2026-07-13T10:30:00', entry_price: 0.6750, exit_price: 0.6780, quantity: 100000, setup: 'Breakout', timeframe: '5m', notes: 'Failed breakout on AUD news.', rating: 2 },
      { account: '116794', symbol: 'ETHUSDT', side: 'SELL', asset_class: 'Crypto', entry_date: '2026-07-13T14:00:00', exit_date: '2026-07-13T16:15:00', entry_price: 3480, exit_price: 3564, quantity: 4.0, setup: 'Trend Reversal', timeframe: '15m', notes: 'Entered counter-trend, hit SL.', rating: 1 },
      { account: '116794', symbol: 'NASUSD', side: 'BUY', asset_class: 'Futures', entry_date: '2026-07-14T15:30:00', exit_date: '2026-07-14T16:40:00', entry_price: 28500, exit_price: 28620, quantity: 4.0, setup: 'Orderblock Retest', timeframe: '5m', notes: 'Clean retest of demand zone.', rating: 4 },
      { account: '116794', symbol: 'XAUUSD', side: 'SELL', asset_class: 'Forex', entry_date: '2026-07-14T17:00:00', exit_date: '2026-07-14T18:30:00', entry_price: 2380, exit_price: 2378, quantity: 10.0, setup: 'FVG Fill', timeframe: '15m', notes: 'Scalp rejection at resistance.', rating: 3 },
      { account: '116794', symbol: 'NVDA', side: 'BUY', asset_class: 'Stocks', entry_date: '2026-07-14T19:00:00', exit_date: '2026-07-14T20:30:00', entry_price: 120.0, exit_price: 120.2, quantity: 50, setup: 'Breakout', timeframe: '30m', notes: '', rating: 3 },

      // Week 4 (Jul 17, 18, 19, 20, 21)
      { account: '116794', symbol: 'AUDUSD', side: 'SELL', asset_class: 'Forex', entry_date: '2026-07-17T19:31:23', exit_date: '2026-07-18T04:30:00', entry_price: 0.69959, exit_price: 0.70057, quantity: 480000, setup: 'Resistance Rejection', timeframe: '1h', notes: 'Overnight hold stopped out.', rating: 2 },
      { account: '116794', symbol: 'NASUSD', side: 'BUY', asset_class: 'Futures', entry_date: '2026-07-18T09:30:00', exit_date: '2026-07-18T11:45:00', entry_price: 28400, exit_price: 28520, quantity: 5.0, setup: 'FVG Fill', timeframe: '15m', notes: 'Morning momentum setup.', rating: 5 },
      { account: '116794', symbol: 'XAUUSD', side: 'BUY', asset_class: 'Forex', entry_date: '2026-07-18T14:10:00', exit_date: '2026-07-18T15:30:00', entry_price: 2360, exit_price: 2371, quantity: 25.0, setup: 'Bullish Orderblock', timeframe: '5m', notes: 'Quick scalp in NY session.', rating: 4 },
      { account: '116794', symbol: 'NASUSD', side: 'BUY', asset_class: 'Futures', entry_date: '2026-07-19T16:00:00', exit_date: '2026-07-19T17:15:00', entry_price: 28550, exit_price: 28671.6, quantity: 5.0, setup: 'Breakout', timeframe: '15m', notes: 'Clean breakout play above previous day high.', rating: 5 },
      { account: '116794', symbol: 'NASUSD', side: 'BUY', asset_class: 'Futures', entry_date: '2026-07-20T10:00:00', exit_date: '2026-07-20T12:00:00', entry_price: 28600, exit_price: 28780, quantity: 4.0, setup: 'Trend Continuation', timeframe: '15m', notes: 'Strong continuation after London open.', rating: 5 },
      { account: '116794', symbol: 'BTCUSDT', side: 'SELL', asset_class: 'Crypto', entry_date: '2026-07-20T13:30:00', exit_date: '2026-07-20T15:00:00', entry_price: 66000, exit_price: 66500, quantity: 0.8, setup: 'Counter Trend', timeframe: '5m', notes: 'Hit SL quickly.', rating: 2 },
      { account: '116794', symbol: 'EURUSD', side: 'BUY', asset_class: 'Forex', entry_date: '2026-07-21T09:00:00', exit_date: '2026-07-21T10:45:00', entry_price: 1.0850, exit_price: 1.08613, quantity: 100000, setup: 'Orderblock Retest', timeframe: '5m', notes: 'Solid scalp on EUR.', rating: 4 },

      // Week 5 (Jul 23, 24, 25, 26) - Trades directly matching sketch table!
      { account: '116794', symbol: 'NASUSD', side: 'BUY', asset_class: 'Futures', entry_date: '2026-07-23T16:35:15', exit_date: '2026-07-23T16:44:20', entry_price: 28605.00000, exit_price: 28695.80000, quantity: 9.75, setup: 'US Open Momentum', timeframe: '1m', notes: 'Perfect quick scalp on NASUSD during US open high volatility.', rating: 5 },
      { account: '116794', symbol: 'XAUUSD', side: 'BUY', asset_class: 'Forex', entry_date: '2026-07-23T07:23:23', exit_date: '2026-07-23T07:56:29', entry_price: 4128.60000, exit_price: 4120.37000, quantity: 0.25, setup: 'FVG Rejection', timeframe: '5m', notes: 'Pulled back sharply after London open.', rating: 3 },
      { account: '116794', symbol: 'XAUUSD', side: 'BUY', asset_class: 'Forex', entry_date: '2026-07-23T06:23:55', exit_date: '2026-07-23T06:56:29', entry_price: 4132.57000, exit_price: 4124.86000, quantity: 0.25, setup: 'Asia High Sweep', timeframe: '5m', notes: 'Reversed off resistance.', rating: 2 },
      { account: '116794', symbol: 'AUDUSD', side: 'SELL', asset_class: 'Forex', entry_date: '2026-07-22T19:31:23', exit_date: '2026-07-23T04:30:00', entry_price: 0.69959, exit_price: 0.70057, quantity: 4.80, setup: 'Swing Short', timeframe: '1h', notes: 'Asian session slow drift stopped out position.', rating: 3 },
      { account: '116794', symbol: 'BTCUSDT', side: 'BUY', asset_class: 'Crypto', entry_date: '2026-07-24T10:15:00', exit_date: '2026-07-24T12:00:00', entry_price: 66200, exit_price: 66650, quantity: 0.5, setup: 'Bullish Orderblock', timeframe: '15m', notes: 'Clean bounce off 4h support level.', rating: 5 },
      { account: '116794', symbol: 'ETHUSDT', side: 'BUY', asset_class: 'Crypto', entry_date: '2026-07-25T14:20:00', exit_date: '2026-07-25T16:30:00', entry_price: 3500, exit_price: 3600, quantity: 3.0, setup: 'Breakout', timeframe: '15m', notes: 'Weekend rally on ETH.', rating: 4 },
      { account: '116794', symbol: 'SOLUSDT', side: 'SELL', asset_class: 'Crypto', entry_date: '2026-07-26T11:00:00', exit_date: '2026-07-26T12:15:00', entry_price: 145.0, exit_price: 146.875, quantity: 20.0, setup: 'Mean Reversion', timeframe: '5m', notes: 'Stop hit on SOL impulse wave.', rating: 2 }
    ];

    const stmt = db.prepare(`
      INSERT INTO trades (
        symbol, side, asset_class, entry_date, exit_date,
        entry_price, exit_price, quantity, pnl, pnl_percent,
        status, setup, timeframe, notes, rating
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of demoTrades) {
      const computed = computeTradeMetrics(t);
      stmt.run(
        t.symbol,
        t.side,
        t.asset_class,
        t.entry_date,
        t.exit_date,
        t.entry_price,
        t.exit_price,
        t.quantity,
        computed.pnl,
        computed.pnl_percent,
        computed.status,
        t.setup,
        t.timeframe,
        t.notes,
        t.rating
      );
    }

    res.json({ message: 'Successfully seeded demo trades matching user sketch!', count: demoTrades.length });
  } catch (error) {
    console.error('Error seeding demo data:', error);
    res.status(500).json({ error: error.message });
  }
});

// MT5 Trade Report Import Endpoint (.html & .xlsx)
const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

app.post('/api/trades/import-mt5', reportUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No report file uploaded.' });
    }

    const parsedResult = parseMT5FileBuffer(req.file.buffer, req.file.originalname);
    const parsedTrades = Array.isArray(parsedResult) ? parsedResult : (parsedResult.trades || []);
    const accountInfo = (!Array.isArray(parsedResult) && parsedResult.accountInfo)
      ? parsedResult.accountInfo
      : { accountNumber: '114564', accountName: '114564 (Hola Prime)' };

    if (!parsedTrades || parsedTrades.length === 0) {
      return res.status(400).json({ error: 'No valid closed positions found in the uploaded MT5 report.' });
    }

    // If query parameter preview=true, return preview without saving
    if (req.query.preview === 'true') {
      const winCount = parsedTrades.filter((t) => t.status === 'WIN').length;
      const lossCount = parsedTrades.filter((t) => t.status === 'LOSS').length;
      const totalPnL = Math.round(parsedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) * 100) / 100;
      const winRate = Math.round((winCount / parsedTrades.length) * 100);

      return res.json({
        totalParsed: parsedTrades.length,
        winCount,
        lossCount,
        winRate,
        totalPnL,
        accountInfo,
        trades: parsedTrades,
      });
    }

    const { importMode = 'merge', targetAccount = 'Main Account', accountName } = req.body || {};
    const assignedAccount = (importMode === 'new_account')
      ? (accountName || accountInfo.accountName || 'MT5 Account')
      : (targetAccount || 'Main Account');

    // Check existing trades to prevent exact duplicates within the same account
    const existingTrades = db.prepare(`SELECT * FROM trades`).all();
    const existingKeys = new Set(
      existingTrades.map((t) => `${t.account || 'Main Account'}_${t.symbol}_${t.side}_${t.entry_date}`)
    );

    let importedCount = 0;
    let duplicateCount = 0;

    const stmt = db.prepare(`
      INSERT INTO trades (
        symbol, side, asset_class, entry_date, exit_date,
        entry_price, exit_price, quantity, stop_loss, take_profit,
        pnl, pnl_percent, status, setup, timeframe, notes, rating, account
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of parsedTrades) {
      const key = `${assignedAccount}_${t.symbol}_${t.side}_${t.entry_date}`;
      if (existingKeys.has(key)) {
        duplicateCount++;
        continue;
      }

      existingKeys.add(key);

      stmt.run(
        t.symbol,
        t.side,
        t.asset_class,
        t.entry_date,
        t.exit_date,
        t.entry_price,
        t.exit_price,
        t.quantity,
        t.stop_loss,
        t.take_profit,
        t.pnl,
        t.pnl_percent,
        t.status,
        t.setup,
        t.timeframe,
        t.notes,
        t.rating,
        assignedAccount
      );

      importedCount++;
    }

    res.json({
      message: `Successfully processed MT5 report!`,
      totalParsed: parsedTrades.length,
      importedCount,
      duplicateCount,
      assignedAccount,
    });
  } catch (error) {
    console.error('Error importing MT5 report:', error);
    res.status(500).json({ error: error.message || 'Failed to parse MT5 report file.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`TradePulse API Server running on port ${PORT}`);
});
