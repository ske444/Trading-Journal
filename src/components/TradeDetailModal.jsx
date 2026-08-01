import React, { useState } from 'react';
import { X, Calendar, Star, Maximize2, Image as ImageIcon, Scale, Target, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function TradeDetailModal({ trade, onClose, onEdit }) {
  if (!trade) return null;

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const isLong = trade.side === 'LONG' || trade.side === 'BUY';
  const isWin = trade.status === 'WIN';
  const isLoss = trade.status === 'LOSS';
  const isOpen = trade.status === 'OPEN';

  const screenshots = trade.screenshots || [];
  const currentImage = screenshots[activeImageIndex] || null;

  // Calculate R:R target ratio if Stop loss and Take Profit exist
  let riskAmount = 0;
  let rewardAmount = 0;
  let rrRatio = 'N/A';

  if (trade.entry_price && trade.stop_loss && trade.take_profit) {
    if (isLong) {
      riskAmount = Math.abs(trade.entry_price - trade.stop_loss);
      rewardAmount = Math.abs(trade.take_profit - trade.entry_price);
    } else {
      riskAmount = Math.abs(trade.stop_loss - trade.entry_price);
      rewardAmount = Math.abs(trade.entry_price - trade.take_profit);
    }
    if (riskAmount > 0) {
      rrRatio = `1 : ${(rewardAmount / riskAmount).toFixed(2)}`;
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '900px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
              {trade.symbol}
            </span>
            <span
              className="badge"
              style={{
                background: isLong ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                color: isLong ? 'var(--profit)' : 'var(--loss)',
                border: `1px solid ${isLong ? 'var(--profit-border)' : 'var(--loss-border)'}`,
                fontSize: '0.8rem'
              }}
            >
              {trade.side}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {trade.asset_class} ({trade.timeframe})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => { onClose(); onEdit(trade); }} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
              Edit Trade
            </button>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Trade KPI Header Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entry Price</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-heading)' }}>
              ${trade.entry_price}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Exit Price</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: trade.exit_price ? 'var(--text-heading)' : 'var(--text-dim)' }}>
              {trade.exit_price ? `$${trade.exit_price}` : 'OPEN'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net PnL</span>
            {isOpen ? (
              <span className="badge badge-open" style={{ marginTop: '4px' }}>OPEN</span>
            ) : (
              <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: isWin ? 'var(--profit)' : isLoss ? 'var(--loss)' : 'var(--text-muted)' }}>
                {trade.pnl >= 0 ? `+$${trade.pnl}` : `-$${Math.abs(trade.pnl)}`}
                <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>({trade.pnl_percent}%)</span>
              </div>
            )}
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Planned R:R</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-heading)' }}>
              {rrRatio}
            </div>
          </div>
        </div>

        {/* Content Layout: Left = Screenshots Gallery, Right = Details & Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: screenshots.length > 0 ? '1.2fr 1fr' : '1fr', gap: '24px' }}>
          
          {/* Screenshots Gallery Section */}
          {screenshots.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
                Chart Screenshot ({activeImageIndex + 1} of {screenshots.length})
              </h4>

              <div style={{ position: 'relative', width: '100%', height: '320px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#000' }}>
                <img
                  src={`/uploads/${currentImage.filename}`}
                  alt={currentImage.original_name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                  onClick={() => setIsLightboxOpen(true)}
                />
                <button
                  onClick={() => setIsLightboxOpen(true)}
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Maximize2 size={14} /> Fullscreen Lightbox
                </button>
              </div>

              {/* Thumbnails list if multiple */}
              {screenshots.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto' }}>
                  {screenshots.map((sc, idx) => (
                    <div
                      key={sc.id}
                      onClick={() => setActiveImageIndex(idx)}
                      style={{
                        width: '70px',
                        height: '50px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: idx === activeImageIndex ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        opacity: idx === activeImageIndex ? 1 : 0.6
                      }}
                    >
                      <img src={`/uploads/${sc.filename}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trade Details & Notes Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Strategy Setup</span>
              <div style={{ marginTop: '4px' }}>
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '4px 12px', fontSize: '0.85rem' }}>
                  {trade.setup || 'General'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stop Loss</span>
                <div className="font-mono" style={{ color: 'var(--loss)', fontWeight: 600 }}>
                  {trade.stop_loss ? `$${trade.stop_loss}` : 'None'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Take Profit</span>
                <div className="font-mono" style={{ color: 'var(--profit)', fontWeight: 600 }}>
                  {trade.take_profit ? `$${trade.take_profit}` : 'None'}
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Execution Rating</span>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={18} fill={star <= trade.rating ? '#f59e0b' : 'none'} color={star <= trade.rating ? '#f59e0b' : 'var(--text-dim)'} />
                ))}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trade Notes & Lessons</span>
              <div style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '6px',
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                whiteSpace: 'pre-wrap',
                minHeight: '100px'
              }}>
                {trade.notes || 'No notes added for this trade execution.'}
              </div>
            </div>

          </div>

        </div>

        {/* Lightbox Overlay */}
        {isLightboxOpen && currentImage && (
          <div
            onClick={() => setIsLightboxOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.95)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px'
            }}
          >
            <button
              onClick={() => setIsLightboxOpen(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={24} />
            </button>
            <img
              src={`/uploads/${currentImage.filename}`}
              alt={currentImage.original_name}
              style={{ maxWidth: '95vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
        )}

      </div>
    </div>
  );
}
