import React, { useState, useMemo } from 'react';
import { Search, Download, SlidersHorizontal, ArrowUpDown, FileText, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';

export default function TradeList({
  trades = [],
  filters = {},
  setFilters,
  onSelectTrade,
  onEditTrade,
  onDeleteTrade,
  selectedDateFilter,
  onClearDateFilter
}) {
  const [sortField, setSortField] = useState('entry_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleSearchChange = (val) => {
    setFilters((prev) => ({ ...prev, symbol: val }));
  };

  // Filter & Sort Trades
  const filteredAndSortedTrades = useMemo(() => {
    let result = [...trades];

    // Search query filter
    if (filters.symbol) {
      const q = filters.symbol.toLowerCase();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          (t.account && String(t.account).includes(q)) ||
          (t.setup && t.setup.toLowerCase().includes(q))
      );
    }

    // Asset filter
    if (filters.asset_class) {
      result = result.filter((t) => t.asset_class === filters.asset_class);
    }

    // Side filter
    if (filters.side) {
      result = result.filter((t) => t.side.toUpperCase() === filters.side.toUpperCase());
    }

    // Status filter
    if (filters.status) {
      result = result.filter((t) => t.status.toUpperCase() === filters.status.toUpperCase());
    }

    // Date filter from calendar (matches closing time exit_date, fallback to entry_date)
    if (selectedDateFilter) {
      result = result.filter((t) => {
        const tradeDate = (t.exit_date || t.entry_date || '').split('T')[0];
        return tradeDate === selectedDateFilter;
      });
    }

    // Sorting logic
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'entry_date' || sortField === 'exit_date') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [trades, filters, selectedDateFilter, sortField, sortDirection]);

  // Pagination logic
  const totalEntries = filteredAndSortedTrades.length;
  const totalPages = Math.ceil(totalEntries / entriesPerPage) || 1;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedTrades = filteredAndSortedTrades.slice(startIndex, startIndex + entriesPerPage);

  // CSV Export handler
  const handleExportCSV = () => {
    if (trades.length === 0) return;

    const headers = ['ID', 'Account', 'Symbol', 'Side', 'Asset', 'Entry Date', 'Entry Price', 'Exit Date', 'Exit Price', 'Quantity', 'PnL', 'Status', 'Setup', 'Notes'];
    const csvRows = [headers.join(',')];

    trades.forEach((t) => {
      const row = [
        t.id,
        t.account || '116794',
        t.symbol,
        t.side,
        t.asset_class,
        t.entry_date || '',
        t.entry_price || '',
        t.exit_date || '',
        t.exit_price || '',
        t.quantity || 1,
        t.pnl || 0,
        t.status || 'OPEN',
        `"${(t.setup || '').replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trading_Journal_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Format Date String nicely like "23-Jul-26 16:35:15"
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr;

      const day = String(dateObj.getDate()).padStart(2, '0');
      const monthShort = dateObj.toLocaleString('default', { month: 'short' });
      const yearShort = String(dateObj.getFullYear()).slice(2);
      const timeStr = dateObj.toTimeString().split(' ')[0];

      return `${day}-${monthShort}-${yearShort} ${timeStr}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '16px',
      padding: '20px 24px',
      boxShadow: 'var(--shadow-sm)',
      transition: 'background 0.3s ease, border-color 0.3s ease'
    }}>
      
      {/* Header Controls: Search bar (left), Export & Filter (right) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        {/* Left: Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '420px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={filters.symbol || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '24px',
                padding: '9px 16px 9px 38px',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
            />
          </div>

          {selectedDateFilter && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--profit-bg)',
              border: '1px solid var(--profit-border)',
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '0.75rem',
              color: 'var(--profit)',
              whiteSpace: 'nowrap'
            }}>
              <span>Date: {selectedDateFilter}</span>
              <XCircle size={14} style={{ cursor: 'pointer' }} onClick={onClearDateFilter} />
            </div>
          )}
        </div>

        {/* Right: Export & Filter buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: '#6366f1',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            Export
          </button>

          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            style={{
              background: showFilterDropdown ? 'var(--bg-card-hover)' : 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Toggle Filter Panel"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Filter Dropdown Bar */}
      {showFilterDropdown && (
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '14px',
          background: 'var(--bg-input)',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap'
        }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Asset Class</label>
            <select
              value={filters.asset_class || ''}
              onChange={(e) => setFilters((p) => ({ ...p, asset_class: e.target.value }))}
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value="">All Assets</option>
              <option value="Crypto">Crypto</option>
              <option value="Forex">Forex</option>
              <option value="Stocks">Stocks</option>
              <option value="Futures">Futures</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Side</label>
            <select
              value={filters.side || ''}
              onChange={(e) => setFilters((p) => ({ ...p, side: e.target.value }))}
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value="">All Sides</option>
              <option value="BUY">BUY / LONG</option>
              <option value="SELL">SELL / SHORT</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value="">All Statuses</option>
              <option value="WIN">WIN</option>
              <option value="LOSS">LOSS</option>
              <option value="OPEN">OPEN</option>
              <option value="BREAKEVEN">BREAKEVEN</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Trade History Table */}
      {paginatedTrades.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No trade entries found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: 'var(--table-header-bg)'
              }}>
                {/* Column 1: Account */}
                <th
                  onClick={() => handleSort('account')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Account <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Column 2: Order */}
                <th
                  onClick={() => handleSort('symbol')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Order <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Column 3: Open Date & Time */}
                <th
                  onClick={() => handleSort('entry_date')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Open <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Column 4: Open Price */}
                <th
                  onClick={() => handleSort('entry_price')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Price <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Column 5: Close Date & Time */}
                <th
                  onClick={() => handleSort('exit_date')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Close <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Column 6: Close Price */}
                <th
                  onClick={() => handleSort('exit_price')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Price <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Column 7: P&L */}
                <th
                  onClick={() => handleSort('pnl')}
                  style={{ padding: '12px 14px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    P&L <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Column 8: Journal Note Icon */}
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>
                  Journal
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedTrades.map((trade) => {
                const isBuy = trade.side === 'BUY' || trade.side === 'LONG';
                const isWin = trade.status === 'WIN' || trade.pnl > 0;
                const isLoss = trade.status === 'LOSS' || trade.pnl < 0;

                return (
                  <tr
                    key={trade.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--table-row-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Account */}
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {trade.account || '116794'}
                    </td>

                    {/* Order (Symbol + Buy/Sell Pill + Lot Size) */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--text-heading)' }}>
                          {trade.symbol}
                        </span>
                        <span style={{
                          color: isBuy ? 'var(--profit)' : 'var(--loss)',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {isBuy ? 'Buy' : 'Sell'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                          {trade.quantity}
                        </span>
                      </div>
                    </td>

                    {/* Open Date */}
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatDateDisplay(trade.entry_date)}
                    </td>

                    {/* Open Price */}
                    <td style={{ padding: '12px 14px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {trade.entry_price ? trade.entry_price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>

                    {/* Close Date */}
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {formatDateDisplay(trade.exit_date)}
                    </td>

                    {/* Close Price */}
                    <td style={{ padding: '12px 14px', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {trade.exit_price ? trade.exit_price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>

                    {/* P&L Amount */}
                    <td style={{ padding: '12px 14px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {trade.status === 'OPEN' ? (
                        <span style={{ color: '#6366f1', fontSize: '0.78rem' }}>OPEN</span>
                      ) : (
                        <span style={{ color: isWin ? 'var(--profit)' : isLoss ? 'var(--loss)' : 'var(--text-heading)' }}>
                          {trade.pnl >= 0 ? trade.pnl.toFixed(2) : trade.pnl.toFixed(2)}
                        </span>
                      )}
                    </td>

                    {/* Journal Icon Button */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => onSelectTrade(trade)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#6366f1',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="View Trade Journal Detail"
                      >
                        <FileText size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer & Pagination Bar */}
      <div style={{
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left: Showing 1 out of X entries + Entries dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>
            Showing {totalEntries > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + entriesPerPage, totalEntries)} out of {totalEntries} entries
          </span>
          <select
            value={entriesPerPage}
            onChange={(e) => {
              setEntriesPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '2px 8px',
              fontSize: '0.75rem',
              outline: 'none'
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries</span>
        </div>

        {/* Right: Pagination arrows */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: currentPage === 1 ? 'var(--text-dim)' : 'var(--text-main)',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: currentPage === 1 ? 'default' : 'pointer'
            }}
          >
            <ChevronLeft size={14} />
          </button>

          <span style={{
            background: 'var(--primary)',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '4px 10px',
            fontWeight: 700
          }}>
            {currentPage}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: currentPage === totalPages ? 'var(--text-dim)' : 'var(--text-main)',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: currentPage === totalPages ? 'default' : 'pointer'
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

    </div>
  );
}
