import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, Plus, Sparkles, LayoutDashboard, BarChart3, Upload, Wallet, Trash2, Settings, AlertTriangle, X, RefreshCw, Key, Zap, CheckCircle2, Server, Lock, Sun, Moon } from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  selectedAccount = 'All Accounts',
  setSelectedAccount,
  accounts = ['All Accounts'],
  onOpenNewTrade,
  onOpenMT5Modal,
  onSeedDemo,
  onDeleteAccount,
  onCreateAccount,
  trades = [],
  hasTrades,
  theme = 'dark',
  onToggleTheme
}) {
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New account creation state
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountBalance, setNewAccountBalance] = useState('10000');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // MT5 Direct Connection state
  const [showMT5Form, setShowMT5Form] = useState(false);
  const [mt5Login, setMt5Login] = useState('');
  const [mt5Password, setMt5Password] = useState('');
  const [mt5Server, setMt5Server] = useState('MetaQuotes-Demo');
  const [mt5AccountName, setMt5AccountName] = useState('');
  const [mt5AutoSync, setMt5AutoSync] = useState(true);
  const [isConnectingMT5, setIsConnectingMT5] = useState(false);
  const [mt5ConnectError, setMt5ConnectError] = useState('');
  const [mt5ConnectSuccess, setMt5ConnectSuccess] = useState('');
  const [mt5AccountsList, setMt5AccountsList] = useState([]);
  const [syncingAccount, setSyncingAccount] = useState(null);

  const fetchMT5Accounts = async () => {
    try {
      const res = await fetch('/api/mt5/accounts');
      if (res.ok) {
        const data = await res.json();
        setMt5AccountsList(data);
      }
    } catch (e) {
      console.error('Failed to fetch MT5 accounts:', e);
    }
  };

  useEffect(() => {
    if (isManageModalOpen) {
      fetchMT5Accounts();
    }
  }, [isManageModalOpen]);

  const handleConnectMT5Submit = async (e) => {
    e.preventDefault();
    if (!mt5Login.trim()) {
      setMt5ConnectError('Please enter your MT5 User ID / Account Login.');
      return;
    }
    if (!mt5Password.trim()) {
      setMt5ConnectError('Please enter your MT5 Password.');
      return;
    }
    if (!mt5Server.trim()) {
      setMt5ConnectError('Please enter your MT5 Broker Server.');
      return;
    }

    setIsConnectingMT5(true);
    setMt5ConnectError('');
    setMt5ConnectSuccess('');

    try {
      const res = await fetch('/api/mt5/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountLogin: mt5Login.trim(),
          password: mt5Password.trim(),
          server: mt5Server.trim(),
          accountName: mt5AccountName.trim(),
          autoSync: mt5AutoSync
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect MT5 account.');
      }

      setMt5ConnectSuccess(data.message || `Connected to MT5 account ${mt5Login.trim()}!`);
      setMt5Login('');
      setMt5Password('');
      setMt5AccountName('');

      if (onCreateAccount) {
        await onCreateAccount(data.accountName);
      }
      fetchMT5Accounts();

      setTimeout(() => {
        setShowMT5Form(false);
        setMt5ConnectSuccess('');
      }, 1800);
    } catch (err) {
      setMt5ConnectError(err.message || 'Error connecting MT5 account.');
    } finally {
      setIsConnectingMT5(false);
    }
  };

  const handleSyncMT5Account = async (accountName) => {
    setSyncingAccount(accountName);
    try {
      const res = await fetch(`/api/mt5/sync/${encodeURIComponent(accountName)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        fetchMT5Accounts();
        if (onCreateAccount) {
          await onCreateAccount(accountName);
        }
      }
    } catch (err) {
      console.error('Error syncing MT5 account:', err);
    } finally {
      setSyncingAccount(null);
    }
  };

  const getAccountStats = (accName) => {
    if (accName === 'All Accounts') {
      const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { count: trades.length, pnl: totalPnL };
    }
    const accTrades = trades.filter((t) => t.account === accName);
    const totalPnL = accTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    return { count: accTrades.length, pnl: totalPnL };
  };

  const handleConfirmDelete = async () => {
    if (!accountToDelete || !onDeleteAccount) return;
    setIsDeleting(true);
    try {
      await onDeleteAccount(accountToDelete);
      setAccountToDelete(null);
    } catch (err) {
      console.error('Error deleting account:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateNewAccountSubmit = async (e) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      setCreateError('Please enter an account name.');
      return;
    }
    if (!onCreateAccount) return;

    setIsCreatingAccount(true);
    setCreateError('');
    try {
      await onCreateAccount(newAccountName.trim(), newAccountBalance);
      setNewAccountName('');
      setNewAccountBalance('10000');
      setShowCreateForm(false);
      setIsManageModalOpen(false);
    } catch (err) {
      setCreateError(err.message || 'Failed to create account profile.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-header)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(12px)',
      transition: 'background-color 0.3s ease, border-color 0.3s ease'
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        
        {/* Logo & Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
          }}>
            <TrendingUp size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0, letterSpacing: '-0.02em' }}>
                TradePulse
              </h1>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 7px',
                textTransform: 'uppercase'
              }}>
                Pro
              </span>
            </div>
          </div>
        </div>

        {/* Center Section: Account Selector & Navigation Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          
          {/* Account Selector Dropdown Tab */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            padding: '6px 10px 6px 14px',
            borderRadius: '10px',
            border: '1px solid var(--profit-border)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Wallet size={16} color="#10b981" />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Account:
            </span>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount && setSelectedAccount(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-heading)',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer',
                outline: 'none',
                paddingRight: '4px'
              }}
            >
              {accounts.map((acc, i) => (
                <option key={i} value={acc} style={{ background: 'var(--bg-modal)', color: 'var(--text-main)', fontWeight: 700 }}>
                  {acc}
                </option>
              ))}
            </select>

            {/* Manage Accounts Gear Icon */}
            <button
              onClick={() => setIsManageModalOpen(true)}
              title="Manage Account Profiles"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                borderRadius: '6px',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                marginLeft: '2px',
                transition: 'all 0.15s ease'
              }}
            >
              <Settings size={14} />
            </button>
          </div>

          {/* 2 Main Pages Navigation Tabs */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'dashboard' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'dashboard' ? 'var(--text-heading)' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'dashboard' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <LayoutDashboard size={16} color={activeTab === 'dashboard' ? '#10b981' : 'currentColor'} />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: activeTab === 'analytics' ? 'var(--bg-card)' : 'transparent',
                color: activeTab === 'analytics' ? 'var(--text-heading)' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === 'analytics' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <BarChart3 size={16} color={activeTab === 'analytics' ? '#6366f1' : 'currentColor'} />
              Analytics
            </button>
          </div>

        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          
          {/* Light / Dark Mode Toggle Button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="btn btn-secondary"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{
                padding: '8px 14px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={16} color="#f59e0b" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon size={16} color="#6366f1" />
                  <span>Dark</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onOpenMT5Modal}
            className="btn btn-secondary"
            title="Import trades from MetaTrader 5 output report (.html or .xlsx)"
            style={{
              fontSize: '0.82rem',
              padding: '8px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--profit-border)',
              color: '#10b981',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Upload size={15} color="#10b981" /> Upload MT5 Report
          </button>

          {!hasTrades && (
            <button
              onClick={onSeedDemo}
              className="btn btn-secondary"
              title="Load realistic sample trades from the sketch into your database"
              style={{ fontSize: '0.82rem', padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            >
              <Sparkles size={15} color="#f59e0b" /> Seed Sketch Demo Data
            </button>
          )}

          <button
            onClick={onOpenNewTrade}
            className="btn btn-primary"
            style={{
              fontSize: '0.85rem',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
            }}
          >
            <Plus size={16} /> Record Trade
          </button>
        </div>

      </div>

      {/* Delete Account Confirmation Modal */}
      {accountToDelete && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '480px', border: '1px solid rgba(244, 63, 94, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                  <AlertTriangle size={22} color="#f43f5e" />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Remove Account Profile
                </h3>
              </div>
              <button onClick={() => setAccountToDelete(null)} className="btn btn-secondary" style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#fca5a5', lineHeight: '1.5' }}>
                Are you sure you want to remove account profile <strong style={{ color: '#ffffff', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>"{accountToDelete}"</strong>?
              </p>

              {(() => {
                const stats = getAccountStats(accountToDelete);
                return (
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', background: '#111215', padding: '10px 12px', borderRadius: '8px', border: '1px solid #23262f' }}>
                    <div>
                      <span style={{ color: '#8b92a5' }}>Associated Trades: </span>
                      <strong style={{ color: '#ffffff' }}>{stats.count} trade(s)</strong>
                    </div>
                    <div>
                      <span style={{ color: '#8b92a5' }}>Total PnL: </span>
                      <strong style={{ color: stats.pnl >= 0 ? '#10b981' : '#f43f5e' }}>
                        {stats.pnl >= 0 ? `+$${stats.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(stats.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              <p style={{ margin: '12px 0 0 0', fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>
                ⚠️ Warning: Deleting this account will permanently erase all associated trades and uploaded chart screenshots from your database.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(244, 63, 94, 0.3)'
                }}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Removing...' : 'Confirm Delete Account'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manage Accounts Modal */}
      {isManageModalOpen && createPortal(
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #23262f', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Wallet size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  Manage Account Profiles
                </h3>
              </div>
              <button onClick={() => { setIsManageModalOpen(false); setShowCreateForm(false); setCreateError(''); }} className="btn btn-secondary" style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Create New Account Form Section */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 78, 59, 0.15))',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCreateForm ? '12px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={16} color="#10b981" />
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>
                    Create New Account Profile
                  </span>
                </div>
                {!showCreateForm && (
                  <button
                    onClick={() => { setShowCreateForm(true); setShowMT5Form(false); }}
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    + Add New
                  </button>
                )}
              </div>

              {showCreateForm && (
                <form onSubmit={handleCreateNewAccountSubmit} style={{ marginTop: '10px' }}>
                  {createError && (
                    <div style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      color: '#f43f5e',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle size={14} /> {createError}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                        Account Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. FTMO 100k, Apex Funded"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#121316',
                          border: '1px solid #282b36',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                        autoFocus
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                        Initial Balance ($)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="10000"
                        value={newAccountBalance}
                        onChange={(e) => setNewAccountBalance(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#121316',
                          border: '1px solid #282b36',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingAccount}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Plus size={14} /> {isCreatingAccount ? 'Creating...' : 'Save & Switch Account'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Connect MT5 Account Directly Section */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(67, 56, 202, 0.15))',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showMT5Form ? '14px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} color="#818cf8" />
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', display: 'block' }}>
                      Connect MT5 Account Directly
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                      Connect using User ID, Password & Broker Server
                    </span>
                  </div>
                </div>
                {!showMT5Form && (
                  <button
                    onClick={() => { setShowMT5Form(true); setShowCreateForm(false); }}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)'
                    }}
                  >
                    <Key size={14} /> Connect MT5
                  </button>
                )}
              </div>

              {showMT5Form && (
                <form onSubmit={handleConnectMT5Submit} style={{ marginTop: '10px' }}>
                  {mt5ConnectError && (
                    <div style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      color: '#f43f5e',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertTriangle size={14} /> {mt5ConnectError}
                    </div>
                  )}

                  {mt5ConnectSuccess && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <CheckCircle2 size={14} /> {mt5ConnectSuccess}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                        MT5 User ID / Account Login *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 50291834"
                        value={mt5Login}
                        onChange={(e) => setMt5Login(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#121316',
                          border: '1px solid #282b36',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                        Password *
                      </label>
                      <input
                        type="password"
                        placeholder="Trader or Investor Password"
                        value={mt5Password}
                        onChange={(e) => setMt5Password(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#121316',
                          border: '1px solid #282b36',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                        Broker Server *
                      </label>
                      <input
                        type="text"
                        list="mt5-servers-list"
                        placeholder="e.g. MetaQuotes-Demo, FTMO-Demo"
                        value={mt5Server}
                        onChange={(e) => setMt5Server(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#121316',
                          border: '1px solid #282b36',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                        required
                      />
                      <datalist id="mt5-servers-list">
                        <option value="MetaQuotes-Demo" />
                        <option value="FTMO-Demo" />
                        <option value="FTMO-Server" />
                        <option value="ICMarketsSC-Demo" />
                        <option value="ICMarketsSC-Live" />
                        <option value="Exness-Real" />
                        <option value="HolaPrime-Live" />
                        <option value="The5ers-Server" />
                      </datalist>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', marginBottom: '4px' }}>
                        Account Profile Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Auto-generated if empty"
                        value={mt5AccountName}
                        onChange={(e) => setMt5AccountName(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#121316',
                          border: '1px solid #282b36',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '0.85rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#9ca3af', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={mt5AutoSync}
                        onChange={(e) => setMt5AutoSync(e.target.checked)}
                        style={{ accentColor: '#6366f1' }}
                      />
                      Auto-sync live trades
                    </label>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => { setShowMT5Form(false); setMt5ConnectError(''); }}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isConnectingMT5}
                        style={{
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                        }}
                      >
                        {isConnectingMT5 ? (
                          <>
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            Connecting MT5...
                          </>
                        ) : (
                          <>
                            <Zap size={14} /> Connect & Sync Account
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: '12px' }}>
              Below are all trade account profiles saved in your database:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              {accounts.map((accName, idx) => {
                const isAggregate = accName === 'All Accounts';
                const stats = getAccountStats(accName);
                const mt5Detail = mt5AccountsList.find(m => m.accountName === accName);
                const isSyncingThis = syncingAccount === accName;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: selectedAccount === accName ? 'rgba(16, 185, 129, 0.08)' : '#1a1c23',
                      border: `1px solid ${selectedAccount === accName ? 'rgba(16, 185, 129, 0.4)' : '#282b36'}`,
                      borderRadius: '10px',
                      padding: '12px 16px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>
                          {accName}
                        </span>
                        {isAggregate && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                            Aggregate Filter
                          </span>
                        )}
                        {selectedAccount === accName && !isAggregate && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                            Active
                          </span>
                        )}
                        {mt5Detail && (
                          <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.4)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Zap size={10} color="#a5b4fc" /> MT5 Direct ({mt5Detail.accountLogin})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: '#8b92a5', marginTop: '4px' }}>
                        <span>{stats.count} trade(s)</span>
                        <span>•</span>
                        <span style={{ color: stats.pnl >= 0 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                          PnL: {stats.pnl >= 0 ? `+$${stats.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(stats.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                        </span>
                        {mt5Detail && mt5Detail.server && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#9ca3af' }}>Server: {mt5Detail.server}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {!isAggregate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {mt5Detail && (
                          <button
                            onClick={() => handleSyncMT5Account(accName)}
                            disabled={isSyncingThis}
                            title="Synchronize MT5 Trades"
                            style={{
                              background: 'rgba(99, 102, 241, 0.15)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              color: '#818cf8',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <RefreshCw size={13} style={isSyncingThis ? { animation: 'spin 1s linear infinite' } : {}} />
                            {isSyncingThis ? 'Syncing...' : 'Sync'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsManageModalOpen(false);
                            setAccountToDelete(accName);
                          }}
                          style={{
                            background: 'rgba(244, 63, 94, 0.1)',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            color: '#f43f5e',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #23262f' }}>
              <button
                type="button"
                onClick={() => { setIsManageModalOpen(false); setShowCreateForm(false); setShowMT5Form(false); setCreateError(''); setMt5ConnectError(''); }}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </header>
  );
}
