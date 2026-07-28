import React, { useState } from 'react';
import { Wallet, Edit3, X, TrendingUp, TrendingDown } from 'lucide-react';

export default function StatsCards({
  stats,
  selectedAccount = 'All Accounts',
  initialBalance = 10000,
  onUpdateInitialBalance
}) {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState(initialBalance.toString());

  if (!stats) return null;

  const {
    totalTrades = 51,
    closedCount = 51,
    totalPnL = -5632.27,
    winRate = 45.1,
    profitFactor = 0.54,
    avgWin = 283,
    avgLoss = 434,
    dayWinRate = 40.0,
    winsCount = 23,
    breakEvenCount = 0,
    lossesCount = 28,
    winDays = 6,
    neutralDays = 0,
    lossDays = 9,
    riskRewardRatio = 0.65
  } = stats;

  const isNetProfitable = totalPnL >= 0;
  const currentBalance = Math.round((initialBalance + totalPnL) * 100) / 100;
  const returnPercent = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;
  const isBalanceProfitable = currentBalance >= initialBalance;

  // Calculate SVG Semi-circle gauge path for Trade Win %
  const winPercentValue = Math.min(Math.max(winRate, 0), 100);
  const tradeWinArcDash = (winPercentValue / 100) * 126; // 126 is approx arc length for radius 40 semi-circle

  // Calculate SVG Semi-circle gauge path for Day Win %
  const dayWinPercentValue = Math.min(Math.max(dayWinRate, 0), 100);
  const dayWinArcDash = (dayWinPercentValue / 100) * 126;

  // Calculate SVG Donut stroke offset for Profit Factor
  // Map profit factor 0 to 3+ to 0-100% ring fill
  const pfRatio = Math.min(Math.max((profitFactor / 2.5) * 100, 5), 100);
  const donutStrokeDash = (pfRatio / 100) * 113; // circumference of radius 18 circle

  // Avg Win vs Avg Loss Ratio percentages for dual progress bar
  const totalAvg = (avgWin || 1) + (avgLoss || 1);
  const winBarPct = Math.min(Math.max(Math.round((avgWin / totalAvg) * 100), 15), 85);
  const lossBarPct = 100 - winBarPct;

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        
        {/* 0. Account Balance Card */}
        <div style={{
          background: 'linear-gradient(135deg, #161a23 0%, #12141a 100%)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.12)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                padding: '5px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Wallet size={16} color="#10b981" />
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e5e7eb' }}>Account Balance</span>
            </div>

            <button
              onClick={() => {
                setTempBalance(initialBalance.toString());
                setIsEditingBalance(true);
              }}
              title="Edit Initial Balance"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#9ca3af',
                borderRadius: '6px',
                padding: '4px 7px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Edit3 size={13} color="#10b981" />
              <span>Edit</span>
            </button>
          </div>

          <div style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#ffffff',
            fontFamily: 'var(--font-mono)',
            marginTop: '12px',
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px'
          }}>
            <span>${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          {/* Pill breakdown & return percentage */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
            <span style={{ fontSize: '0.72rem', color: '#8c93a6', fontWeight: 600 }}>
              Start: <strong style={{ color: '#d1d5db' }}>${initialBalance.toLocaleString('en-US')}</strong>
            </span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              background: isBalanceProfitable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              color: isBalanceProfitable ? '#10b981' : '#f43f5e',
              border: `1px solid ${isBalanceProfitable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '10px'
            }}>
              {isBalanceProfitable ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{returnPercent >= 0 ? `+${returnPercent.toFixed(1)}%` : `${returnPercent.toFixed(1)}%`}</span>
            </div>
          </div>
        </div>

        {/* 1. Net P&L Card */}
        <div style={{
          background: '#16171d',
          border: '1px solid #252833',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8c93a6' }}>Net P&L</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#5b6173' }}>{totalTrades}</span>
          </div>
          <div style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: isNetProfitable ? '#10b981' : '#f43f5e',
            fontFamily: 'var(--font-mono)',
            marginTop: '12px',
            letterSpacing: '-0.03em'
          }}>
            {totalPnL >= 0 ? `+$${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
        </div>

        {/* 2. Trade win % Card */}
        <div style={{
          background: '#16171d',
          border: '1px solid #252833',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8c93a6', marginBottom: '8px' }}>Trade win %</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
                {winRate.toFixed(1)}%
              </div>
            </div>

            {/* SVG Semi-Circle Arc Gauge */}
            <div style={{ width: '48px', height: '32px', position: 'relative' }}>
              <svg width="48" height="32" viewBox="0 0 50 32" style={{ overflow: 'visible' }}>
                {/* Background Arc */}
                <path
                  d="M 5 30 A 20 20 0 0 1 45 30"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                {/* Foreground Green Win Arc */}
                <path
                  d="M 5 30 A 20 20 0 0 1 45 30"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="5"
                  strokeDasharray={`${tradeWinArcDash} 126`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Pill Breakdown badges */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
            <span style={{ background: '#0d281e', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
              {winsCount}
            </span>
            <span style={{ background: '#1c2230', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
              {breakEvenCount}
            </span>
            <span style={{ background: '#2c151c', color: '#f43f5e', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
              {lossesCount}
            </span>
          </div>
        </div>

        {/* 3. Profit factor Card */}
        <div style={{
          background: '#16171d',
          border: '1px solid #252833',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8c93a6', marginBottom: '8px' }}>Profit factor</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
                {profitFactor.toFixed(2)}
              </div>
            </div>

            {/* SVG Donut / Ring Gauge */}
            <div style={{ width: '36px', height: '36px', position: 'relative' }}>
              <svg width="36" height="36" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="none" stroke="#252833" strokeWidth="4" />
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  fill="none"
                  stroke={profitFactor >= 1.0 ? '#10b981' : '#f43f5e'}
                  strokeWidth="4"
                  strokeDasharray={`${donutStrokeDash} 113`}
                  strokeDashoffset="0"
                  transform="rotate(-90 20 20)"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
          <div style={{ height: '22px' }} />
        </div>

        {/* 4. Day win % Card */}
        <div style={{
          background: '#16171d',
          border: '1px solid #252833',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8c93a6', marginBottom: '8px' }}>Day win %</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
                {dayWinRate.toFixed(1)}%
              </div>
            </div>

            {/* SVG Semi-Circle Arc Gauge */}
            <div style={{ width: '48px', height: '32px', position: 'relative' }}>
              <svg width="48" height="32" viewBox="0 0 50 32" style={{ overflow: 'visible' }}>
                <path
                  d="M 5 30 A 20 20 0 0 1 45 30"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M 5 30 A 20 20 0 0 1 45 30"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="5"
                  strokeDasharray={`${dayWinArcDash} 126`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Pill Breakdown badges */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
            <span style={{ background: '#0d281e', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
              {winDays}
            </span>
            <span style={{ background: '#1c2230', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
              {neutralDays}
            </span>
            <span style={{ background: '#2c151c', color: '#f43f5e', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
              {lossDays}
            </span>
          </div>
        </div>

        {/* 5. Avg win/loss trade Card */}
        <div style={{
          background: '#16171d',
          border: '1px solid #252833',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#8c93a6', marginBottom: '8px' }}>Avg win/loss trade</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
              {riskRewardRatio ? riskRewardRatio.toFixed(2) : (avgWin && avgLoss ? (avgWin / avgLoss).toFixed(2) : '0.65')}
            </div>
          </div>

          {/* Dual Progress / Ratio bar ($283 green vs -$434 red) */}
          <div style={{ marginTop: '14px' }}>
            <div style={{
              height: '8px',
              borderRadius: '4px',
              overflow: 'hidden',
              display: 'flex',
              width: '100%',
              background: '#252833'
            }}>
              <div style={{ width: `${winBarPct}%`, background: '#10b981', height: '100%' }} />
              <div style={{ width: `${lossBarPct}%`, background: '#f43f5e', height: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#10b981' }}>${Math.round(avgWin)}</span>
              <span style={{ color: '#f43f5e' }}>-${Math.round(avgLoss)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Edit Initial Balance Modal */}
      {isEditingBalance && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} color="#10b981" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Set Starting Balance
                </h3>
              </div>
              <button onClick={() => setIsEditingBalance(false)} className="btn btn-secondary" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: '14px' }}>
              Enter initial starting capital for <strong style={{ color: '#ffffff' }}>"{selectedAccount}"</strong>:
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (onUpdateInitialBalance) onUpdateInitialBalance(tempBalance);
              setIsEditingBalance(false);
            }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#8b92a5', marginBottom: '6px' }}>
                  INITIAL BALANCE ($)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#10b981', fontWeight: 800 }}>$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={tempBalance}
                    onChange={(e) => setTempBalance(e.target.value)}
                    placeholder="10000"
                    autoFocus
                    style={{
                      width: '100%',
                      background: '#111215',
                      border: '1px solid #282b36',
                      borderRadius: '8px',
                      padding: '10px 12px 10px 28px',
                      color: '#ffffff',
                      fontSize: '1rem',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsEditingBalance(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '8px 18px', fontWeight: 700 }}
                >
                  Save Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
