import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C } from './workout/tokens.jsx';
import { api } from '../utils/api.js';

export default function SavePreferencePrompt({ exerciseName, originalExerciseId, chosenExerciseId, onSave, onDismiss }) {
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 10 seconds
    const timer = setTimeout(() => {
      handleDismiss();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/workout/slot/${originalExerciseId}/choose`, { chosen_exercise_id: chosenExerciseId });
      onSave();
    } catch {
      onDismiss();
    } finally {
      setSaving(false);
    }
  }

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 200);
  }

  const content = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s',
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: 'rgba(20,28,50,0.98)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24,
        transform: visible ? 'scale(1)' : 'scale(0.95)',
        transition: 'transform 0.2s ease-out',
      }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: C.text,
          textAlign: 'center', marginBottom: 8,
        }}>
          Save Preference?
        </div>
        <div style={{
          fontSize: 13, color: C.textSec, textAlign: 'center',
          marginBottom: 20, lineHeight: 1.5,
        }}>
          Save <span style={{ color: C.text, fontWeight: 500 }}>{exerciseName}</span> as your preferred exercise for this slot?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1, padding: '12px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: C.textSec,
              fontSize: 14, cursor: 'pointer',
            }}
          >Not now</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '12px', borderRadius: 8, border: 'none',
              background: 'rgba(29,158,117,0.2)', color: C.green,
              fontSize: 14, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >{saving ? 'Saving...' : 'Yes, save'}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
