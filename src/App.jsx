import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import CalendarView from './components/CalendarView';
import AnalyticsView from './components/AnalyticsView';
import TradeList from './components/TradeList';
import TradeModal from './components/TradeModal';
import TradeDetailModal from './components/TradeDetailModal';
import MT5UploadModal from './components/MT5UploadModal';

export default function App() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'analytics'
  const [selectedAccount, setSelectedAccount] = useState('All Accounts');
  const [accounts, setAccounts] = useState(['All Accounts']);
  const [filters, setFilters] = useState({
    symbol: '',
    side: '',
    asset_class: '',
    status: '',
    startDate: '',
    endDate: '',
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('tp_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tp_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isMT5ModalOpen, setIsMT5ModalOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState(null);
  const [selectedTradeDetail, setSelectedTradeDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Manage Account Starting / Initial Balance
  const getSavedBalance = (accName) => {
    const key = `tp_initial_balance_${accName || 'All Accounts'}`;
    const saved = localStorage.getItem(key);
    return saved ? parseFloat(saved) : 10000;
  };

  const [initialBalance, setInitialBalance] = useState(() => getSavedBalance(selectedAccount));

  useEffect(() => {
    setInitialBalance(getSavedBalance(selectedAccount));
  }, [selectedAccount]);

  const handleUpdateInitialBalance = (newVal) => {
    const num = parseFloat(newVal);
    if (!isNaN(num) && num >= 0) {
      const key = `tp_initial_balance_${selectedAccount || 'All Accounts'}`;
      localStorage.setItem(key, num.toString());
      setInitialBalance(num);
    }
  };

  // Fetch Available Accounts List
  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, []);

  // Fetch Trades API Call
  const fetchTrades = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (selectedAccount && selectedAccount !== 'All Accounts') {
        queryParams.append('account', selectedAccount);
      }
      if (filters.symbol) queryParams.append('symbol', filters.symbol);
      if (filters.side) queryParams.append('side', filters.side);
      if (filters.asset_class) queryParams.append('asset_class', filters.asset_class);
      if (filters.status) queryParams.append('status', filters.status);
      if (selectedDateFilter) {
        queryParams.append('startDate', selectedDateFilter);
        queryParams.append('endDate', `${selectedDateFilter}T23:59:59`);
      }

      const res = await fetch(`/api/trades?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTrades(data);
      }
    } catch (err) {
      console.error('Error fetching trades:', err);
    }
  }, [filters, selectedDateFilter, selectedAccount]);

  // Fetch Performance Stats API Call
  const fetchStats = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (selectedAccount && selectedAccount !== 'All Accounts') {
        queryParams.append('account', selectedAccount);
      }
      const res = await fetch(`/api/stats?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [selectedAccount]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchTrades(), fetchStats(), fetchAccounts()]);
    setIsLoading(false);
  }, [fetchTrades, fetchStats, fetchAccounts]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle Save / Create / Edit Trade
  const handleSaveTrade = async ({ formData, tradeId, deletedScreenshotIds }) => {
    if (deletedScreenshotIds && deletedScreenshotIds.length > 0) {
      for (const scId of deletedScreenshotIds) {
        await fetch(`/api/screenshots/${scId}`, { method: 'DELETE' });
      }
    }

    let res;
    if (tradeId) {
      res = await fetch(`/api/trades/${tradeId}`, {
        method: 'PUT',
        body: formData,
      });
    } else {
      res = await fetch('/api/trades', {
        method: 'POST',
        body: formData,
      });
    }

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save trade record.');
    }

    await refreshData();
  };

  // Handle Delete Trade
  const handleDeleteTrade = async (tradeId) => {
    if (window.confirm('Are you sure you want to delete this trade?')) {
      try {
        const res = await fetch(`/api/trades/${tradeId}`, { method: 'DELETE' });
        if (res.ok) {
          if (selectedTradeDetail && selectedTradeDetail.id === tradeId) {
            setSelectedTradeDetail(null);
          }
          await refreshData();
        }
      } catch (err) {
        console.error('Error deleting trade:', err);
      }
    }
  };

  // Handle Seed Demo Data from Sketch
  const handleSeedDemo = async () => {
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error('Error seeding demo data:', err);
    }
  };

  // Handle Create New Account Profile
  const handleCreateAccount = async (accountName, initialBalanceVal) => {
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accountName,
          initialBalance: initialBalanceVal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account profile.');
      }

      if (initialBalanceVal !== undefined && initialBalanceVal !== null && !isNaN(parseFloat(initialBalanceVal))) {
        const key = `tp_initial_balance_${data.account}`;
        localStorage.setItem(key, parseFloat(initialBalanceVal).toString());
      }

      await refreshData();
      setSelectedAccount(data.account);
      return data;
    } catch (err) {
      console.error('Error creating account:', err);
      throw err;
    }
  };

  // Handle Delete Account Profile
  const handleDeleteAccount = async (accountName) => {
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(accountName)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedAccount === accountName) {
          setSelectedAccount('All Accounts');
        }
        await refreshData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete account.');
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      alert('Error deleting account profile.');
    }
  };

  const handleSelectCalendarDate = (dateStr) => {
    setSelectedDateFilter(dateStr);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', transition: 'background-color 0.3s ease, color 0.3s ease' }}>
      
      {/* Top Header with Account Selector & Page Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        accounts={accounts}
        onOpenNewTrade={() => { setTradeToEdit(null); setIsTradeModalOpen(true); }}
        onOpenMT5Modal={() => setIsMT5ModalOpen(true)}
        onSeedDemo={handleSeedDemo}
        onDeleteAccount={handleDeleteAccount}
        onCreateAccount={handleCreateAccount}
        trades={trades}
        hasTrades={trades.length > 0 || (stats && stats.summary && stats.summary.totalTrades > 0)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container */}
      <main style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '20px 24px 60px 24px', flex: 1 }}>
        
        {/* PAGE 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <>
            {/* Top 6 Key Metric Cards with Account Balance */}
            <StatsCards
              stats={stats ? stats.summary : null}
              selectedAccount={selectedAccount}
              initialBalance={initialBalance}
              onUpdateInitialBalance={handleUpdateInitialBalance}
            />

            {/* Middle Calendar View & Weekly Summary Side-by-Side */}
            <CalendarView
              dailyPnLMap={stats ? stats.dailyPnL : {}}
              onSelectDate={handleSelectCalendarDate}
            />

            {/* Bottom Recent Trades Log Table */}
            <TradeList
              trades={trades}
              filters={filters}
              setFilters={setFilters}
              onSelectTrade={(t) => setSelectedTradeDetail(t)}
              onEditTrade={(t) => { setTradeToEdit(t); setIsTradeModalOpen(true); }}
              onDeleteTrade={handleDeleteTrade}
              selectedDateFilter={selectedDateFilter}
              onClearDateFilter={() => setSelectedDateFilter('')}
            />
          </>
        )}

        {/* PAGE 2: ANALYTICS */}
        {activeTab === 'analytics' && (
          <AnalyticsView stats={stats} trades={trades} initialBalance={initialBalance} />
        )}

      </main>

      {/* Record / Edit Trade Modal */}
      <TradeModal
        isOpen={isTradeModalOpen}
        onClose={() => { setIsTradeModalOpen(false); setTradeToEdit(null); }}
        onSave={handleSaveTrade}
        tradeToEdit={tradeToEdit}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onCreateAccount={handleCreateAccount}
      />

      {/* Upload MT5 Report Modal */}
      <MT5UploadModal
        isOpen={isMT5ModalOpen}
        onClose={() => setIsMT5ModalOpen(false)}
        activeAccount={selectedAccount !== 'All Accounts' ? selectedAccount : (accounts.find(a => a !== 'All Accounts') || '')}
        onImportSuccess={async (importedAccount) => {
          if (importedAccount) {
            setSelectedAccount(importedAccount);
          }
          await refreshData();
        }}
      />

      {/* Trade Detail & Screenshot Lightbox Drawer */}
      {selectedTradeDetail && (
        <TradeDetailModal
          trade={selectedTradeDetail}
          onClose={() => setSelectedTradeDetail(null)}
          onEdit={(t) => { setSelectedTradeDetail(null); setTradeToEdit(t); setIsTradeModalOpen(true); }}
        />
      )}

      {/* Minimal Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
        TradePulse Journal &bull; Pro Dashboard Layout Active &bull; Database Persistence Ready
      </footer>

    </div>
  );
}
