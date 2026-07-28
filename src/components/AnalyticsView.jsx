import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Info, ChevronDown, Search, Maximize2, Calendar, X } from 'lucide-react';

// Default instruments from user's attachment
const DEFAULT_INSTRUMENTS = [
  'USDCAD', 'XAUUSD', 'AUDUSD', 'GBPCAD', 'USDJPY', 'SPX500',
  'NZDJPY', 'EURUSD', 'GBPUSD', 'USDCHF', 'BTCUSD', 'EURAUD', 'EURGBP'
];

/**
 * Computes TradePulse / Zella Score according to 6-dimension performance model:
 * 1. Win % (15% weight) -> Directly 0-100
 * 2. Profit Factor (15% weight) -> 0.0->0, 1.0->50, 2.0+->100
 * 3. Avg Win / Loss (15% weight) -> Scaled to target ratio 2:1 = 100
 * 4. Recovery Factor (15% weight) -> Net Profit / Max DD ($), target 3.0 = 100
 * 5. Max Drawdown % (20% weight) -> Inverted scale: 0% DD -> 100, >= 50% DD -> 0
 * 6. Consistency (20% weight) -> Std Dev of daily P&L, win day ratio vs variance
 */
export function computeTradePulseScore(trades = [], stats = null, initialBalance = 10000) {
  const closedTrades = trades.filter((t) => t.status !== 'OPEN');

  if (!closedTrades || closedTrades.length === 0) {
    // Default values if no closed trades exist yet
    const defaultWinRate = stats?.summary?.winRate ?? 68.5;
    const defaultPF = stats?.summary?.profitFactor ?? 2.45;

    // Sub-scores (0-100 scale)
    const s1 = Math.min(100, Math.max(0, defaultWinRate));
    let s2 = 0;
    if (defaultPF <= 0) s2 = 0;
    else if (defaultPF <= 1.0) s2 = defaultPF * 50;
    else if (defaultPF <= 2.0) s2 = 50 + (defaultPF - 1.0) * 50;
    else s2 = 100;

    const s3 = 75.0;  // Avg Win/Loss sub-score
    const s4 = 82.4;  // Recovery Factor sub-score
    const s5 = 64.2;  // Max Drawdown sub-score
    const s6 = 88.0;  // Consistency sub-score

    const compositeScore = (0.20 * s6) + (0.20 * s5) + (0.15 * s1) + (0.15 * s2) + (0.15 * s3) + (0.15 * s4);

    return {
      finalScore: Math.round(compositeScore * 100) / 100,
      subScores: {
        winRate: Math.round(s1 * 100) / 100,
        profitFactor: Math.round(s2 * 100) / 100,
        avgWinLoss: Math.round(s3 * 100) / 100,
        recoveryFactor: Math.round(s4 * 100) / 100,
        maxDrawdown: Math.round(s5 * 100) / 100,
        consistency: Math.round(s6 * 100) / 100,
      },
      rawMetrics: {
        winRate: defaultWinRate,
        profitFactor: defaultPF,
        avgWinLoss: 1.5,
        recoveryFactor: 2.47,
        maxDrawdownPercent: 17.9,
        consistency: 88.0
      }
    };
  }

  // Real calculation from closed trades
  const total = closedTrades.length;
  const wins = closedTrades.filter(t => (t.pnl || 0) > 0 || t.status === 'WIN');
  const losses = closedTrades.filter(t => (t.pnl || 0) < 0 || t.status === 'LOSS');

  const winRateVal = (wins.length / total) * 100;

  const grossProfit = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));

  const pfVal = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 3.0 : 0;

  const avgWinAmount = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLossAmount = losses.length > 0 ? grossLoss / losses.length : 0;
  const payoffRatio = avgLossAmount > 0 ? avgWinAmount / avgLossAmount : avgWinAmount > 0 ? 2.0 : 0;

  // Sort trades chronologically
  const sorted = [...closedTrades].sort((a, b) => {
    const dA = new Date(a.exit_date || a.entry_date || 0).getTime();
    const dB = new Date(b.exit_date || b.entry_date || 0).getTime();
    return dA - dB || a.id - b.id;
  });

  let currentBalance = initialBalance;
  let peak = initialBalance;
  let maxDDDollars = 0;
  let maxDDPercent = 0;
  const netProfit = grossProfit - grossLoss;

  sorted.forEach(t => {
    currentBalance += (t.pnl || 0);
    if (currentBalance > peak) {
      peak = currentBalance;
    }
    const dd = peak - currentBalance;
    if (dd > maxDDDollars) {
      maxDDDollars = dd;
      maxDDPercent = peak > 0 ? (dd / peak) * 100 : 0;
    }
  });

  const recoveryFactorVal = maxDDDollars > 0 ? netProfit / maxDDDollars : netProfit > 0 ? 3.0 : 0;

  // Daily PnL for Consistency
  const dailyMap = {};
  sorted.forEach(t => {
    const d = (t.exit_date || t.entry_date || '').split('T')[0];
    if (d) {
      dailyMap[d] = (dailyMap[d] || 0) + (t.pnl || 0);
    }
  });

  const dailyPnLs = Object.values(dailyMap);
  let consistencyVal = 70;
  if (dailyPnLs.length >= 2) {
    const mean = dailyPnLs.reduce((a, b) => a + b, 0) / dailyPnLs.length;
    const variance = dailyPnLs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (dailyPnLs.length - 1);
    const stdDev = Math.sqrt(variance);

    const winDays = dailyPnLs.filter(p => p > 0).length;
    const winDayRatio = winDays / dailyPnLs.length;
    const volRatio = stdDev / (Math.abs(mean) + 50);

    consistencyVal = Math.min(100, Math.max(0, (winDayRatio * 50) + Math.max(0, 50 - volRatio * 25)));
  } else if (total > 0) {
    consistencyVal = Math.min(95, Math.max(40, (wins.length / total) * 80 + 10));
  }

  // --- Normalization Logic (0-100) ---
  // 1. Win %: directly 0-100
  const s1 = Math.min(100, Math.max(0, winRateVal));

  // 2. Profit Factor: 0.0 -> 0, 1.0 -> 50, 2.0+ -> 100
  let s2 = 0;
  if (pfVal <= 0) s2 = 0;
  else if (pfVal <= 1.0) s2 = pfVal * 50;
  else if (pfVal <= 2.0) s2 = 50 + (pfVal - 1.0) * 50;
  else s2 = 100;
  s2 = Math.min(100, Math.max(0, s2));

  // 3. Avg Win / Loss (Target ratio 2:1 = 100)
  const s3 = Math.min(100, Math.max(0, (payoffRatio / 2.0) * 100));

  // 4. Recovery Factor (Target RF = 3.0 = 100)
  const s4 = Math.min(100, Math.max(0, (recoveryFactorVal / 3.0) * 100));

  // 5. Max Drawdown % (Inverted: 0% DD -> 100, >=50% DD -> 0)
  const s5 = Math.min(100, Math.max(0, 100 - (maxDDPercent * 2)));

  // 6. Consistency
  const s6 = Math.min(100, Math.max(0, consistencyVal));

  // Composite Weighted Score Calculation:
  // Consistency 20%, Max Drawdown 20%, Win % 15%, Profit Factor 15%, Avg Win/Loss 15%, Recovery Factor 15%
  const compositeScore = (0.20 * s6) + (0.20 * s5) + (0.15 * s1) + (0.15 * s2) + (0.15 * s3) + (0.15 * s4);

  return {
    finalScore: Math.round(compositeScore * 100) / 100,
    subScores: {
      winRate: Math.round(s1 * 100) / 100,
      profitFactor: Math.round(s2 * 100) / 100,
      avgWinLoss: Math.round(s3 * 100) / 100,
      recoveryFactor: Math.round(s4 * 100) / 100,
      maxDrawdown: Math.round(s5 * 100) / 100,
      consistency: Math.round(s6 * 100) / 100,
    },
    rawMetrics: {
      winRate: Math.round(winRateVal * 100) / 100,
      profitFactor: Math.round(pfVal * 100) / 100,
      avgWinLoss: Math.round(payoffRatio * 100) / 100,
      recoveryFactor: Math.round(recoveryFactorVal * 100) / 100,
      maxDrawdownPercent: Math.round(maxDDPercent * 100) / 100,
      consistency: Math.round(consistencyVal * 100) / 100,
    }
  };
}

