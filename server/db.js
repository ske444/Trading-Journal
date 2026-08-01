import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, 'journal.json');

const initialDemoTrades = [
  { id: 1, symbol: 'BTCUSDT', side: 'LONG', asset_class: 'Crypto', entry_date: '2026-07-02T09:30', exit_date: '2026-07-02T14:15', entry_price: 61200, exit_price: 63400, quantity: 0.5, stop_loss: 60500, take_profit: 64000, pnl: 1100, pnl_percent: 3.6, status: 'WIN', setup: 'Bullish Orderblock', timeframe: '15m', notes: 'Clean bounce off 15m bullish orderblock with high volume.', rating: 5, created_at: new Date().toISOString() },
  { id: 2, symbol: 'EURUSD', side: 'SHORT', asset_class: 'Forex', entry_date: '2026-07-03T10:00', exit_date: '2026-07-03T12:30', entry_price: 1.0850, exit_price: 1.0810, quantity: 100000, stop_loss: 1.0870, take_profit: 1.0800, pnl: 400, pnl_percent: 0.37, status: 'WIN', setup: 'FVG Fill', timeframe: '5m', notes: 'London session liquidity sweep into 5m Fair Value Gap.', rating: 4, created_at: new Date().toISOString() },
  { id: 3, symbol: 'NVDA', side: 'LONG', asset_class: 'Stocks', entry_date: '2026-07-06T15:30', exit_date: '2026-07-06T18:00', entry_price: 122.50, exit_price: 128.00, quantity: 50, stop_loss: 120.00, take_profit: 130.00, pnl: 275, pnl_percent: 4.49, status: 'WIN', setup: 'Breakout', timeframe: '1h', notes: 'Market open momentum breakout above key resistance.', rating: 5, created_at: new Date().toISOString() },
  { id: 4, symbol: 'ETHUSDT', side: 'SHORT', asset_class: 'Crypto', entry_date: '2026-07-07T18:20', exit_date: '2026-07-07T21:40', entry_price: 3450, exit_price: 3510, quantity: 4, stop_loss: 3480, take_profit: 3380, pnl: -240, pnl_percent: -1.74, status: 'LOSS', setup: 'Counter Trend', timeframe: '15m', notes: 'Overtraded against strong trend momentum. Hit stop loss.', rating: 2, created_at: new Date().toISOString() },
  { id: 5, symbol: 'NQ', side: 'LONG', asset_class: 'Futures', entry_date: '2026-07-09T14:00', exit_date: '2026-07-09T16:30', entry_price: 19800, exit_price: 20050, quantity: 1, stop_loss: 19700, take_profit: 20100, pnl: 250, pnl_percent: 1.26, status: 'WIN', setup: 'FVG Fill', timeframe: '15m', notes: 'US session open dip retest into bullish FVG.', rating: 5, created_at: new Date().toISOString() },
  { id: 6, symbol: 'SOLUSDT', side: 'LONG', asset_class: 'Crypto', entry_date: '2026-07-10T11:15', exit_date: '2026-07-10T15:00', entry_price: 142.00, exit_price: 148.50, quantity: 20, stop_loss: 139.00, take_profit: 150.00, pnl: 130, pnl_percent: 4.58, status: 'WIN', setup: 'Bullish Orderblock', timeframe: '1h', notes: 'Solid consolidation breakout on 1h chart.', rating: 4, created_at: new Date().toISOString() },
  { id: 7, symbol: 'GBPUSD', side: 'LONG', asset_class: 'Forex', entry_date: '2026-07-13T08:00', exit_date: '2026-07-13T10:45', entry_price: 1.2720, exit_price: 1.2690, quantity: 100000, stop_loss: 1.2685, take_profit: 1.2780, pnl: -300, pnl_percent: -0.24, status: 'LOSS', setup: 'Trend Continuation', timeframe: '15m', notes: 'Sudden CPI news release spiked market against position.', rating: 3, created_at: new Date().toISOString() },
  { id: 8, symbol: 'AAPL', side: 'SHORT', asset_class: 'Stocks', entry_date: '2026-07-14T16:00', exit_date: '2026-07-14T19:30', entry_price: 228.00, exit_price: 224.50, quantity: 60, stop_loss: 230.00, take_profit: 222.00, pnl: 210, pnl_percent: 1.54, status: 'WIN', setup: 'Double Top', timeframe: '30m', notes: 'Clean double top rejection at key resistance level.', rating: 5, created_at: new Date().toISOString() },
  { id: 9, symbol: 'BTCUSDT', side: 'SHORT', asset_class: 'Crypto', entry_date: '2026-07-16T20:00', exit_date: '2026-07-17T02:00', entry_price: 64800, exit_price: 63200, quantity: 0.4, stop_loss: 65400, take_profit: 62500, pnl: 640, pnl_percent: 2.47, status: 'WIN', setup: 'Breakout', timeframe: '1h', notes: 'Bearish breakdown below Asian session low.', rating: 4, created_at: new Date().toISOString() },
  { id: 10, symbol: 'TSLA', side: 'LONG', asset_class: 'Stocks', entry_date: '2026-07-17T15:45', exit_date: '2026-07-17T18:15', entry_price: 250.00, exit_price: 262.00, quantity: 25, stop_loss: 245.00, take_profit: 265.00, pnl: 300, pnl_percent: 4.80, status: 'WIN', setup: 'Bullish Orderblock', timeframe: '15m', notes: 'Earnings continuation momentum with high volume.', rating: 5, created_at: new Date().toISOString() },
  { id: 11, symbol: 'EURUSD', side: 'LONG', asset_class: 'Forex', entry_date: '2026-07-20T09:00', exit_date: '2026-07-20T11:30', entry_price: 1.0890, exit_price: 1.0892, quantity: 100000, stop_loss: 1.0860, take_profit: 1.0940, pnl: 20, pnl_percent: 0.02, status: 'BREAKEVEN', setup: 'Mean Reversion', timeframe: '5m', notes: 'Price consolidated sideways, closed position at breakeven.', rating: 3, created_at: new Date().toISOString() },
  { id: 12, symbol: 'ETHUSDT', side: 'LONG', asset_class: 'Crypto', entry_date: '2026-07-21T13:00', exit_date: '2026-07-21T19:00', entry_price: 3500, exit_price: 3640, quantity: 3, stop_loss: 3450, take_profit: 3700, pnl: 420, pnl_percent: 4.00, status: 'WIN', setup: 'Breakout', timeframe: '15m', notes: 'Retest of resistance turned support level.', rating: 5, created_at: new Date().toISOString() },
  { id: 13, symbol: 'NQ', side: 'SHORT', asset_class: 'Futures', entry_date: '2026-07-22T17:00', exit_date: '2026-07-22T20:30', entry_price: 20200, exit_price: 19980, quantity: 1, stop_loss: 20300, take_profit: 19900, pnl: 220, pnl_percent: 1.09, status: 'WIN', setup: 'FVG Fill', timeframe: '15m', notes: 'Bearish FVG fill during afternoon session.', rating: 5, created_at: new Date().toISOString() },
  { id: 14, symbol: 'BTCUSDT', side: 'LONG', asset_class: 'Crypto', entry_date: '2026-07-23T10:00', exit_date: null, entry_price: 66500, exit_price: null, quantity: 0.3, stop_loss: 65200, take_profit: 69000, pnl: 0, pnl_percent: 0, status: 'OPEN', setup: 'Trend Continuation', timeframe: '4h', notes: 'Active position targeting all-time highs retest.', rating: 4, created_at: new Date().toISOString() }
];

