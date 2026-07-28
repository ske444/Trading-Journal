import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, ChevronRight as ToggleRight, Calendar as CalendarIcon } from 'lucide-react';

export default function CalendarView({ dailyPnLMap = {}, onSelectDate }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026 as in sketch
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Days in current month
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Money formatter with floating point rounding fix
  const formatMoney = (val, compact = false) => {
    const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
    if (rounded === 0) return '$0';
    const absVal = Math.abs(rounded);

    if (compact && absVal >= 1000) {
      const inK = (absVal / 1000).toFixed(2).replace(/\.00$/, '');
      return rounded < 0 ? `-$${inK}K` : `$${inK}K`;
    }

    const formattedNum = absVal.toLocaleString('en-US', {
      minimumFractionDigits: absVal % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });

    return rounded < 0 ? `-$${formattedNum}` : `$${formattedNum}`;
  };

  // Build weekly rows and total P&L for each week
  const totalDays = firstDayOfMonth + daysInMonth;
  const numWeeks = Math.ceil(totalDays / 7);

  const weeks = [];

  for (let w = 0; w < numWeeks; w++) {
    const weekDays = [];
    let weekPnL = 0;
    let daysCount = 0;
    let tradesCount = 0;
    let winsCount = 0;

    for (let d = 0; d < 7; d++) {
      const cellIndex = w * 7 + d;
      const dayNum = cellIndex - firstDayOfMonth + 1;

      if (dayNum < 1 || dayNum > daysInMonth) {
        weekDays.push({
          key: `empty-${cellIndex}`,
          isEmpty: true
        });
      } else {
        const formattedDay = String(dayNum).padStart(2, '0');
        const formattedMonth = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

        const dayData = dailyPnLMap[dateStr] || null;
        const pnl = dayData ? dayData.pnl : 0;
        const count = dayData ? dayData.count : 0;
        const winRate = dayData ? dayData.winRate : 0;
        const hasNotes = dayData ? dayData.hasNotes : false;

        if (dayData && (dayData.count > 0 || dayData.pnl !== 0)) {
          weekPnL += (dayData.pnl || 0);
          if (dayData.count > 0) {
            daysCount += 1;
            tradesCount += dayData.count;
          }
          if (dayData.wins) winsCount += dayData.wins;
        }

        weekDays.push({
          key: dateStr,
          dateStr,
          dayNumber: dayNum,
          pnl,
          count,
          winRate,
          hasNotes,
          isEmpty: false
        });
      }
    }

    weekPnL = Math.round((weekPnL + Number.EPSILON) * 100) / 100;
    const weekWinRate = tradesCount > 0 ? Math.round((winsCount / tradesCount) * 1000) / 10 : 0;

    weeks.push({
      weekNumber: w + 1,
      label: `Week ${w + 1}`,
      weekPnL,
      daysCount,
      tradesCount,
      winRate: weekWinRate,
      days: weekDays
    });
  }

  return (
    <div style={{
      marginBottom: '24px',
      position: 'relative'
    }}>
      
      {/* Main Calendar Container */}
      <div style={{
        background: '#16171d',
        border: '1px solid #252833',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
      }}>
        
        {/* Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CalendarIcon size={20} color="#10b981" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Toggle Left Column Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{
                background: isSidebarOpen ? '#272a38' : '#1f222e',
                border: '1px solid #32374a',
                color: isSidebarOpen ? '#a78bfa' : '#8b92a5',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              title="Toggle Weekly Summary Column"
            >
              <ToggleRight size={16} style={{ transform: isSidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              <span>{isSidebarOpen ? 'Hide Weekly Summary' : 'Show Weekly Summary'}</span>
            </button>

            {/* Month Navigation */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handlePrevMonth}
                style={{
                  background: '#1f222e',
                  border: '1px solid #2c3040',
                  color: '#8b92a5',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: 'pointer'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNextMonth}
                style={{
                  background: '#1f222e',
                  border: '1px solid #2c3040',
                  color: '#8b92a5',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: 'pointer'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isSidebarOpen ? 'repeat(7, 1fr) 170px' : 'repeat(7, 1fr)',
          gap: '8px',
          marginBottom: '10px',
          textAlign: 'center',
          transition: 'grid-template-columns 0.2s ease'
        }}>
          {daysOfWeek.map((day) => (
            <div key={day} style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8c93a6', padding: '4px 0' }}>
              {day}
            </div>
          ))}
          {isSidebarOpen && (
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#a78bfa',
              padding: '4px 0',
              textAlign: 'left',
              paddingLeft: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Weekly Summary
            </div>
          )}
        </div>

        {/* Calendar Rows (7 Days + Parallel Week Breakdown on Right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {weeks.map((week) => (
            <div
              key={week.weekNumber}
              style={{
                display: 'grid',
                gridTemplateColumns: isSidebarOpen ? 'repeat(7, 1fr) 170px' : 'repeat(7, 1fr)',
                gap: '8px',
                alignItems: 'stretch'
              }}
            >
              {/* 7 Days of this Week */}
              {week.days.map((cell) => {
                if (cell.isEmpty) {
                  return (
                    <div
                      key={cell.key}
                      style={{
                        minHeight: '110px',
                        background: '#121317',
                        border: '1px solid #1c1e27',
                        borderRadius: '10px',
                        opacity: 0.3
                      }}
                    />
                  );
                }

                const hasTrades = cell.count > 0;
                const isWin = cell.pnl > 0;
                const isLoss = cell.pnl < 0;

                return (
                  <div
                    key={cell.key}
                    onClick={() => hasTrades && onSelectDate && onSelectDate(cell.dateStr)}
                    style={{
                      minHeight: '110px',
                      background: hasTrades
                        ? isWin
                          ? '#0d2d22'
                          : '#3a171d'
                        : '#121317',
                      border: hasTrades
                        ? isWin
                          ? '1px solid #10b981'
                          : '1px solid #f43f5e'
                        : '1px solid #1c1e27',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: hasTrades ? 'pointer' : 'default',
                      position: 'relative',
                      transition: 'transform 0.15s ease, border-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (hasTrades) e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      if (hasTrades) e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {/* Top Row: Note icon (left) & Day number (right) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {cell.hasNotes ? (
                        <FileText size={14} color={isWin ? '#10b981' : isLoss ? '#f43f5e' : '#8c93a6'} />
                      ) : (
                        <div />
                      )}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: hasTrades ? '#ffffff' : '#4a5061' }}>
                        {cell.dayNumber}
                      </span>
                    </div>

                    {/* Center / Bottom PnL, Trade count & Win Rate */}
                    {hasTrades ? (
                      <div style={{ textAlign: 'center', marginTop: '4px' }}>
                        <div style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: isWin ? '#10b981' : isLoss ? '#f43f5e' : '#ffffff',
                          fontFamily: 'var(--font-mono)',
                          lineHeight: '1.2'
                        }}>
                          {formatMoney(cell.pnl, true)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: isWin ? '#6ee7b7' : isLoss ? '#fca5a5' : '#8c93a6', marginTop: '2px' }}>
                          {cell.count} trade{cell.count > 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isWin ? '#34d399' : isLoss ? '#f87171' : '#8c93a6', fontWeight: 600 }}>
                          {cell.winRate.toFixed(1)}%
                        </div>
                      </div>
                    ) : (
                      <div style={{ minHeight: '40px' }} />
                    )}
                  </div>
                );
              })}

              {/* Right Side Weekly Summary Card (Parallel to Relevant Week) */}
              {isSidebarOpen && (
                <div
                  style={{
                    background: '#1a1d26',
                    border: '1px solid #282c3d',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {/* Top Row: Week Label & Days badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>
                      {week.label}
                    </span>
                    <span style={{
                      background: week.daysCount > 0 ? '#2b2342' : '#1e2029',
                      color: week.daysCount > 0 ? '#a78bfa' : '#64748b',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '10px'
                    }}>
                      {week.daysCount} day{week.daysCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Center: Total P&L of THAT Week ONLY */}
                  <div style={{ marginTop: '6px', marginBottom: '6px' }}>
                    <div style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: '#94a3b8',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px'
                    }}>
                      Total P&L
                    </div>
                    <div style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: week.weekPnL > 0 ? '#10b981' : week.weekPnL < 0 ? '#f43f5e' : '#94a3b8',
                      fontFamily: 'var(--font-mono)',
                      lineHeight: '1.2'
                    }}>
                      {formatMoney(week.weekPnL, false)}
                    </div>
                  </div>

                  {/* Bottom Row: Trades count & Win Rate */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.7rem',
                    borderTop: '1px solid #232736',
                    paddingTop: '6px',
                    marginTop: '2px',
                    color: '#8c93a6'
                  }}>
                    <span>{week.tradesCount} trade{week.tradesCount !== 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 700, color: week.winRate >= 50 ? '#10b981' : week.tradesCount > 0 ? '#f43f5e' : '#8c93a6' }}>
                      {week.tradesCount > 0 ? `${week.winRate.toFixed(1)}% Win` : 'No Trades'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