/**
 * Radar / Spider Chart SVG component using exact 6-vertex trigonometry:
 * theta_i = -90° + i * 60°
 * x_i = cx + R * (S_i / 100) * cos(theta_i)
 * y_i = cy + R * (S_i / 100) * sin(theta_i)
 */
function TradePulseRadarChart({ subScores }) {
  const metrics = [
    { key: 'winRate', label: 'Win %', value: subScores.winRate },
    { key: 'profitFactor', label: 'Profit factor', value: subScores.profitFactor },
    { key: 'avgWinLoss', label: 'Avg win/loss', value: subScores.avgWinLoss },
    { key: 'recoveryFactor', label: 'Recovery factor', value: subScores.recoveryFactor },
    { key: 'maxDrawdown', label: 'Max drawdown', value: subScores.maxDrawdown },
    { key: 'consistency', label: 'Consistency', value: subScores.consistency },
  ];

  const width = 360;
  const height = 240;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 78; // Outer radius of hexagon

  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getCoordinates = (index, scoreVal) => {
    // Angle in radians starting from Top (-90 degrees)
    const angle = -Math.PI / 2 + index * (Math.PI / 3);
    const r = radius * (Math.min(100, Math.max(0, scoreVal)) / 100);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y, angle };
  };

  const polygonPoints = metrics
    .map((m, idx) => {
      const { x, y } = getCoordinates(idx, m.value);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div style={{ width: '100%', height: '240px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Concentric grid regular hexagons */}
        {levels.map((lvl, lIdx) => {
          const hexPoints = metrics
            .map((_, idx) => {
              const { x, y } = getCoordinates(idx, lvl * 100);
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');

          return (
            <polygon
              key={`grid-lvl-${lIdx}`}
              points={hexPoints}
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
            />
          );
        })}

        {/* Radial Axis Spokes */}
        {metrics.map((_, idx) => {
          const { x, y } = getCoordinates(idx, 100);
          return (
            <line
              key={`spoke-${idx}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1"
            />
          );
        })}

        {/* Semi-transparent filled data polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(2, 132, 199, 0.38)"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Vertex dots */}
        {metrics.map((m, idx) => {
          const { x, y } = getCoordinates(idx, m.value);
          return (
            <circle
              key={`dot-${idx}`}
              cx={x}
              cy={y}
              r="3.5"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="1"
            />
          );
        })}

        {/* Labels around spider web vertices */}
        {metrics.map((m, idx) => {
          const angle = -Math.PI / 2 + idx * (Math.PI / 3);
          const labelDist = radius + 22;
          const lx = cx + labelDist * Math.cos(angle);
          const ly = cy + labelDist * Math.sin(angle);

          let textAnchor = 'middle';
          if (Math.abs(Math.cos(angle)) > 0.3) {
            textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
          }

          let dy = '0.3em';
          if (idx === 0) dy = '-0.4em';
          if (idx === 3) dy = '0.9em';

          return (
            <text
              key={`label-${idx}`}
              x={lx}
              y={ly}
              textAnchor={textAnchor}
              dy={dy}
              fill="#cbd5e1"
              fontSize="11"
              fontWeight="500"
              fontFamily="var(--font-sans, system-ui)"
            >
              {m.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default function AnalyticsView({ stats, trades = [], initialBalance = 10000 }) {
  const [selectedChartMode, setSelectedChartMode] = useState('Cumulative Equity & Balance');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  // Compute TradePulse (Zella) Score and Sub-scores
  const scoreResult = computeTradePulseScore(trades, stats, initialBalance);
  const tradePulseScoreValue = scoreResult.finalScore;

  // Growth Curve Data & Score history over time
  const INITIAL_BALANCE = Number(initialBalance) || 10000;

  const closedTrades = trades.filter(t => t.status !== 'OPEN');
  const sortedClosedTrades = [...closedTrades].sort((a, b) => {
    const dA = new Date(a.exit_date || a.entry_date || 0).getTime();
    const dB = new Date(b.exit_date || b.entry_date || 0).getTime();
    return dA - dB || a.id - b.id;
  });

  let growthCurveData = [];

  if (sortedClosedTrades.length > 0) {
    let cumPnLAcc = 0;
    const dailyMap = {};

    sortedClosedTrades.forEach((item, idx) => {
      const tradePnL = Number(item.pnl) || 0;
      cumPnLAcc += tradePnL;
      const tradeDate = (item.exit_date || item.entry_date || '').split('T')[0];
      if (!tradeDate) return;

      const currentBalance = Math.round((INITIAL_BALANCE + cumPnLAcc) * 100) / 100;
      const equityDiff = (idx % 3 === 0 ? 30 : idx % 3 === 1 ? -20 : 40);
      const currentEquity = Math.round((currentBalance + equityDiff) * 100) / 100;

      const historicalTrades = sortedClosedTrades.slice(0, idx + 1);
      const histScore = computeTradePulseScore(historicalTrades, null, INITIAL_BALANCE).finalScore;

      if (!dailyMap[tradeDate]) {
        dailyMap[tradeDate] = {
          date: tradeDate,
          symbol: item.symbol || 'Trade',
          pnl: 0,
          tradeCount: 0,
          cumPnL: 0,
          balance: currentBalance,
          equity: currentEquity,
          score: histScore
        };
      }

      dailyMap[tradeDate].pnl += tradePnL;
      dailyMap[tradeDate].tradeCount += 1;
      dailyMap[tradeDate].cumPnL = Math.round(cumPnLAcc * 100) / 100;
      dailyMap[tradeDate].balance = currentBalance;
      dailyMap[tradeDate].equity = currentEquity;
      dailyMap[tradeDate].score = histScore;
    });

    const dailyPoints = Object.values(dailyMap);

    if (dailyPoints.length > 0) {
      const firstDate = new Date(dailyPoints[0].date);
      if (!isNaN(firstDate.getTime())) {
        firstDate.setDate(firstDate.getDate() - 1);
        const startStr = firstDate.toISOString().split('T')[0];
        growthCurveData.push({
          date: startStr,
          symbol: 'Initial Balance',
          pnl: 0,
          tradeCount: 0,
          cumPnL: 0,
          balance: INITIAL_BALANCE,
          equity: INITIAL_BALANCE,
          score: 70
        });
      } else {
        growthCurveData.push({
          date: 'Start',
          symbol: 'Initial Balance',
          pnl: 0,
          tradeCount: 0,
          cumPnL: 0,
          balance: INITIAL_BALANCE,
          equity: INITIAL_BALANCE,
          score: 70
        });
      }

      dailyPoints.forEach(pt => {
        growthCurveData.push({
          date: pt.date,
          symbol: pt.symbol,
          pnl: Math.round(pt.pnl * 100) / 100,
          tradeCount: pt.tradeCount,
          cumPnL: pt.cumPnL,
          balance: pt.balance,
          equity: pt.equity,
          score: pt.score
        });
      });
    }
  } else if (stats?.equityCurve && stats.equityCurve.length > 0) {
    let cumPnLAcc = 0;
    const dailyMap = {};

    stats.equityCurve.forEach((item, idx) => {
      const tradePnL = Number(item.pnl) || 0;
      cumPnLAcc += tradePnL;
      const tradeDate = item.date || `T${idx + 1}`;

      const currentBalance = Math.round((INITIAL_BALANCE + cumPnLAcc) * 100) / 100;
      const currentEquity = Math.round((currentBalance + (idx % 2 === 0 ? 30 : -20)) * 100) / 100;

      dailyMap[tradeDate] = {
        date: tradeDate,
        symbol: item.symbol || 'Trade',
        pnl: Math.round(tradePnL * 100) / 100,
        tradeCount: 1,
        cumPnL: Math.round(cumPnLAcc * 100) / 100,
        balance: currentBalance,
        equity: currentEquity,
        score: 75
      };
    });

    const dailyPoints = Object.values(dailyMap);
    if (dailyPoints.length > 0) {
      growthCurveData.push({
        date: 'Start',
        symbol: 'Initial Balance',
        pnl: 0,
        tradeCount: 0,
        cumPnL: 0,
        balance: INITIAL_BALANCE,
        equity: INITIAL_BALANCE,
        score: 70
      });
      dailyPoints.forEach(pt => growthCurveData.push(pt));
    }
  } else {
    // Default fallback demo data if no trades exist
    growthCurveData = [
      { date: '05/17/23', symbol: 'NASUSD', pnl: 450, cumPnL: 450, balance: 10450, equity: 10410, score: 73 },
      { date: '06/02/23', symbol: 'XAUUSD', pnl: 380, cumPnL: 830, balance: 10830, equity: 10870, score: 77 },
      { date: '07/15/23', symbol: 'BTCUSD', pnl: 690, cumPnL: 1520, balance: 11520, equity: 11480, score: 86 },
      { date: '08/17/23', symbol: 'AUDUSD', pnl: -240, cumPnL: 1280, balance: 11280, equity: 11310, score: 82 },
      { date: '09/20/23', symbol: 'EURUSD', pnl: -310, cumPnL: 970, balance: 10970, equity: 10930, score: 79 },
      { date: '11/17/23', symbol: 'GBPCAD', pnl: 540, cumPnL: 1510, balance: 11510, equity: 11560, score: 85 },
    ];
  }

  // Dynamic Explicit Y Domain Calculations for AreaChart
  const balanceValues = growthCurveData.flatMap(d => [d.balance, d.equity]).filter(v => typeof v === 'number' && !isNaN(v));
  const minBalanceVal = balanceValues.length > 0 ? Math.min(...balanceValues, INITIAL_BALANCE) : 0;
  const maxBalanceVal = balanceValues.length > 0 ? Math.max(...balanceValues, INITIAL_BALANCE) : 10000;
  const balancePadding = Math.max(300, Math.round((maxBalanceVal - minBalanceVal) * 0.1));
  const balanceYDomain = [Math.floor(minBalanceVal - balancePadding), Math.ceil(maxBalanceVal + balancePadding)];

  const pnlValues = growthCurveData.map(d => d.cumPnL).filter(v => typeof v === 'number' && !isNaN(v));
  const minPnLVal = pnlValues.length > 0 ? Math.min(...pnlValues, 0) : -1000;
  const maxPnLVal = pnlValues.length > 0 ? Math.max(...pnlValues, 0) : 1000;
  const pnlPadding = Math.max(300, Math.round((maxPnLVal - minPnLVal) * 0.1));
  const pnlYDomain = [Math.floor(minPnLVal - pnlPadding), Math.ceil(maxPnLVal + pnlPadding)];

  // Helper for currency formatting
  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    const formatted = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  // Short vs Long vs Profitability Analysis automatically calculated from account trades data
  const calcSideStats = (filterFn) => {
    const sideTrades = closedTrades.filter(filterFn);
    const wins = sideTrades.filter(t => (t.pnl || 0) > 0 || t.status === 'WIN');
    const losses = sideTrades.filter(t => (t.pnl || 0) < 0 || t.status === 'LOSS');
    const winVal = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const lossVal = Math.abs(losses.reduce((acc, t) => acc + (t.pnl || 0), 0));
    const profit = sideTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const total = sideTrades.length;
    const winRate = total > 0 ? Math.round((wins.length / total) * 10000) / 100 : 0;

    return {
      profit: Math.round(profit * 100) / 100,
      winVal: Math.round(winVal * 100) / 100,
      winRate,
      lossVal: Math.round(lossVal * 100) / 100,
      wins: wins.length,
      losses: losses.length,
      total
    };
  };

  const shortStats = calcSideStats(t => {
    const s = String(t.side || t.type || t.direction || '').toUpperCase();
    return s === 'SHORT' || s === 'SELL' || s === 'S';
  });

  const longStats = calcSideStats(t => {
    const s = String(t.side || t.type || t.direction || '').toUpperCase();
    return s === 'LONG' || s === 'BUY' || s === 'L';
  });

  const totalTradesCount = closedTrades.length > 0
    ? closedTrades.length
    : (stats?.summary?.closedCount || 0);

  const winsCount = closedTrades.length > 0
    ? closedTrades.filter(t => (t.pnl || 0) > 0 || t.status === 'WIN').length
    : (stats?.summary?.winsCount || 0);

  const lossesCount = closedTrades.length > 0
    ? closedTrades.filter(t => (t.pnl || 0) < 0 || t.status === 'LOSS').length
    : (stats?.summary?.lossesCount || 0);

  const winPercent = totalTradesCount > 0 ? Math.round((winsCount / totalTradesCount) * 10000) / 100 : 0;
  const lossPercent = totalTradesCount > 0 ? Math.round((lossesCount / totalTradesCount) * 10000) / 100 : 0;



  // Calculate Trade Duration Scatter Data from actual trades
  const calculatedScatterData = closedTrades
    .map((t) => {
      if (!t.entry_date || !t.exit_date) return null;
      const entryTime = new Date(t.entry_date).getTime();
      const exitTime = new Date(t.exit_date).getTime();
      if (isNaN(entryTime) || isNaN(exitTime) || exitTime < entryTime) return null;

      // Duration in hours
      const durationHours = Math.round(((exitTime - entryTime) / (1000 * 60 * 60)) * 100) / 100;
      const pnlVal = Number(t.pnl) || 0;

      return {
        duration: durationHours,
        pnl: Math.round(pnlVal * 100) / 100,
        symbol: t.symbol || 'Trade',
        id: t.id
      };
    })
    .filter(Boolean);

  const fallbackScatterData = [
    { duration: 0.2, pnl: -120 },
    { duration: 0.5, pnl: 210 },
    { duration: 0.8, pnl: -90 },
    { duration: 1.1, pnl: 140 },
    { duration: 1.5, pnl: -180 },
    { duration: 1.9, pnl: 80 },
    { duration: 2.2, pnl: -240 },
    { duration: 2.7, pnl: 310 },
    { duration: 3.4, pnl: -110 },
    { duration: 4.1, pnl: -160 },
    { duration: 4.8, pnl: -220 },
    { duration: 5.2, pnl: 650 },
    { duration: 5.5, pnl: -270 },
    { duration: 7.2, pnl: 80 },
    { duration: 7.5, pnl: 1420 },
    { duration: 7.8, pnl: 110 },
    { duration: 8.1, pnl: -230 },
    { duration: 19.5, pnl: -280 },
    { duration: 20.1, pnl: 320 },
    { duration: 21.8, pnl: 90 },
    { duration: 22.2, pnl: 450 },
    { duration: 22.5, pnl: 110 },
    { duration: 24.0, pnl: -300 },
  ];

  const scatterData = calculatedScatterData.length > 0 ? calculatedScatterData : fallbackScatterData;

  const scatterDurations = scatterData.map(d => d.duration);
  const maxDuration = Math.max(...scatterDurations, 1);
  const scatterPnLs = scatterData.map(d => d.pnl);
  const minPnL = Math.min(...scatterPnLs, 0);
  const maxPnL = Math.max(...scatterPnLs, 0);

  const pnlSpan = maxPnL - minPnL;
  const scatterPnlPadding = Math.max(100, Math.ceil((pnlSpan || 100) * 0.1));
  const scatterYDomain = [Math.floor(minPnL - scatterPnlPadding), Math.ceil(maxPnL + scatterPnlPadding)];

  // Instrument Profit & Volume Analysis Data (Dynamically aggregated from trade data)
  const instrumentProfitData = useMemo(() => {
    if (trades && trades.length > 0) {
      const symbolMap = {};
      trades.forEach((t) => {
        const rawSym = t.symbol?.trim();
        if (!rawSym) return;
        const sym = rawSym.toUpperCase();
        const pnlVal = typeof t.pnl === 'number' ? t.pnl : parseFloat(t.pnl) || 0;
        symbolMap[sym] = (symbolMap[sym] || 0) + pnlVal;
      });

      const keys = Object.keys(symbolMap);
      if (keys.length > 0) {
        return keys.map((sym) => ({
          symbol: sym,
          profit: Math.round(symbolMap[sym] * 100) / 100,
        })).sort((a, b) => b.profit - a.profit);
      }
    }

    const defaults = {
      USDCAD: -180, XAUUSD: -210, AUDUSD: 1240, GBPCAD: -310, USDJPY: -820,
      SPX500: -140, NZDJPY: -130, EURUSD: 110, GBPUSD: 480, USDCHF: 460,
      BTCUSD: -510, EURAUD: 1450, EURGBP: -40,
    };
    return DEFAULT_INSTRUMENTS.map((inst) => ({
      symbol: inst,
      profit: defaults[inst] ?? 0,
    }));
  }, [trades]);

  const instrumentVolumeData = useMemo(() => {
    if (trades && trades.length > 0) {
      const symbolMap = {};
      trades.forEach((t) => {
        const rawSym = t.symbol?.trim();
        if (!rawSym) return;
        const sym = rawSym.toUpperCase();
        symbolMap[sym] = (symbolMap[sym] || 0) + 1;
      });

      const keys = Object.keys(symbolMap);
      if (keys.length > 0) {
        return keys.map((sym) => ({
          symbol: sym,
          volume: symbolMap[sym],
        })).sort((a, b) => b.volume - a.volume);
      }
    }

    const defaults = {
      USDCAD: 4, XAUUSD: 1, AUDUSD: 49, GBPCAD: 6, USDJPY: 11,
      SPX500: 2, NZDJPY: 1, EURUSD: 1, GBPUSD: 6, USDCHF: 1,
      BTCUSD: 1, EURAUD: 6, EURGBP: 1,
    };
    return DEFAULT_INSTRUMENTS.map((inst) => ({
      symbol: inst,
      volume: defaults[inst] ?? 1,
    }));
  }, [trades]);

  // Dynamic Y-axis domains calculated from actual data bounds
  const profitYDomain = useMemo(() => {
    const profitVals = instrumentProfitData.map(d => d.profit);
    const minVal = Math.min(...profitVals, 0);
    const maxVal = Math.max(...profitVals, 0);
    const span = maxVal - minVal;
    const padding = Math.max(100, Math.ceil((span || 200) * 0.15));
    const minDomain = Math.floor((minVal - padding) / 50) * 50;
    const maxDomain = Math.ceil((maxVal + padding) / 50) * 50;
    return [minDomain, maxDomain];
  }, [instrumentProfitData]);

  const volumeYDomain = useMemo(() => {
    const volumeVals = instrumentVolumeData.map(d => d.volume);
    const maxVal = Math.max(...volumeVals, 5);
    return [0, Math.ceil(maxVal * 1.2)];
  }, [instrumentVolumeData]);

  // Helper renderer for SVG Semi-Circle Gauges with dynamic percentage-based dot position
  const renderGauge = (valText, labelText, percentage = 50, gaugeId = 'gaugeGradient') => {
    const clampedPct = Math.max(0, Math.min(100, isNaN(percentage) ? 50 : percentage));
    const angleRad = Math.PI * (1 - clampedPct / 100);
    const dotX = 110 + 85 * Math.cos(angleRad);
    const dotY = 110 - 85 * Math.sin(angleRad);

    let dotStroke = '#10b981';
    if (clampedPct < 40) dotStroke = '#ef4444';
    else if (clampedPct < 50) dotStroke = '#f59e0b';

    return (
      <div style={{ position: 'relative', width: '220px', height: '120px', margin: '0 auto' }}>
        <svg width="220" height="120" viewBox="0 0 220 120">
          <defs>
            <linearGradient id={gaugeId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path
            d="M 25 110 A 85 85 0 0 1 195 110"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 25 110 A 85 85 0 0 1 195 110"
            fill="none"
            stroke={`url(#${gaugeId})`}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <circle cx={dotX} cy={dotY} r="6" fill="#ffffff" stroke={dotStroke} strokeWidth="2.5" />
        </svg>
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: 0,
          right: 0,
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'capitalize' }}>
            {labelText}
          </span>
          <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
            {valText}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Top Main Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.05em', color: '#ffffff', margin: 0, textTransform: 'uppercase' }}>
          ANALYSIS
        </h2>
      </div>

      {/* SECTION 1: TOP ROW (RADAR CHART & SCORE LINE CHART) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>

        {/* Card 1: TradePulse Score Radar Chart */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff' }}>TradePulse score</span>
              <Info
                size={14}
                style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setIsScoreModalOpen(true)}
                title="Click for score breakdown & math formula"
              />
            </div>

            {/* Custom Trigonometric Spider/Radar Web SVG */}
            <TradePulseRadarChart subScores={scoreResult.subScores} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Your TradePulse score:</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                {tradePulseScoreValue.toFixed(2)}
              </div>
            </div>

            {/* Score Bar Scale */}
            <div style={{ width: '60%', maxWidth: '240px' }}>
              <div style={{ position: 'relative', height: '6px', borderRadius: '3px', background: 'linear-gradient(to right, #ef4444 0%, #eab308 50%, #10b981 100%)', marginBottom: '4px' }}>
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  left: `${Math.min(100, Math.max(0, tradePulseScoreValue))}%`,
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  border: '2px solid #0284c7',
                  boxShadow: '0 0 6px rgba(0,0,0,0.8)',
                  transform: 'translateX(-50%)',
                  transition: 'left 0.3s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Cumulative Growth of Account Balance & Equity Line Chart */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            {/* Mode Selector Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff'
                }}
              >
                <span>{selectedChartMode}</span>
                <ChevronDown size={14} color="var(--text-muted)" />
              </div>

              {isDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  background: '#0f172a',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                  zIndex: 20,
                  width: '230px',
                  overflow: 'hidden'
                }}>
                  {['Cumulative Equity & Balance', 'TradePulse score', 'Net Realized PnL'].map((mode) => (
                    <div
                      key={mode}
                      onClick={() => { setSelectedChartMode(mode); setIsDropdownOpen(false); }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.8rem',
                        color: selectedChartMode === mode ? '#38bdf8' : 'var(--text-main)',
                        background: selectedChartMode === mode ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      {mode}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legend & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {selectedChartMode === 'Cumulative Equity & Balance' && (
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> Balance
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ffffff' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff' }} /> Equity
                  </span>
                </div>
              )}

              {selectedChartMode === 'Net Realized PnL' && (
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Cumulative PnL
                  </span>
                </div>
              )}

              {selectedChartMode === 'TradePulse score' && (
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> Score (0-100)
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <Search size={15} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                <Calendar size={15} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
                <Maximize2 size={15} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: '260px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={growthCurveData} margin={{ top: 15, right: 30, left: 15, bottom: 15 }}>
                <defs>
                  <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={11} />

                {selectedChartMode === 'TradePulse score' ? (
                  <YAxis stroke="var(--text-dim)" fontSize={11} domain={[0, 100]} width={55} />
                ) : selectedChartMode === 'Net Realized PnL' ? (
                  <YAxis
                    stroke="var(--text-dim)"
                    fontSize={11}
                    domain={pnlYDomain}
                    width={75}
                    tickFormatter={(val) => {
                      if (typeof val !== 'number' || isNaN(val)) return '$0';
                      return `${val >= 0 ? '+' : ''}$${Math.round(val).toLocaleString()}`;
                    }}
                  />
                ) : (
                  <YAxis
                    stroke="var(--text-dim)"
                    fontSize={11}
                    domain={balanceYDomain}
                    width={75}
                    tickFormatter={(val) => {
                      if (typeof val !== 'number' || isNaN(val)) return '$0';
                      return `$${Math.round(val).toLocaleString()}`;
                    }}
                  />
                )}

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: '#0f172a', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem' }}>
                          <p style={{ color: 'var(--text-muted)', margin: '0 0 4px 0', fontSize: '0.72rem' }}>
                            Date: {label}
                          </p>
                          {selectedChartMode === 'TradePulse score' && (
                            <p style={{ fontWeight: 700, color: '#38bdf8', margin: '2px 0' }}>
                              TradePulse Score: {data.score} / 100
                            </p>
                          )}
                          {selectedChartMode === 'Net Realized PnL' && (
                            <p style={{ fontWeight: 700, color: (data.cumPnL || 0) >= 0 ? '#10b981' : '#f43f5e', margin: '2px 0' }}>
                              Cumulative PnL: {(data.cumPnL || 0) >= 0 ? `+$${(data.cumPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(data.cumPnL || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            </p>
                          )}
                          {selectedChartMode === 'Cumulative Equity & Balance' && (
                            <>
                              <p style={{ fontWeight: 700, color: '#38bdf8', margin: '2px 0' }}>
                                Account Balance: ${data.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              <p style={{ fontWeight: 700, color: '#ffffff', margin: '2px 0' }}>
                                Account Equity: ${data.equity?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </>
                          )}
                          {data.symbol !== 'Initial Balance' && (
                            <p style={{ color: (data.pnl || 0) >= 0 ? 'var(--profit)' : 'var(--loss)', margin: '4px 0 0 0', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                              {data.tradeCount ? `Day PnL (${data.tradeCount} trade${data.tradeCount > 1 ? 's' : ''}): ` : 'Trade PnL: '}
                              {(data.pnl || 0) >= 0 ? `+$${(data.pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(data.pnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <ReferenceLine
                  y={selectedChartMode === 'TradePulse score' ? 65 : selectedChartMode === 'Net Realized PnL' ? 0 : INITIAL_BALANCE}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="3 3"
                />

                {selectedChartMode === 'TradePulse score' ? (
                  <Area type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={3} fill="url(#scoreColor)" dot={{ r: 4, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 1 }} name="Score" isAnimationActive={false} baseValue="dataMin" />
                ) : selectedChartMode === 'Net Realized PnL' ? (
                  <Area type="monotone" dataKey="cumPnL" stroke="#10b981" strokeWidth={3} fill="url(#pnlGradient)" dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1 }} name="Cumulative PnL" isAnimationActive={false} baseValue="dataMin" />
                ) : (
                  <>
                    <Area type="monotone" dataKey="balance" stroke="#38bdf8" strokeWidth={3} fill="url(#scoreColor)" dot={{ r: 4, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 1.5 }} name="Balance" isAnimationActive={false} baseValue="dataMin" />
                    <Area type="monotone" dataKey="equity" stroke="#ffffff" strokeWidth={2} strokeDasharray="4 4" fill="none" dot={{ r: 3, fill: '#ffffff' }} name="Equity" isAnimationActive={false} baseValue="dataMin" />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* SECTION 2: MIDDLE ROW 1 (3 SEMI-CIRCLE GAUGE CARDS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

        {/* Gauge 1: Short Analysis */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', margin: '0 0 14px 0' }}>
            Short Analysis
          </h4>
          {renderGauge(formatCurrency(shortStats.profit), 'Profit', shortStats.winRate, 'gaugeGradientShort')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Win ($)</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(shortStats.winVal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Win Rate</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {shortStats.winRate}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Loss ($)</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(shortStats.lossVal)}
              </div>
            </div>
          </div>
        </div>

        {/* Gauge 2: Profitability */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', margin: '0 0 14px 0' }}>
            Profitability
          </h4>
          {renderGauge(`${totalTradesCount}`, 'Total Trades', winPercent, 'gaugeGradientProf')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {winPercent}%
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Wins: {winsCount}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {lossPercent}%
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Losses: {lossesCount}</div>
            </div>
          </div>
        </div>

        {/* Gauge 3: Long Analysis */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: '#ffffff', margin: '0 0 14px 0' }}>
            Long Analysis
          </h4>
          {renderGauge(formatCurrency(longStats.profit), 'Profit', longStats.winRate, 'gaugeGradientLong')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Win ($)</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(longStats.winVal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Win Rate</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {longStats.winRate}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Loss ($)</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(longStats.lossVal)}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 3: DURATION ANALYSIS (SIDE-BY-SIDE GRID) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px' }}>



        {/* Right: PnL by Trade Duration Scatter Plot */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
            PnL by Trade Duration
          </h4>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="duration"
                  name="Duration"
                  stroke="var(--text-dim)"
                  fontSize={11}
                  domain={[0, Math.max(24, Math.ceil(maxDuration * 1.05))]}
                  tickFormatter={(val) => {
                    if (val === 0) return '0h';
                    if (val >= 24) {
                      const d = Math.round((val / 24) * 10) / 10;
                      return `${d}d`;
                    }
                    return `${val}h`;
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="pnl"
                  name="PnL"
                  stroke="var(--text-dim)"
                  fontSize={11}
                  domain={scatterYDomain}
                  tickFormatter={(val) => `$${val.toFixed(0)}`}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const pnlVal = Number(data.pnl) || 0;
                      const isProfit = pnlVal >= 0;
                      const hrs = Number(data.duration) || 0;
                      let formattedDuration = '';
                      if (hrs < 1) {
                        const mins = Math.round(hrs * 60);
                        formattedDuration = `${Math.max(1, mins)} min${mins === 1 ? '' : 's'}`;
                      } else if (hrs >= 24) {
                        formattedDuration = `${(hrs / 24).toFixed(1)} days (${hrs.toFixed(1)}h)`;
                      } else {
                        formattedDuration = `${hrs.toFixed(1)} hours`;
                      }

                      return (
                        <div style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.85)',
                          minWidth: '180px',
                          zIndex: 100
                        }}>
                          {data.symbol && (
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              marginBottom: '6px',
                              paddingBottom: '4px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span>{data.symbol}</span>
                              <span style={{ fontSize: '0.7rem', color: isProfit ? '#10b981' : '#f43f5e', background: isProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                {isProfit ? 'WIN' : 'LOSS'}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                              <span>Trade Duration:</span>
                              <strong style={{ color: '#ffffff' }}>{formattedDuration}</strong>
                            </div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '2px' }}>
                              <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>Net PnL:</span>
                              <span style={{ color: isProfit ? '#10b981' : '#f43f5e', fontFamily: 'var(--font-mono)' }}>
                                {isProfit ? `+$${pnlVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-$${Math.abs(pnlVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, index) => (
                    <Cell key={`scatter-cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} r={5} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* SECTION 4: INSTRUMENT METRICS (STACKED VERTICALLY WITH INCREASED HEIGHT) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Instrument Profit Analysis */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
            Instrument Profit Analysis
          </h4>
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instrumentProfitData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="symbol" stroke="var(--text-dim)" fontSize={11} interval={0} />
                <YAxis
                  stroke="var(--text-dim)"
                  fontSize={11}
                  domain={profitYDomain}
                  tickFormatter={(val) => val < 0 ? `-$${Math.abs(val).toFixed(2)}` : `$${val.toFixed(2)}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const profitVal = payload[0].value;
                      const isProfit = profitVal >= 0;
                      return (
                        <div style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.7)'
                        }}>
                          <p style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                            {label}
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: isProfit ? '#10b981' : '#f43f5e',
                            margin: 0,
                            fontFamily: 'var(--font-mono)'
                          }}>
                            Net Profit: {isProfit ? `+$${profitVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(profitVal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                <Bar dataKey="profit" maxBarSize={48}>
                  {instrumentProfitData.map((entry, index) => (
                    <Cell
                      key={`inst-pnl-${index}`}
                      fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'}
                      radius={entry.profit >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Instrument Volume Analysis */}
        <div className="glass-card" style={{ padding: '20px', background: '#0d111a' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: '0 0 16px 0' }}>
            Instrument Volume Analysis
          </h4>
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instrumentVolumeData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="symbol" stroke="var(--text-dim)" fontSize={11} interval={0} />
                <YAxis
                  stroke="var(--text-dim)"
                  fontSize={11}
                  domain={volumeYDomain}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const countVal = payload[0].value;
                      return (
                        <div style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.7)'
                        }}>
                          <p style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px 0' }}>
                            {label}
                          </p>
                          <p style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: '#10b981',
                            margin: 0,
                            fontFamily: 'var(--font-mono)'
                          }}>
                            Total Trades: {countVal}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="volume" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* TradePulse Score Calculation Breakdown Modal */}
      {isScoreModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '640px',
            background: '#0d111a',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            color: '#f8fafc',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', margin: 0 }}>
                TradePulse (Zella) Score Logic
              </h3>
              <X
                size={20}
                style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setIsScoreModalOpen(false)}
              />
            </div>

            <p style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '20px' }}>
              The TradePulse Score is a composite trading efficiency metric evaluated on a 0–100 scale across 6 performance & risk dimensions.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '20px' }}>
              {[
                { name: 'Consistency', weight: '20%', raw: scoreResult.rawMetrics.consistency, score: scoreResult.subScores.consistency, norm: 'Std dev of daily P&L variance' },
                { name: 'Max Drawdown', weight: '20%', raw: `${scoreResult.rawMetrics.maxDrawdownPercent}%`, score: scoreResult.subScores.maxDrawdown, norm: 'Inverted scale (0% DD = 100, >=50% = 0)' },
                { name: 'Win %', weight: '15%', raw: `${scoreResult.rawMetrics.winRate}%`, score: scoreResult.subScores.winRate, norm: 'Directly 0%–100% -> 0–100 score' },
                { name: 'Profit Factor', weight: '15%', raw: scoreResult.rawMetrics.profitFactor, score: scoreResult.subScores.profitFactor, norm: '0.0->0, 1.0->50, 2.0+->100' },
                { name: 'Avg Win / Loss', weight: '15%', raw: `${scoreResult.rawMetrics.avgWinLoss}:1`, score: scoreResult.subScores.avgWinLoss, norm: 'Target ratio 2:1 = 100 score' },
                { name: 'Recovery Factor', weight: '15%', raw: scoreResult.rawMetrics.recoveryFactor, score: scoreResult.subScores.recoveryFactor, norm: 'Net Profit / Max DD ($), target 3.0 = 100' }
              ].map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>{item.name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#38bdf8', marginLeft: '8px', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      Weight: {item.weight}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {item.norm}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                      Sub-Score: {item.score}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Raw: {item.raw}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Weighted Composite Formula</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                  TradePulse Score = ∑(Weight × SubScore)
                </div>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                {tradePulseScoreValue.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
