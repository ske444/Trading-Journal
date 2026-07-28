import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, TrendingUp, RefreshCw, UserCheck, Layers, PlusCircle } from 'lucide-react';

export default function MT5UploadModal({ isOpen, onClose, onImportSuccess, activeAccount = '' }) {
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importMode, setImportMode] = useState('new_account'); // 'new_account' | 'merge'
  const [customAccountName, setCustomAccountName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setPreviewData(null);
    setImportMode('new_account');
    setCustomAccountName('');
    setErrorMsg('');
    setSuccessMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.html') && !fileName.endsWith('.htm') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      setErrorMsg('Please select a valid MetaTrader 5 report file (.html or .xlsx).');
      return;
    }

    setFile(selectedFile);
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    const parseJsonResponse = async (res) => {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
      const text = await res.text();
      console.error('Server returned non-JSON response:', res.status, text);
      if (res.status === 404) {
        throw new Error('Server endpoint not found (404). Please restart your dev server (`npm run dev`) to load backend routes.');
      }
      throw new Error(`Server returned unexpected error (${res.status}). Please check server logs.`);
    };

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Request preview data first
      const res = await fetch('/api/trades/import-mt5?preview=true', {
        method: 'POST',
        body: formData,
      });

      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse MT5 output file.');
      }

      setPreviewData(data);
      if (data.accountInfo && data.accountInfo.accountName) {
        setCustomAccountName(data.accountInfo.accountName);
      } else {
        setCustomAccountName('MT5 Account');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error processing file preview.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleConfirmImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('importMode', importMode);
      formData.append('targetAccount', activeAccount || 'Default Account');
      formData.append('accountName', customAccountName || 'MT5 Account');

      const res = await fetch('/api/trades/import-mt5', {
        method: 'POST',
        body: formData,
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error('Server error when saving trades. Please restart your dev server (`npm run dev`).');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import trades.');
      }

      const assignedAccountName = data.assignedAccount || (importMode === 'new_account' ? customAccountName : activeAccount);
      let msg = `Successfully imported ${data.importedCount} new trade(s) into "${assignedAccountName}"!`;
      if (data.duplicateCount > 0) {
        msg += ` (${data.duplicateCount} duplicate trade(s) skipped)`;
      }
      setSuccessMsg(msg);

      if (onImportSuccess) {
        await onImportSuccess(assignedAccountName);
      }

      setTimeout(() => {
        handleReset();
        onClose();
      }, 1800);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error saving imported trades.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleReset();
          onClose();
        }
      }}
    >
      <div
        style={{
          background: '#16181d',
          border: '1px solid #282b36',
          borderRadius: '16px',
          maxWidth: '640px',
          width: '100%',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #23262f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#1a1c23',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Upload size={20} color="#10b981" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Upload MetaTrader 5 Report
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#8b92a5', margin: 0 }}>
                Import trades using MT5 output files (.html or .xlsx)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b92a5',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Error Message */}
          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#10b981',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {!previewData ? (
            /* Upload Dropzone */
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? '#10b981' : '#2d313e'}`,
                borderRadius: '14px',
                padding: '40px 20px',
                textAlign: 'center',
                background: isDragOver ? 'rgba(16, 185, 129, 0.05)' : '#12141a',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.xlsx,.xls"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                style={{ display: 'none' }}
              />

              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: '#1a1c23',
                  border: '1px solid #2c303d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '4px',
                }}
              >
                {isLoading ? (
                  <RefreshCw size={24} color="#10b981" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <FileText size={24} color="#10b981" />
                )}
              </div>

              <div>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                  {isLoading ? 'Processing MT5 Report...' : 'Click to select or drag & drop MT5 file'}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#8b92a5', margin: 0 }}>
                  Supports MetaTrader 5 Trade History files: <strong>.html</strong> or <strong>.xlsx</strong>
                </p>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  background: '#1a1c23',
                  border: '1px solid #282b36',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  marginTop: '8px',
                }}
              >
                <span>Example: ReportHistory-114564.html / .xlsx</span>
              </div>
            </div>
          ) : (
            /* Parsed Summary Preview & Import Options */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Selected File Bar */}
              <div
                style={{
                  background: '#1a1c23',
                  border: '1px solid #282b36',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={20} color="#10b981" />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>{file.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#8b92a5' }}>
                      {(file.size / 1024).toFixed(1)} KB • Parsed MT5 Output
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleReset}
                  style={{
                    background: '#232630',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#8b92a5',
                    fontSize: '0.75rem',
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Change File
                </button>
              </div>

              {/* Import Destination Options */}
              <div
                style={{
                  background: '#12141a',
                  border: '1px solid #23262f',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} color="#10b981" /> IMPORT DESTINATION MODE:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Option 1: Import as New Account */}
                  <div
                    onClick={() => setImportMode('new_account')}
                    style={{
                      border: `1px solid ${importMode === 'new_account' ? '#10b981' : '#23262f'}`,
                      background: importMode === 'new_account' ? 'rgba(16, 185, 129, 0.08)' : '#1a1c23',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'new_account'}
                        onChange={() => setImportMode('new_account')}
                        style={{ accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                        Import as New Account
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#8b92a5', margin: 0, paddingLeft: '22px' }}>
                      Creates a separate account tab on navbar.
                    </p>
                  </div>

                  {/* Option 2: Merge on Top of Existing Data */}
                  <div
                    onClick={() => setImportMode('merge')}
                    style={{
                      border: `1px solid ${importMode === 'merge' ? '#10b981' : '#23262f'}`,
                      background: importMode === 'merge' ? 'rgba(16, 185, 129, 0.08)' : '#1a1c23',
                      borderRadius: '10px',
                      padding: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        style={{ accentColor: '#10b981', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ffffff' }}>
                        Merge with Active Data
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#8b92a5', margin: 0, paddingLeft: '22px' }}>
                      Appends trades into "{activeAccount || 'Active Account'}".
                    </p>
                  </div>
                </div>

                {/* Account Name input field when creating new account */}
                {importMode === 'new_account' && (
                  <div style={{ marginTop: '2px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b92a5', marginBottom: '6px', display: 'block' }}>
                      NEW ACCOUNT PROFILE NAME:
                    </label>
                    <input
                      type="text"
                      value={customAccountName}
                      onChange={(e) => setCustomAccountName(e.target.value)}
                      placeholder="e.g. 114564 (Hola Prime)"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        background: '#1a1c23',
                        border: '1px solid #2e3240',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Stats Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div
                  style={{
                    background: '#12141a',
                    border: '1px solid #23262f',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#8b92a5' }}>Total Trades</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>
                    {previewData.totalParsed}
                  </div>
                </div>

                <div
                  style={{
                    background: '#12141a',
                    border: '1px solid #23262f',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#8b92a5' }}>Win Rate</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                    {previewData.winRate}%{' '}
                    <span style={{ fontSize: '0.75rem', color: '#8b92a5', fontWeight: 500 }}>
                      ({previewData.winCount}W / {previewData.lossCount}L)
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    background: '#12141a',
                    border: '1px solid #23262f',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: '#8b92a5' }}>Total Net PnL</span>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: previewData.totalPnL >= 0 ? '#10b981' : '#ef4444',
                      marginTop: '2px',
                    }}
                  >
                    {previewData.totalPnL >= 0 ? '+' : ''}${previewData.totalPnL.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Sample Parsed Trades Preview List */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b92a5', marginBottom: '8px' }}>
                  TRADE PREVIEW (FIRST 5 POSITIONS):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {previewData.trades.slice(0, 5).map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#12141a',
                        border: '1px solid #23262f',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            background: t.side === 'LONG' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: t.side === 'LONG' ? '#10b981' : '#ef4444',
                          }}
                        >
                          {t.side}
                        </span>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{t.symbol}</span>
                        <span style={{ fontSize: '0.75rem', color: '#8b92a5' }}>
                          Vol: {t.quantity} • {(t.exit_date || t.entry_date).split('T')[0]}
                        </span>
                      </div>

                      <div style={{ fontWeight: 700, color: t.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                        {t.pnl >= 0 ? '+' : ''}${t.pnl.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #23262f',
            background: '#1a1c23',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '8px 16px', background: '#232630', border: '1px solid #2e3240' }}
          >
            Cancel
          </button>

          {previewData && (
            <button
              onClick={handleConfirmImport}
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                fontSize: '0.85rem',
                padding: '8px 20px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isLoading ? 'wait' : 'pointer',
              }}
            >
              {isLoading ? (
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <TrendingUp size={16} />
              )}
              {isLoading
                ? 'Importing...'
                : importMode === 'new_account'
                ? `Import into "${customAccountName || 'New Account'}"`
                : `Merge ${previewData.totalParsed} Trades`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
