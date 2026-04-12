import { useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../utils/api.js';
import { C, MONO } from './workout/tokens.jsx';

export default function SaveRoutineModal({ isOpen, onClose, exercises, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a routine name');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: trimmed,
        description: description.trim() || null,
        exercises: exercises.map(ex => ({
          exercise_id: ex.exercise_id || ex.id,
          target_sets: ex.sets_count || ex.default_sets || 3,
          notes: ex.notes || null,
        })),
      };
      const routine = await api.post('/routines', payload);
      onSaved(routine);
    } catch (err) {
      setError(err.userMessage || 'Failed to save routine');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'rgba(20,28,50,0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24,
      }}>
        {/* Header */}
        <div style={{
          fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={C.accent} strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="12" y2="16" />
          </svg>
          Save as Routine
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 12 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: C.textMuted, letterSpacing: '0.5px',
            textTransform: 'uppercase', marginBottom: 6,
          }}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Workout"
            maxLength={100}
            autoFocus
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: C.text, fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Description input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block', fontSize: 11, fontWeight: 600,
            color: C.textMuted, letterSpacing: '0.5px',
            textTransform: 'uppercase', marginBottom: 6,
          }}>Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description"
            maxLength={200}
            style={{
              width: '100%', padding: '10px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: C.text, fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Exercise preview */}
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.textMuted,
            letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8,
          }}>{exercises.length} Exercise{exercises.length !== 1 ? 's' : ''}</div>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '4px 0',
            maxHeight: 160, overflowY: 'auto',
          }}>
            {exercises.map((ex, i) => (
              <div key={ex.exercise_id || ex.id || i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <span style={{ fontSize: 13, color: C.text, flex: 1 }}>
                  {ex.name}
                </span>
                <span style={{
                  fontSize: 11, color: C.textMuted, fontFamily: MONO,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {ex.sets_count || ex.default_sets || 3} sets
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            fontSize: 12, color: '#ef4444', marginBottom: 12,
            padding: '8px 10px', background: 'rgba(239,68,68,0.1)',
            borderRadius: 6,
          }}>{error}</div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{
            flex: 1, padding: '12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: C.textSec,
            fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: 'none',
            background: saving ? 'rgba(216,90,48,0.15)' : 'rgba(216,90,48,0.2)',
            color: C.accent,
            fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1, transition: 'opacity 0.2s',
          }}>{saving ? 'Saving...' : 'Save Routine'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