const defaultStore = {
  nextTradeId: 15,
  nextScreenshotId: 1,
  accounts: ['Main Account'],
  strategies: [],
  mt5Accounts: [],
  trades: initialDemoTrades,
  screenshots: [],
};

function loadStore() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const data = fs.readFileSync(dbFilePath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.trades) && parsed.trades.length > 0) {
        if (!Array.isArray(parsed.accounts)) {
          parsed.accounts = ['Main Account'];
        }
        if (!Array.isArray(parsed.strategies)) {
          parsed.strategies = [];
        }
        if (!Array.isArray(parsed.mt5Accounts)) {
          parsed.mt5Accounts = [];
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading database file, resetting to default:', err);
  }
  saveStore(defaultStore);
  return defaultStore;
}

function saveStore(storeData) {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(storeData, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

let store = loadStore();

const db = {
  prepare(sql) {
    const trimmed = sql.trim();

    return {
      all(...params) {
        store = loadStore();

        if (trimmed.includes('FROM trades')) {
          let list = [...store.trades];

          if (trimmed.includes('symbol LIKE ?')) {
            const sym = (params[0] || '').replace(/%/g, '').toUpperCase();
            if (sym) list = list.filter((t) => t.symbol.includes(sym));
          }
          if (trimmed.includes('side = ?')) {
            const sideParam = params[params.length - 1] || params[0];
            if (sideParam) list = list.filter((t) => t.side === sideParam);
          }
          if (trimmed.includes('asset_class = ?')) {
            const assetParam = params.find((p) => ['Crypto', 'Forex', 'Stocks', 'Futures'].includes(p));
            if (assetParam) list = list.filter((t) => t.asset_class === assetParam);
          }
          if (trimmed.includes('status = ?')) {
            const statusParam = params.find((p) => ['WIN', 'LOSS', 'OPEN', 'BREAKEVEN'].includes(p));
            if (statusParam) list = list.filter((t) => t.status === statusParam);
          }
          if (trimmed.includes('entry_date >= ?') || trimmed.includes('exit_date >= ?')) {
            const startDate = params.find((p) => typeof p === 'string' && p.includes('-'));
            if (startDate) list = list.filter((t) => (t.exit_date || t.entry_date) >= startDate);
          }

          if (trimmed.includes('account = ?')) {
            const accParam = params.find((p) => typeof p === 'string' && p !== 'ALL' && p !== 'All Accounts');
            if (accParam) {
              list = list.filter((t) => (t.account || 'Main Account') === accParam);
            }
          }

          if (trimmed.includes('ORDER BY')) {
            if (trimmed.includes('DESC')) {
              list.sort((a, b) => new Date(b.exit_date || b.entry_date || 0) - new Date(a.exit_date || a.entry_date || 0) || b.id - a.id);
            } else {
              list.sort((a, b) => new Date(a.exit_date || a.entry_date || 0) - new Date(b.exit_date || b.entry_date || 0) || a.id - b.id);
            }
          }

          return list;
        }

        if (trimmed.includes('FROM screenshots')) {
          const tradeId = params[0];
          return store.screenshots.filter((s) => s.trade_id == tradeId);
        }

        return [];
      },

      get(...params) {
        store = loadStore();

        if (trimmed.includes('SELECT COUNT(*)')) {
          return { count: store.trades.length };
        }

        if (trimmed.includes('FROM trades WHERE id = ?')) {
          const id = params[0];
          return store.trades.find((t) => t.id == id) || null;
        }

        if (trimmed.includes('FROM screenshots WHERE id = ?')) {
          const id = params[0];
          return store.screenshots.find((s) => s.id == id) || null;
        }

        return null;
      },

      run(...params) {
        store = loadStore();

        if (trimmed.includes('INSERT INTO trades')) {
          let tradeObj = {};
          if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
            tradeObj = params[0];
          } else {
            const [
              symbol, side, asset_class, entry_date, exit_date,
              entry_price, exit_price, quantity, stop_loss, take_profit,
              pnl, pnl_percent, status, setup, timeframe, notes, rating, account
            ] = params;
            tradeObj = {
              symbol, side, asset_class, entry_date, exit_date,
              entry_price, exit_price, quantity, stop_loss, take_profit,
              pnl, pnl_percent, status, setup, timeframe, notes, rating,
              account: account || 'Main Account'
            };
          }

          const newTrade = {
            id: store.nextTradeId++,
            symbol: tradeObj.symbol,
            side: tradeObj.side,
            asset_class: tradeObj.asset_class || 'Forex',
            entry_date: tradeObj.entry_date,
            exit_date: tradeObj.exit_date || null,
            entry_price: tradeObj.entry_price,
            exit_price: tradeObj.exit_price || null,
            quantity: tradeObj.quantity || 1,
            stop_loss: tradeObj.stop_loss || null,
            take_profit: tradeObj.take_profit || null,
            pnl: tradeObj.pnl || 0,
            pnl_percent: tradeObj.pnl_percent || 0,
            status: tradeObj.status || 'WIN',
            setup: tradeObj.setup || 'General',
            timeframe: tradeObj.timeframe || '15m',
            notes: tradeObj.notes || '',
            rating: tradeObj.rating || 3,
            account: tradeObj.account || 'Main Account',
            created_at: new Date().toISOString()
          };

          store.trades.push(newTrade);
          saveStore(store);
          return { lastInsertRowid: newTrade.id };
        }

        if (trimmed.includes('INSERT INTO screenshots')) {
          const [trade_id, filename, original_name] = params;
          const newScreenshot = {
            id: store.nextScreenshotId++,
            trade_id: Number(trade_id),
            filename,
            original_name,
            created_at: new Date().toISOString()
          };
          store.screenshots.push(newScreenshot);
          saveStore(store);
          return { lastInsertRowid: newScreenshot.id };
        }

        if (trimmed.includes('UPDATE trades SET')) {
          const tradeId = params[params.length - 1];
          const index = store.trades.findIndex((t) => t.id == tradeId);
          if (index !== -1) {
            const [
              symbol, side, asset_class, entry_date, exit_date,
              entry_price, exit_price, quantity, stop_loss, take_profit,
              pnl, pnl_percent, status, setup, timeframe, notes, rating
            ] = params;

            store.trades[index] = {
              ...store.trades[index],
              symbol, side, asset_class, entry_date, exit_date,
              entry_price, exit_price, quantity, stop_loss, take_profit,
              pnl, pnl_percent, status, setup, timeframe, notes, rating
            };
            saveStore(store);
          }
          return { changes: 1 };
        }

        if (trimmed.includes('DELETE FROM trades')) {
          if (trimmed.includes('account = ?')) {
            const accName = params[0];
            const toDelete = store.trades.filter((t) => (t.account || 'Main Account') === accName);
            const deleteIds = new Set(toDelete.map((t) => t.id));
            store.trades = store.trades.filter((t) => !deleteIds.has(t.id));
            store.screenshots = store.screenshots.filter((s) => !deleteIds.has(s.trade_id));
            if (Array.isArray(store.accounts)) {
              store.accounts = store.accounts.filter((a) => a !== accName);
            }
            saveStore(store);
            return { changes: toDelete.length };
          } else {
            const tradeId = params[0];
            store.trades = store.trades.filter((t) => t.id != tradeId);
            store.screenshots = store.screenshots.filter((s) => s.trade_id != tradeId);
            saveStore(store);
            return { changes: 1 };
          }
        }

        if (trimmed.includes('DELETE FROM screenshots')) {
          const id = params[0];
          store.screenshots = store.screenshots.filter((s) => s.id != id);
          saveStore(store);
          return { changes: 1 };
        }

        return { changes: 0 };
      }
    };
  },

  getAccounts() {
    store = loadStore();
    const explicit = Array.isArray(store.accounts) ? store.accounts : ['Main Account'];
    const tradeAccounts = store.trades
      .map((t) => (t.account ? t.account.trim() : 'Main Account'))
      .filter(Boolean);
    const combined = new Set([...explicit, ...tradeAccounts]);
    return Array.from(combined);
  },

  addAccount(name) {
    store = loadStore();
    if (!Array.isArray(store.accounts)) {
      store.accounts = ['Main Account'];
    }
    const cleanName = name.trim();
    if (!store.accounts.includes(cleanName)) {
      store.accounts.push(cleanName);
      saveStore(store);
    }
    return store.accounts;
  },

  deleteAccount(name) {
    store = loadStore();
    if (Array.isArray(store.accounts)) {
      store.accounts = store.accounts.filter((a) => a !== name);
    }
    if (Array.isArray(store.mt5Accounts)) {
      store.mt5Accounts = store.mt5Accounts.filter((m) => m.accountName !== name);
    }
    saveStore(store);
  },

  getStrategies() {
    store = loadStore();
    const defaults = [
      'Bullish Orderblock',
      'Bearish Orderblock',
      'Fair Value Gap (FVG)',
      'Breakout & Retest',
      'Trend Continuation',
      'Mean Reversion',
      'Double Top / Bottom',
      'Counter Trend',
    ];
    const explicit = Array.isArray(store.strategies) ? store.strategies : [];
    const tradeSetups = store.trades
      .map((t) => (t.setup ? t.setup.trim() : ''))
      .filter(Boolean);
    const combined = new Set([...defaults, ...explicit, ...tradeSetups]);
    return Array.from(combined);
  },

  addStrategy(name) {
    store = loadStore();
    if (!Array.isArray(store.strategies)) {
      store.strategies = [];
    }
    const cleanName = name.trim();
    if (cleanName) {
      const existing = this.getStrategies();
      const existsCaseInsensitive = existing.some(
        (s) => s.toLowerCase() === cleanName.toLowerCase()
      );
      if (!existsCaseInsensitive) {
        store.strategies.push(cleanName);
        saveStore(store);
      }
    }
    return this.getStrategies();
  },

  getMT5Accounts() {
    store = loadStore();
    return Array.isArray(store.mt5Accounts) ? store.mt5Accounts : [];
  },

  getMT5AccountByName(name) {
    store = loadStore();
    if (!Array.isArray(store.mt5Accounts)) return null;
    return store.mt5Accounts.find((m) => m.accountName === name) || null;
  },

  saveMT5Account(mt5Data) {
    store = loadStore();
    if (!Array.isArray(store.mt5Accounts)) store.mt5Accounts = [];
    const index = store.mt5Accounts.findIndex((m) => m.accountName === mt5Data.accountName);
    const updatedRecord = {
      accountName: mt5Data.accountName,
      accountLogin: mt5Data.accountLogin,
      server: mt5Data.server,
      // Store password masked or as string for mock direct MT5 server auth
      password: mt5Data.password ? '••••••••' : '••••••••',
      status: mt5Data.status || 'Connected',
      lastSync: new Date().toISOString(),
      autoSync: mt5Data.autoSync !== undefined ? mt5Data.autoSync : true,
      balance: mt5Data.balance || 10000,
      createdAt: mt5Data.createdAt || new Date().toISOString(),
    };

    if (index !== -1) {
      store.mt5Accounts[index] = { ...store.mt5Accounts[index], ...updatedRecord };
    } else {
      store.mt5Accounts.push(updatedRecord);
    }
    saveStore(store);
    return updatedRecord;
  },

  updateMT5LastSync(accountName) {
    store = loadStore();
    if (Array.isArray(store.mt5Accounts)) {
      const acc = store.mt5Accounts.find((m) => m.accountName === accountName);
      if (acc) {
        acc.lastSync = new Date().toISOString();
        acc.status = 'Connected';
        saveStore(store);
      }
    }
  },

  exec() {}
};

console.log('JSON Database initialized with pre-seeded trades at:', dbFilePath);

export default db;
export { uploadsDir, loadStore, saveStore };
