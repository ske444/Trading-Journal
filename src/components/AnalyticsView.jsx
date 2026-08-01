import React, { useState, useMemo } from 'react';
import { demoDailySeries } from '../constants/analyticsDefaults.js';
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
import bearImg from '../assets/bear_bias.png';
import bullImg from '../assets/bull_bias.png';

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
              stroke="var(--chart-grid)"
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
              stroke="var(--chart-grid)"
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
              stroke="var(--bg-card)"
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
              fill="var(--chart-text)"
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
  const [selectedChartMode, setSelectedChartMode] = useState('Net Realized PnL');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [dailyPnlPeriod, setDailyPnlPeriod] = useState('ALL');

  // Compute TradePulse (Zella) Score and Sub-scores
  const scoreResult = computeTradePulseScore(trades, stats, initialBalance);
  const tradePulseScoreValue = scoreResult.finalScore;

  // Growth Curve Data & Score history over time
  const INITIAL_BALANCE = Number(initialBalance) || 10000;

  const closedTrades = useMemo(() => (trades || []).filter(t => t.status !== 'OPEN'), [trades]);
  const sortedClosedTrades = useMemo(() => {
    return [...closedTrades].sort((a, b) => {
      const dA = new Date(a.exit_date || a.entry_date || 0).getTime();
      const dB = new Date(b.exit_date || b.entry_date || 0).getTime();
      return dA - dB || a.id - b.id;
    });
  }, [closedTrades]);

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

  // Behavioral Bias calculations (Bull / Long Bias vs Bear / Short Bias)
  const rawLongCount = longStats?.total || 0;
  const rawShortCount = shortStats?.total || 0;
  const hasSideData = (rawLongCount + rawShortCount) > 0;

  const displayLongCount = hasSideData ? rawLongCount : 0;
  const displayShortCount = hasSideData ? rawShortCount : 0;
  const totalBiasCount = displayLongCount + displayShortCount;

  const bullPercent = totalBiasCount > 0 ? Math.round((displayLongCount / totalBiasCount) * 100) : 0;
  const bearPercent = totalBiasCount > 0 ? (100 - bullPercent) : 0;

  const isBearDominant = bearPercent > bullPercent;
  const biasImage = isBearDominant ? bearImg : bullImg;

  // Helper for Net PnL formatting on Trading Day Performance component
  const formatNetPnlLabel = (val) => {
    const num = Number(val) || 0;
    const abs = Math.abs(num);
    let str = '';
    if (abs >= 1000000) {
      str = `$${(abs / 1000000).toFixed(1)}M`;
    } else if (abs >= 1000) {
      const kVal = (abs / 1000).toFixed(1);
      str = `$${kVal.endsWith('.0') ? kVal.slice(0, -2) : kVal}k`;
    } else {
      str = `$${Math.round(abs)}`;
    }
    return num < 0 ? `-${str}` : str;
  };

  // Trading Day Performance data (Wins & Losses aggregated by day of week)
  const dayPerformanceData = useMemo(() => {
    const daysOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayMap = {
      Mon: { day: 'Mon', dayIdx: 1, wins: 0, losses: 0, winPnL: 0, lossPnL: 0, netPnL: 0, tradeCount: 0 },
      Tue: { day: 'Tue', dayIdx: 2, wins: 0, losses: 0, winPnL: 0, lossPnL: 0, netPnL: 0, tradeCount: 0 },
      Wed: { day: 'Wed', dayIdx: 3, wins: 0, losses: 0, winPnL: 0, lossPnL: 0, netPnL: 0, tradeCount: 0 },
      Thu: { day: 'Thu', dayIdx: 4, wins: 0, losses: 0, winPnL: 0, lossPnL: 0, netPnL: 0, tradeCount: 0 },
      Fri: { day: 'Fri', dayIdx: 5, wins: 0, losses: 0, winPnL: 0, lossPnL: 0, netPnL: 0, tradeCount: 0 },
    };

    if (closedTrades && closedTrades.length > 0) {
      closedTrades.forEach((t) => {
        const rawDateStr = t.exit_date || t.entry_date;
        if (!rawDateStr) return;
        const d = new Date(rawDateStr);
        if (isNaN(d.getTime())) return;
        const jsDay = d.getDay(); // 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
        let key = null;
        if (jsDay === 1) key = 'Mon';
        else if (jsDay === 2) key = 'Tue';
        else if (jsDay === 3) key = 'Wed';
        else if (jsDay === 4) key = 'Thu';
        else if (jsDay === 5) key = 'Fri';

        if (key && dayMap[key]) {
          const pnlVal = Number(t.pnl) || 0;
          dayMap[key].tradeCount += 1;
          if (pnlVal > 0 || t.status === 'WIN') {
            dayMap[key].wins += 1;
            dayMap[key].winPnL += pnlVal;
          } else if (pnlVal < 0 || t.status === 'LOSS') {
            dayMap[key].losses += 1;
            dayMap[key].lossPnL += Math.abs(pnlVal);
          }
          dayMap[key].netPnL += pnlVal;
        }
      });

      const dayList = daysOrder.map(dKey => dayMap[dKey]);

      let best = dayList[0];
      dayList.forEach(item => {
        if (item.netPnL > best.netPnL) {
          best = item;
        }
      });

      return {
        days: dayList,
        bestDay: best ? best.day : 'Thu'
      };
    }

    // Reference fallback demo dataset matching user's reference image
    const fallbackDays = [
      { day: 'Mon', wins: 2, losses: 3, winPnL: 2000, lossPnL: 5300, netPnL: -3300, tradeCount: 5 },
      { day: 'Tue', wins: 2, losses: 3, winPnL: 2200, lossPnL: 5300, netPnL: -3100, tradeCount: 5 },
      { day: 'Wed', wins: 3, losses: 2, winPnL: 3500, lossPnL: 4467, netPnL: -967, tradeCount: 5 },
      { day: 'Thu', wins: 3, losses: 2, winPnL: 3000, lossPnL: 4400, netPnL: -1400, tradeCount: 5 },
      { day: 'Fri', wins: 2, losses: 1, winPnL: 2000, lossPnL: 1538, netPnL: 462, tradeCount: 3 },
    ];

    return {
      days: fallbackDays,
      bestDay: 'Thu'
    };
  }, [closedTrades]);

  // Session Win Rates calculation (New York, London, Asia)
  const sessionWinRatesData = useMemo(() => {
    const sessions = {
      'New York': { name: 'New York', wins: 0, total: 0, defaultRate: 37.0 },
      'London': { name: 'London', wins: 0, total: 0, defaultRate: 27.3 },
      'Asia': { name: 'Asia', wins: 0, total: 0, defaultRate: 21.6 },
    };

    if (closedTrades && closedTrades.length > 0) {
      closedTrades.forEach((t) => {
        let matchedSession = null;
        const sLower = String(t.session || '').toLowerCase();

        if (sLower.includes('new york') || sLower.includes('ny')) {
          matchedSession = 'New York';
        } else if (sLower.includes('london')) {
          matchedSession = 'London';
        } else if (sLower.includes('asia') || sLower.includes('tokyo') || sLower.includes('sydney')) {
          matchedSession = 'Asia';
        } else {
          const rawDateStr = t.entry_date || t.exit_date;
          if (rawDateStr) {
            const d = new Date(rawDateStr);
            if (!isNaN(d.getTime())) {
              const hr = d.getUTCHours();
              if (hr >= 13 && hr < 21) {
                matchedSession = 'New York';
              } else if (hr >= 7 && hr < 16) {
                matchedSession = 'London';
              } else {
                matchedSession = 'Asia';
              }
            }
          }
        }

        if (matchedSession && sessions[matchedSession]) {
          const pnlVal = Number(t.pnl) || 0;
          sessions[matchedSession].total += 1;
          if (pnlVal > 0 || t.status === 'WIN') {
            sessions[matchedSession].wins += 1;
          }
        }
      });
    }

    return [
      {
        name: 'New York',
        winRate: sessions['New York'].total > 0
          ? Math.round((sessions['New York'].wins / sessions['New York'].total) * 1000) / 10
          : sessions['New York'].defaultRate,
        trades: sessions['New York'].total
      },
      {
        name: 'London',
        winRate: sessions['London'].total > 0
          ? Math.round((sessions['London'].wins / sessions['London'].total) * 1000) / 10
          : sessions['London'].defaultRate,
        trades: sessions['London'].total
      },
      {
        name: 'Asia',
        winRate: sessions['Asia'].total > 0
          ? Math.round((sessions['Asia'].wins / sessions['Asia'].total) * 1000) / 10
          : sessions['Asia'].defaultRate,
        trades: sessions['Asia'].total
      }
    ];
  }, [closedTrades]);




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

  // Aggregate Daily PnL Data
  const rawDailyPnlData = useMemo(() => {
    if (sortedClosedTrades && sortedClosedTrades.length > 0) {
      const dailyMap = {};
      sortedClosedTrades.forEach(t => {
        const rawD = (t.exit_date || t.entry_date || '').split('T')[0];
        if (!rawD) return;
        if (!dailyMap[rawD]) {
          dailyMap[rawD] = { rawDate: rawD, pnl: 0, tradeCount: 0 };
        }
        dailyMap[rawD].pnl += (Number(t.pnl) || 0);
        dailyMap[rawD].tradeCount += 1;
      });

      const dates = Object.keys(dailyMap).sort();
      if (dates.length > 0) {
        return dates.map(dKey => {
          const parts = dKey.split('-');
          const formattedDate = parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0].slice(2)}` : dKey;
          return {
            rawDate: dKey,
            date: formattedDate,
            pnl: Math.round(dailyMap[dKey].pnl * 100) / 100,
            tradeCount: dailyMap[dKey].tradeCount
          };
        });
      }
    }
    return demoDailySeries;
  }, [sortedClosedTrades]);

  // Filter daily dataset based on time period selector
  const filteredDailyPnlData = useMemo(() => {
    if (!rawDailyPnlData || rawDailyPnlData.length === 0) return [];
    if (dailyPnlPeriod === 'ALL') return rawDailyPnlData;

    const lastItem = rawDailyPnlData[rawDailyPnlData.length - 1];
    const lastDateMs = new Date(lastItem.rawDate).getTime();
    if (isNaN(lastDateMs)) return rawDailyPnlData;

    let daysToCut = 30;
    if (dailyPnlPeriod === '7D') daysToCut = 7;
    else if (dailyPnlPeriod === '30D') daysToCut = 30;
    else if (dailyPnlPeriod === '3M') daysToCut = 90;
    else if (dailyPnlPeriod === '6M') daysToCut = 180;
    else if (dailyPnlPeriod === '1Y') daysToCut = 365;

    const cutoffMs = lastDateMs - (daysToCut * 24 * 60 * 60 * 1000);
    const filtered = rawDailyPnlData.filter(d => new Date(d.rawDate).getTime() >= cutoffMs);
    return filtered.length > 0 ? filtered : rawDailyPnlData;
  }, [rawDailyPnlData, dailyPnlPeriod]);

  // Calculate Y-axis Domain dynamically for Daily PnL
  const dailyPnlYDomain = useMemo(() => {
    if (!filteredDailyPnlData || filteredDailyPnlData.length === 0) return [-200000, 200000];
    const pnlVals = filteredDailyPnlData.map(d => d.pnl);
    const minVal = Math.min(...pnlVals, 0);
    const maxVal = Math.max(...pnlVals, 0);
    const absMax = Math.max(Math.abs(minVal), Math.abs(maxVal));
    const span = absMax || 50000;
    const padding = Math.ceil(span * 0.12);
    const limit = Math.ceil((absMax + padding) / 10000) * 10000;
    return [-limit, limit];
  }, [filteredDailyPnlData]);

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
            stroke="var(--border-color)"
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
          <circle cx={dotX} cy={dotY} r="6" fill="var(--bg-card)" stroke={dotStroke} strokeWidth="2.5" />
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
          <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--font-mono)' }}>
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
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-heading)', margin: 0, textTransform: 'uppercase' }}>
          ANALYSIS
        </h2>
      </div>

      {/* SECTION: BEHAVIORAL BIAS */}
      <div>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginBottom: '8px',
          textTransform: 'uppercase'
        }}>
          BEHAVIORAL BIAS
        </div>

        <div className="glass-card" style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          minHeight: '210px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          {/* Left Image Side */}
          <div style={{
            width: '38%',
            minWidth: '240px',
            position: 'relative',
            background: `url(${biasImage}) center/cover no-repeat`,
            borderTopLeftRadius: '12px',
            borderBottomLeftRadius: '12px'
          }}>
            {/* Smooth Edge Gradient Overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, rgba(9, 13, 22, 0) 30%, rgba(9, 13, 22, 0.7) 70%, var(--bg-card) 100%)'
            }} />
          </div>

          {/* Right Metrics Side */}
          <div style={{
            flex: 1,
            padding: '24px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {/* Top Stat Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              {/* Bull Stat */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{
                  fontSize: '3.6rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: bullPercent >= bearPercent ? 'var(--text-heading)' : 'var(--text-muted)',
                  lineHeight: 1
                }}>
                  {bullPercent}%
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>Bull</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: bullPercent >= bearPercent ? 'var(--text-heading)' : 'var(--text-muted)', lineHeight: 1.2 }}>Long Bias</span>
                </div>
              </div>

              {/* Slash Separator */}
              <div style={{
                fontSize: '2.4rem',
                fontWeight: 300,
                color: 'var(--text-muted)',
                opacity: 0.4,
                fontStyle: 'italic',
                padding: '0 16px'
              }}>
                /
              </div>

              {/* Bear Stat */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>Bear</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: bearPercent > bullPercent ? 'var(--text-heading)' : 'var(--text-muted)', lineHeight: 1.2 }}>Short Bias</span>
                </div>
                <span style={{
                  fontSize: '3.6rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: bearPercent > bullPercent ? 'var(--text-heading)' : 'var(--text-muted)',
                  lineHeight: 1
                }}>
                  {bearPercent}%
                </span>
              </div>
            </div>

            {/* Ratio Progress Bar */}
            <div style={{
              height: '7px',
              width: '100%',
              background: 'var(--border-color)',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
              marginBottom: '10px'
            }}>
              <div style={{
                width: `${bullPercent}%`,
                background: '#1d4ed8',
                borderRadius: bearPercent === 0 ? '4px' : '4px 0 0 4px',
                transition: 'width 0.4s ease'
              }} />
              <div style={{
                width: `${bearPercent}%`,
                background: 'var(--text-dim, #64748b)',
                borderRadius: bullPercent === 0 ? '4px' : '0 4px 4px 0',
                transition: 'width 0.4s ease'
              }} />
            </div>

            {/* Counts Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono, monospace)',
              color: 'var(--text-muted)'
            }}>
              <span>{displayLongCount}</span>
              <span>{displayShortCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: PERFORMANCE METRICS (SESSION WIN RATES & TRADING DAY PERFORMANCE) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '20px'
      }}>
        {/* Session Win Rates Card */}
        <div className="glass-card" style={{
          padding: '24px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '16px',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text-heading)',
              margin: 0,
              fontFamily: 'var(--font-sans, system-ui)'
            }}>
              Session Win Rates
            </h3>
          </div>

          {/* Sessions List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1
          }}>
            {sessionWinRatesData.map((session, index) => (
              <React.Fragment key={session.name}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  paddingTop: index === 0 ? '6px' : '22px',
                  paddingBottom: index === sessionWinRatesData.length - 1 ? '6px' : '22px'
                }}>
                  {/* Session Name */}
                  <div style={{
                    width: '95px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--text-heading)',
                    fontFamily: 'var(--font-sans, system-ui)',
                    whiteSpace: 'nowrap'
                  }}>
                    {session.name}
                  </div>

                  {/* Progress Track */}
                  <div style={{
                    flex: 1,
                    height: '14px',
                    background: 'var(--bg-input)',
                    borderRadius: '9999px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Fill Bar */}
                    <div style={{
                      width: `${Math.min(100, Math.max(0, session.winRate))}%`,
                      height: '100%',
                      background: '#2563eb',
                      borderRadius: '9999px',
                      position: 'relative',
                      transition: 'width 0.4s ease'
                    }}>
                      {/* Black Dot Indicator at Tip of Blue Fill */}
                      <div style={{
                        position: 'absolute',
                        right: '4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#000000',
                        boxShadow: '0 0 2px rgba(0,0,0,0.6)'
                      }} />
                    </div>
                  </div>

                  {/* Percentage Value */}
                  <div style={{
                    width: '60px',
                    textAlign: 'right',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-heading)'
                  }}>
                    {session.winRate.toFixed(1)}%
                  </div>
                </div>

                {/* Divider Line */}
                {index < sessionWinRatesData.length - 1 && (
                  <div style={{
                    height: '1px',
                    background: 'var(--border-color)',
                    width: '100%'
                  }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Trading Day Performance Card */}
        <div className="glass-card" style={{
          padding: '24px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text-heading)',
              margin: 0,
              fontFamily: 'var(--font-sans, system-ui)'
            }}>
              Trading Day Performance
            </h3>
            <div style={{ fontSize: '0.92rem', color: 'var(--text-muted, #9ca3af)', fontFamily: 'var(--font-sans, system-ui)' }}>
              Best Day: <strong style={{ color: 'var(--text-heading)', fontWeight: 800 }}>{dayPerformanceData.bestDay}</strong>
            </div>
          </div>

          {/* Bar Chart Grid */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-end',
            minHeight: '210px',
            paddingTop: '16px',
            paddingBottom: '8px'
          }}>
            {dayPerformanceData.days.map((dItem) => {
              const maxPnLInChart = Math.max(
                ...dayPerformanceData.days.flatMap(d => [d.winPnL, d.lossPnL]),
                1000
              );

              const winHeightPx = Math.max(24, Math.round((dItem.winPnL / maxPnLInChart) * 120));
              const lossHeightPx = Math.max(24, Math.round((dItem.lossPnL / maxPnLInChart) * 120));

              return (
                <div
                  key={dItem.day}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    width: '18%',
                    maxWidth: '110px'
                  }}
                >
                  {/* Win & Loss Bars */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    height: '130px',
                    justifyContent: 'center'
                  }}>
                    {/* Win Bar (Green) */}
                    <div
                      title={`${dItem.day} Wins: ${formatCurrency(dItem.winPnL)} (${dItem.wins} trades)`}
                      style={{
                        width: '28px',
                        height: `${winHeightPx}px`,
                        background: '#10b981',
                        borderRadius: '12px',
                        transition: 'height 0.3s ease, transform 0.2s ease',
                        cursor: 'pointer'
                      }}
                    />

                    {/* Loss Bar (Red) */}
                    <div
                      title={`${dItem.day} Losses: ${formatCurrency(dItem.lossPnL)} (${dItem.losses} trades)`}
                      style={{
                        width: '28px',
                        height: `${lossHeightPx}px`,
                        background: '#ef4444',
                        borderRadius: '12px',
                        transition: 'height 0.3s ease, transform 0.2s ease',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {/* Net PnL & Day Label */}
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono, monospace)',
                      color: 'var(--text-main, #ffffff)'
                    }}>
                      {formatNetPnlLabel(dItem.netPnL)}
                    </span>
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: 'var(--text-muted, #9ca3af)'
                    }}>
                      {dItem.day}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 1: TOP ROW (RADAR CHART & SCORE LINE CHART) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>

        {/* Card 1: TradePulse Score Radar Chart */}
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-heading)' }}>TradePulse score</span>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Your TradePulse score:</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--font-mono)' }}>
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
                  background: 'var(--bg-card)',
                  border: '2px solid #0284c7',
                  boxShadow: '0 0 6px rgba(0,0,0,0.4)',
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
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', position: 'relative', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            {/* Mode Selector Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-secondary)',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-heading)'
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
                  background: 'var(--bg-modal)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 20,
                  width: '230px',
                  overflow: 'hidden'
                }}>
                  {['Net Realized PnL', 'TradePulse score'].map((mode) => (
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="date" stroke="var(--chart-text)" fontSize={11} />

                {selectedChartMode === 'TradePulse score' ? (
                  <YAxis stroke="var(--chart-text)" fontSize={11} domain={[0, 100]} width={55} />
                ) : (
                  <YAxis
                    stroke="var(--chart-text)"
                    fontSize={11}
                    domain={pnlYDomain}
                    width={75}
                    tickFormatter={(val) => {
                      if (typeof val !== 'number' || isNaN(val)) return '$0';
                      return `${val >= 0 ? '+' : ''}$${Math.round(val).toLocaleString()}`;
                    }}
                  />
                )}

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: 'var(--chart-tooltip-bg)', color: 'var(--chart-tooltip-text)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', boxShadow: 'var(--shadow-md)' }}>
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
                  y={selectedChartMode === 'TradePulse score' ? 65 : 0}
                  stroke="var(--chart-grid)"
                  strokeDasharray="3 3"
                />

                {selectedChartMode === 'TradePulse score' ? (
                  <Area type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={3} fill="url(#scoreColor)" dot={{ r: 4, fill: '#38bdf8', stroke: 'var(--bg-card)', strokeWidth: 1 }} name="Score" isAnimationActive={false} baseValue="dataMin" />
                ) : (
                  <Area type="monotone" dataKey="cumPnL" stroke="#10b981" strokeWidth={3} fill="url(#pnlGradient)" dot={{ r: 4, fill: '#10b981', stroke: 'var(--bg-card)', strokeWidth: 1 }} name="Cumulative PnL" isAnimationActive={false} baseValue="dataMin" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* SECTION 2: MIDDLE ROW 1 (3 SEMI-CIRCLE GAUGE CARDS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

        {/* Gauge 1: Short Analysis */}
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 14px 0' }}>
            Short Analysis
          </h4>
          {renderGauge(formatCurrency(shortStats.profit), 'Profit', shortStats.winRate, 'gaugeGradientShort')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
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
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 14px 0' }}>
            Profitability
          </h4>
          {renderGauge(`${totalTradesCount}`, 'Total Trades', winPercent, 'gaugeGradientProf')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
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
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 14px 0' }}>
            Long Analysis
          </h4>
          {renderGauge(formatCurrency(longStats.profit), 'Profit', longStats.winRate, 'gaugeGradientLong')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
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

      </div>      {/* SECTION 3: NET DAILY PNL & DURATION ANALYSIS (SIDE-BY-SIDE GRID) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>

        {/* Left: Net Daily P&L */}
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
                Net daily P&L
              </h4>
              <Info
                size={15}
                style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                title="Net profit/loss generated per trading day"
              />
            </div>

            {/* Time Period Selector Pills */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {['7D', '30D', '3M', '6M', '1Y', 'ALL'].map((period) => (
                <button
                  key={period}
                  onClick={() => setDailyPnlPeriod(period)}
                  style={{
                    background: dailyPnlPeriod === period ? '#1d4ed8' : 'transparent',
                    color: dailyPnlPeriod === period ? '#ffffff' : 'var(--text-muted)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredDailyPnlData} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--chart-text)" fontSize={11} interval="preserveStartEnd" minTickGap={25} />
                <YAxis
                  stroke="var(--chart-text)"
                  fontSize={11}
                  domain={dailyPnlYDomain}
                  tickFormatter={(val) => {
                    if (val === 0) return '$0';
                    const absVal = Math.abs(val);
                    const formatted = absVal >= 1000 ? `$${(absVal / 1000).toFixed(0)}k` : `$${absVal}`;
                    return val < 0 ? `-${formatted}` : formatted;
                  }}
                  width={65}
                />
                <Tooltip
                  cursor={{ fill: 'var(--bg-card-hover)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const pnlVal = Number(data.pnl) || 0;
                      const isProf = pnlVal >= 0;
                      return (
                        <div style={{
                          background: 'var(--chart-tooltip-bg)',
                          color: 'var(--chart-tooltip-text)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          boxShadow: 'var(--shadow-md)',
                          minWidth: '160px'
                        }}>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>
                            Date: {data.date}
                          </p>
                          <p style={{
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            color: isProf ? '#10b981' : '#f43f5e',
                            margin: '2px 0',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            Net P&L: {isProf ? `+$${pnlVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `-$${Math.abs(pnlVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </p>
                          {data.tradeCount > 0 && (
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                              Trades: {data.tradeCount}
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <Bar dataKey="pnl" maxBarSize={32}>
                  {filteredDailyPnlData.map((entry, index) => (
                    <Cell
                      key={`daily-pnl-cell-${index}`}
                      fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'}
                      radius={entry.pnl >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: PnL by Trade Duration Scatter Plot */}
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 16px 0' }}>
            PnL by Trade Duration
          </h4>
          <div style={{ width: '100%', height: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  type="number"
                  dataKey="duration"
                  name="Duration"
                  stroke="var(--chart-text)"
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
                  stroke="var(--chart-text)"
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
                          background: 'var(--chart-tooltip-bg)',
                          color: 'var(--chart-tooltip-text)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '12px 16px',
                          boxShadow: 'var(--shadow-md)',
                          minWidth: '180px',
                          zIndex: 100
                        }}>
                          {data.symbol && (
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 800,
                              color: 'var(--text-heading)',
                              marginBottom: '6px',
                              paddingBottom: '4px',
                              borderBottom: '1px solid var(--border-color)',
                              display: 'flex',
                              justify: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span>{data.symbol}</span>
                              <span style={{ fontSize: '0.7rem', color: isProfit ? '#10b981' : '#f43f5e', background: isProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                {isProfit ? 'WIN' : 'LOSS'}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                              <span>Trade Duration:</span>
                              <strong style={{ color: 'var(--text-heading)' }}>{formattedDuration}</strong>
                            </div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '2px' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>Net PnL:</span>
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
                <ReferenceLine y={0} stroke="var(--chart-grid)" strokeDasharray="3 3" />
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
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 16px 0' }}>
            Instrument Profit Analysis
          </h4>
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instrumentProfitData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="symbol" stroke="var(--chart-text)" fontSize={11} interval={0} />
                <YAxis
                  stroke="var(--chart-text)"
                  fontSize={11}
                  domain={profitYDomain}
                  tickFormatter={(val) => val < 0 ? `-$${Math.abs(val).toFixed(2)}` : `$${val.toFixed(2)}`}
                />
                <Tooltip
                  cursor={{ fill: 'var(--bg-card-hover)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const profitVal = payload[0].value;
                      const isProfit = profitVal >= 0;
                      return (
                        <div style={{
                          background: 'var(--chart-tooltip-bg)',
                          color: 'var(--chart-tooltip-text)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          boxShadow: 'var(--shadow-md)'
                        }}>
                          <p style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px 0' }}>
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
                <ReferenceLine y={0} stroke="var(--chart-grid)" strokeDasharray="3 3" />
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
        <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', transition: 'background 0.3s ease, border-color 0.3s ease' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 16px 0' }}>
            Instrument Volume Analysis
          </h4>
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={instrumentVolumeData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="symbol" stroke="var(--chart-text)" fontSize={11} interval={0} />
                <YAxis
                  stroke="var(--chart-text)"
                  fontSize={11}
                  domain={volumeYDomain}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--bg-card-hover)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const countVal = payload[0].value;
                      return (
                        <div style={{
                          background: 'var(--chart-tooltip-bg)',
                          color: 'var(--chart-tooltip-text)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          boxShadow: 'var(--shadow-md)'
                        }}>
                          <p style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-heading)', margin: '0 0 4px 0' }}>
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
          background: 'rgba(0,0,0,0.6)',
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
            background: 'var(--bg-modal)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            color: 'var(--text-main)',
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
