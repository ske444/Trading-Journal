import React, { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Star, CheckCircle, AlertCircle, Plus, Wallet } from 'lucide-react';

export default function TradeModal({
  isOpen,
  onClose,
  onSave,
  tradeToEdit,
  accounts = ['All Accounts'],
  selectedAccount = 'All Accounts',
  onCreateAccount
}) {
  const isEditing = Boolean(tradeToEdit);

  const availableAccounts = accounts.filter((a) => a !== 'All Accounts');
  if (availableAccounts.length === 0) availableAccounts.push('Main Account');

  const defaultAcc = selectedAccount && selectedAccount !== 'All Accounts'
    ? selectedAccount
    : (availableAccounts[0] || 'Main Account');

  const [formData, setFormData] = useState({
    symbol: '',
    side: 'LONG',
    asset_class: 'Crypto',
    entry_date: new Date().toISOString().slice(0, 16),
    exit_date: '',
    entry_price: '',
    exit_price: '',
    quantity: '1',
    stop_loss: '',
    take_profit: '',
    setup: 'Bullish Orderblock',
    timeframe: '15m',
    notes: '',
    rating: '4',
    account: defaultAcc,
  });

  const [newScreenshots, setNewScreenshots] = useState([]);
  const [existingScreenshots, setExistingScreenshots] = useState([]);
  const [deletedScreenshotIds, setDeletedScreenshotIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Inline Account Creation inside Trade Modal
  const [isCreatingInlineAcc, setIsCreatingInlineAcc] = useState(false);
  const [inlineAccName, setInlineAccName] = useState('');
  const [inlineAccError, setInlineAccError] = useState('');

  // Inline Strategy Creation inside Trade Modal
  const [isCreatingInlineStrategy, setIsCreatingInlineStrategy] = useState(false);
  const [inlineStrategyName, setInlineStrategyName] = useState('');
  const [inlineStrategyError, setInlineStrategyError] = useState('');

  const DEFAULT_STRATEGIES = [
    'Bullish Orderblock',
    'Bearish Orderblock',
    'Fair Value Gap (FVG)',
    'Breakout & Retest',
    'Trend Continuation',
    'Mean Reversion',
    'Double Top / Bottom',
    'Counter Trend',
  ];

  const [customStrategies, setCustomStrategies] = useState(() => {
    try {
      const saved = localStorage.getItem('tp_custom_strategies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [serverStrategies, setServerStrategies] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/strategies')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setServerStrategies(data);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const allStrategies = Array.from(
    new Set([
      ...DEFAULT_STRATEGIES,
      ...serverStrategies,
      ...customStrategies,
      ...(tradeToEdit?.setup ? [tradeToEdit.setup] : []),
      ...(formData.setup ? [formData.setup] : []),
    ])
  ).filter(Boolean);

  useEffect(() => {
    const currentDefault = selectedAccount && selectedAccount !== 'All Accounts'
      ? selectedAccount
      : (availableAccounts[0] || 'Main Account');

    if (tradeToEdit) {
      setFormData({
        symbol: tradeToEdit.symbol || '',
        side: tradeToEdit.side || 'LONG',
        asset_class: tradeToEdit.asset_class || 'Crypto',
        entry_date: tradeToEdit.entry_date ? tradeToEdit.entry_date.slice(0, 16) : new Date().toISOString().slice(0, 16),
        exit_date: tradeToEdit.exit_date ? tradeToEdit.exit_date.slice(0, 16) : '',
        entry_price: tradeToEdit.entry_price || '',
        exit_price: tradeToEdit.exit_price || '',
        quantity: tradeToEdit.quantity || '1',
        stop_loss: tradeToEdit.stop_loss || '',
        take_profit: tradeToEdit.take_profit || '',
        setup: tradeToEdit.setup || 'General',
        timeframe: tradeToEdit.timeframe || '15m',
        notes: tradeToEdit.notes || '',
        rating: tradeToEdit.rating ? String(tradeToEdit.rating) : '3',
        account: tradeToEdit.account || currentDefault,
      });
      setExistingScreenshots(tradeToEdit.screenshots || []);
      setNewScreenshots([]);
      setDeletedScreenshotIds([]);
    } else {
      setFormData({
        symbol: '',
        side: 'LONG',
        asset_class: 'Crypto',
        entry_date: new Date().toISOString().slice(0, 16),
        exit_date: '',
        entry_price: '',
        exit_price: '',
        quantity: '1',
        stop_loss: '',
        take_profit: '',
        setup: 'Bullish Orderblock',
        timeframe: '15m',
        notes: '',
        rating: '4',
        account: currentDefault,
      });
      setExistingScreenshots([]);
      setNewScreenshots([]);
      setDeletedScreenshotIds([]);
    }
    setErrorMsg('');
    setIsCreatingInlineAcc(false);
    setInlineAccName('');
    setInlineAccError('');
    setIsCreatingInlineStrategy(false);
    setInlineStrategyName('');
    setInlineStrategyError('');
  }, [tradeToEdit, isOpen, selectedAccount]);

  // Helper to calculate live estimated PnL preview in modal
  const getEstimatedPnL = () => {
    const entry = parseFloat(formData.entry_price);
    const exit = parseFloat(formData.exit_price);
    const qty = parseFloat(formData.quantity) || 1;

    if (isNaN(entry) || isNaN(exit) || entry <= 0) return null;

    const isLong = formData.side === 'LONG' || formData.side === 'BUY';
    const priceDiff = isLong ? (exit - entry) : (entry - exit);
    const pnl_percent = ((priceDiff / entry) * 100).toFixed(2);

    const symUpper = (formData.symbol || '').toUpperCase().replace('/', '').trim();
    const isForexCategory = (formData.asset_class || '').toLowerCase() === 'forex' ||
      /^(EUR|GBP|USD|JPY|AUD|CAD|CHF|NZD){2}$/.test(symUpper) ||
      symUpper.startsWith('XAU') || symUpper.startsWith('XAG') ||
      symUpper === 'GOLD' || symUpper === 'SILVER';

    let pnl = 0;
    if (isForexCategory) {
      let lots = qty;
      if (qty >= 500) {
        lots = qty / 100000;
      }

      let contractSize = 100000;
      if (symUpper.includes('XAU') || symUpper === 'GOLD') {
        contractSize = 100;
      } else if (symUpper.includes('XAG') || symUpper === 'SILVER') {
        contractSize = 5000;
      }

      if (symUpper.endsWith('USD') || symUpper === 'GOLD' || symUpper === 'SILVER') {
        pnl = priceDiff * lots * contractSize;
      } else if (symUpper.startsWith('USD')) {
        pnl = (priceDiff * lots * contractSize) / exit;
      } else if (symUpper.endsWith('JPY')) {
        const usdJpyEst = exit > 50 ? (exit / 1.30) : 150;
        pnl = (priceDiff * lots * contractSize) / usdJpyEst;
      } else if (symUpper.endsWith('GBP')) {
        pnl = priceDiff * lots * contractSize * 1.28;
      } else if (symUpper.endsWith('AUD')) {
        pnl = priceDiff * lots * contractSize * 0.66;
      } else if (symUpper.endsWith('CAD')) {
        pnl = (priceDiff * lots * contractSize) / 1.36;
      } else if (symUpper.endsWith('CHF')) {
        pnl = (priceDiff * lots * contractSize) / 0.90;
      } else if (symUpper.endsWith('NZD')) {
        pnl = priceDiff * lots * contractSize * 0.60;
      } else {
        pnl = priceDiff * lots * contractSize;
      }
    } else {
      pnl = priceDiff * qty;
    }

    const isWin = pnl > 0.005;
    const isLoss = pnl < -0.005;
    const formattedPnL = Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = pnl >= 0 ? '+' : '-';

    return {
      pnl,
      pnlText: `${sign}$${formattedPnL}`,
      pnl_percent,
      isWin,
      isLoss,
      isForexCategory
    };
  };

  const estimatedPnL = getEstimatedPnL();

  if (!isOpen) return null;

  const handleInlineCreateAccount = async () => {
    if (!inlineAccName.trim()) {
      setInlineAccError('Account name is required.');
      return;
    }
    setInlineAccError('');
    try {
      if (onCreateAccount) {
        const result = await onCreateAccount(inlineAccName.trim(), 10000);
        const newAcc = result.account || inlineAccName.trim();
        setFormData((prev) => ({ ...prev, account: newAcc }));
      }
      setIsCreatingInlineAcc(false);
      setInlineAccName('');
    } catch (err) {
      setInlineAccError(err.message || 'Failed to create account.');
    }
  };

  const handleInlineCreateStrategy = async () => {
    const trimmed = inlineStrategyName.trim();
    if (!trimmed) {
      setInlineStrategyError('Strategy name is required.');
      return;
    }
    setInlineStrategyError('');

    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.strategies) {
          setServerStrategies(data.strategies);
        }
      }
    } catch (err) {
      console.warn('Failed to save strategy to backend API:', err);
    }

    try {
      const updated = Array.from(new Set([...customStrategies, trimmed]));
      localStorage.setItem('tp_custom_strategies', JSON.stringify(updated));
      setCustomStrategies(updated);
    } catch (err) {
      console.warn('Failed to save strategy to localStorage:', err);
    }

    setFormData((prev) => ({ ...prev, setup: trimmed }));
    setIsCreatingInlineStrategy(false);
    setInlineStrategyName('');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'account' && value === '__CREATE_NEW__') {
      setIsCreatingInlineAcc(true);
      return;
    }
    if (name === 'setup' && value === '__CREATE_NEW_STRATEGY__') {
      setIsCreatingInlineStrategy(true);
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle File Selection via Input or Drag & Drop
  const handleFileSelect = (files) => {
    const fileArray = Array.from(files).filter((file) => file.type.startsWith('image/'));
    const previews = fileArray.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      id: Math.random().toString(36).substring(7),
    }));
    setNewScreenshots((prev) => [...prev, ...previews]);
  };

  // Handle Paste from Clipboard (e.g. Snipping Tool)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          imageFiles.push(new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type }));
        }
      }
    }
    if (imageFiles.length > 0) {
      handleFileSelect(imageFiles);
    }
  };

  const handleRemoveNewFile = (id) => {
    setNewScreenshots((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRemoveExistingFile = (id) => {
    setExistingScreenshots((prev) => prev.filter((item) => item.id !== id));
    setDeletedScreenshotIds((prev) => [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symbol || !formData.entry_price || !formData.entry_date) {
      setErrorMsg('Please fill in required fields: Symbol, Entry Price, and Entry Date.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined) {
          data.append(key, formData[key]);
        }
      });

      // Append new screenshot files
      newScreenshots.forEach((item) => {
        data.append('screenshots', item.file);
      });

      await onSave({
        formData: data,
        tradeId: tradeToEdit ? tradeToEdit.id : null,
        deletedScreenshotIds,
      });

      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to save trade.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onPaste={handlePaste}>
      <div className="modal-content">
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
              {isEditing ? `Edit Trade #${tradeToEdit.id} (${tradeToEdit.symbol})` : 'Log New Trade'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              You can paste screenshots directly from clipboard (Ctrl+V) anywhere inside this modal.
            </p>
          </div>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: 'var(--loss-bg)', border: '1px solid var(--loss-border)', color: 'var(--loss)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <AlertCircle size={18} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Target Account Profile Selector */}
          <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: 'var(--text-heading)' }}>
                <Wallet size={15} color="#10b981" />
                Target Account Profile *
              </label>
              {!isCreatingInlineAcc && (
                <button
                  type="button"
                  onClick={() => setIsCreatingInlineAcc(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#10b981',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} /> Create New Account
                </button>
              )}
            </div>

            {isCreatingInlineAcc ? (
              <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                {inlineAccError && (
                  <div style={{ color: '#f43f5e', fontSize: '0.78rem', marginBottom: '6px' }}>
                    {inlineAccError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter new account name (e.g. FTMO Challenge)"
                    value={inlineAccName}
                    onChange={(e) => setInlineAccName(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.85rem' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleInlineCreateAccount}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  >
                    Save & Select
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreatingInlineAcc(false); setInlineAccError(''); }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <select
                name="account"
                className="form-select"
                value={formData.account}
                onChange={handleChange}
                style={{ fontWeight: 700 }}
              >
                {availableAccounts.map((acc, i) => (
                  <option key={i} value={acc}>
                    {acc}
                  </option>
                ))}
                <option value="__CREATE_NEW__" style={{ color: '#10b981', fontWeight: 800 }}>
                  + Create New Account Profile...
                </option>
              </select>
            )}
          </div>
          {/* Row 1: Symbol, Side, Asset Class */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Symbol *</label>
              <input
                type="text"
                name="symbol"
                className="form-input"
                placeholder="e.g. BTCUSDT, EURUSD"
                value={formData.symbol}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Side *</label>
              <select name="side" className="form-select" value={formData.side} onChange={handleChange}>
                <option value="LONG">LONG / BUY</option>
                <option value="SHORT">SHORT / SELL</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Asset Class</label>
              <select name="asset_class" className="form-select" value={formData.asset_class} onChange={handleChange}>
                <option value="Crypto">Crypto</option>
                <option value="Forex">Forex</option>
                <option value="Stocks">Stocks</option>
                <option value="Futures">Futures</option>
              </select>
            </div>
          </div>

          {/* Row 2: Entry Date, Exit Date, Timeframe */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Entry Date & Time *</label>
              <input
                type="datetime-local"
                name="entry_date"
                className="form-input"
                value={formData.entry_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Exit Date & Time (Optional)</label>
              <input
                type="datetime-local"
                name="exit_date"
                className="form-input"
                value={formData.exit_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Timeframe</label>
              <select name="timeframe" className="form-select" value={formData.timeframe} onChange={handleChange}>
                <option value="1m">1 minute</option>
                <option value="5m">5 minutes</option>
                <option value="15m">15 minutes</option>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="1D">1 Day</option>
              </select>
            </div>
          </div>

          {/* Row 3: Entry Price, Exit Price, Quantity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: estimatedPnL ? '12px' : '0' }}>
            <div className="form-group">
              <label className="form-label">Entry Price *</label>
              <input
                type="number"
                step="any"
                name="entry_price"
                className="form-input font-mono"
                placeholder="0.00"
                value={formData.entry_price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Exit Price</label>
              <input
                type="number"
                step="any"
                name="exit_price"
                className="form-input font-mono"
                placeholder="Leave empty if Open"
                value={formData.exit_price}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Position Size {formData.asset_class === 'Forex' ? '(Lots, e.g. 1.0, 0.1)' : '(Qty / Units)'}
              </label>
              <input
                type="number"
                step="any"
                name="quantity"
                className="form-input font-mono"
                placeholder={formData.asset_class === 'Forex' ? 'e.g. 1.0' : '1'}
                value={formData.quantity}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Live Estimated P&L Preview Banner when Exit Price is present */}
          {estimatedPnL && (
            <div style={{
              background: estimatedPnL.isWin ? 'rgba(16, 185, 129, 0.12)' : estimatedPnL.isLoss ? 'rgba(244, 63, 94, 0.12)' : 'rgba(99, 102, 241, 0.12)',
              border: `1px solid ${estimatedPnL.isWin ? 'rgba(16, 185, 129, 0.35)' : estimatedPnL.isLoss ? 'rgba(244, 63, 94, 0.35)' : 'rgba(99, 102, 241, 0.35)'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                Calculated Net P&L {estimatedPnL.isForexCategory ? `(${formData.quantity || 1} lot${(parseFloat(formData.quantity) || 1) !== 1 ? 's' : ''})` : ''}:
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: '1rem',
                color: estimatedPnL.isWin ? 'var(--profit)' : estimatedPnL.isLoss ? 'var(--loss)' : 'var(--text-heading)'
              }}>
                {estimatedPnL.pnlText} ({estimatedPnL.pnl_percent}%)
              </span>
            </div>
          )}

          {/* Row 4: Stop Loss, Take Profit, Strategy */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Stop Loss</label>
              <input
                type="number"
                step="any"
                name="stop_loss"
                className="form-input font-mono"
                placeholder="Stop price"
                value={formData.stop_loss}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Take Profit Target</label>
              <input
                type="number"
                step="any"
                name="take_profit"
                className="form-input font-mono"
                placeholder="Target price"
                value={formData.take_profit}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Strategy Setup</label>
                {!isCreatingInlineStrategy && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingInlineStrategy(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#10b981',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={13} /> Add Strategy
                  </button>
                )}
              </div>

              {isCreatingInlineStrategy ? (
                <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                  {inlineStrategyError && (
                    <div style={{ color: '#f43f5e', fontSize: '0.75rem', marginBottom: '6px' }}>
                      {inlineStrategyError}
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Strategy name (e.g. SMT Divergence)"
                    value={inlineStrategyName}
                    onChange={(e) => setInlineStrategyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInlineCreateStrategy();
                      }
                    }}
                    className="form-input"
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', marginBottom: '8px' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleInlineCreateStrategy}
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsCreatingInlineStrategy(false); setInlineStrategyError(''); setInlineStrategyName(''); }}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  name="setup"
                  className="form-select"
                  value={formData.setup}
                  onChange={handleChange}
                >
                  {allStrategies.map((strat, i) => (
                    <option key={i} value={strat}>
                      {strat}
                    </option>
                  ))}
                  <option value="__CREATE_NEW_STRATEGY__" style={{ color: '#10b981', fontWeight: 800 }}>
                    + Create New Strategy...
                  </option>
                </select>
              )}
            </div>
          </div>

          {/* Notes & Reflections */}
          <div className="form-group">
            <label className="form-label">Trade Notes & Reflections</label>
            <textarea
              name="notes"
              className="form-textarea"
              rows={3}
              placeholder="What triggered this entry? Any mistakes or psychological observations?"
              value={formData.notes}
              onChange={handleChange}
            />
          </div>

          {/* Quality Rating */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">Execution Rating (1-5 Stars)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setFormData((prev) => ({ ...prev, rating: String(star) }))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: star <= Number(formData.rating) ? '#f59e0b' : 'var(--text-dim)',
                    transition: 'transform 0.1s ease'
                  }}
                >
                  <Star size={24} fill={star <= Number(formData.rating) ? '#f59e0b' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot Attachments & Dropzone */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Chart Screenshots & Media Attachments</label>

            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
              }}
            >
              <Upload size={32} color="var(--primary)" style={{ marginBottom: '8px' }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
                Click to browse or drag & drop chart images here
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>
                Tip: Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Ctrl + V</kbd> to paste directly from your clipboard!
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
                id="screenshot-input"
              />
              <label htmlFor="screenshot-input" className="btn btn-secondary" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                <ImageIcon size={16} /> Choose Image Files
              </label>
            </div>

            {/* Thumbnail Previews */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
              {/* Existing Screenshots from Server */}
              {existingScreenshots.map((sc) => (
                <div key={sc.id} style={{ position: 'relative', width: '100px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <img src={`/uploads/${sc.filename}`} alt={sc.original_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingFile(sc.id)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(244, 63, 94, 0.9)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              {/* Newly Added Screenshots */}
              {newScreenshots.map((item) => (
                <div key={item.id} style={{ position: 'relative', width: '100px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--primary)' }}>
                  <img src={item.previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => handleRemoveNewFile(item.id)}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(244, 63, 94, 0.9)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

          </div>

          {/* Form Controls */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Record Trade Log'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
