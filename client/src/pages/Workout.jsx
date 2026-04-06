import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api.js';
import { useData } from '../contexts/DataProvider.jsx';
import { useWorkoutSession } from '../hooks/useWorkoutSession.js';

/* ── Design tokens ── */
const C = {
  bg: '#0c1222',
  card: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.06)',
  text: 'rgba(255,255,255,0.95)',
  textSec: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',
  textHint: 'rgba(255,255,255,0.2)',
  accent: '#D85A30',
  green: '#1D9E75',
};

const MONO = "'SF Mono', 'Fira Code', monospace";
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/* ── Helpers ── */
function typeColor(type) {
  if (!type) return '#D85A30';
  const t = type.toLowerCase();
  if (t === 'strength') return '#D85A30';
  if (t === 'yoga') return '#1D9E75';
  if (t === 'breathwork') return '#a78bfa';
  if (t === 'cardio') return '#F9CB40';
  if (t === 'stretch' || t === 'mobility') return '#5DCAA5';
  return '#D85A30';
}

function formatExerciseDetail(ex) {
  const parts = [];
  if (ex.default_sets && ex.default_reps) parts.push(`${ex.default_sets} \u00d7 ${ex.default_reps}`);
  else if (ex.default_sets) parts.push(`${ex.default_sets} sets`);
  else if (ex.default_reps) parts.push(`\u00d7${ex.default_reps}`);
  if (ex.default_duration_secs) {
    const m = Math.floor(ex.default_duration_secs / 60);
    const s = ex.default_duration_secs % 60;
    parts.push(m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`);
  }
  return parts.join(' \u00b7 ') || null;
}

function youtubeSearchUrl(name, type) {
  const n = encodeURIComponent(name).replace(/%20/g, '+');
  const t = (type || '').toLowerCase();
  if (t === 'yoga') return `https://www.youtube.com/results?search_query=${n}+yoga+pose+tutorial`;
  if (t === 'breathwork') return `https://www.youtube.com/results?search_query=${n}+breathing+technique`;
  if (t === 'strength') return `https://www.youtube.com/results?search_query=${n}+dumbbell+exercise+form`;
  if (t === 'stretch' || t === 'mobility') return `https://www.youtube.com/results?search_query=${n}+stretch+tutorial`;
  if (t === 'cardio') return `https://www.youtube.com/results?search_query=${n}+exercise+tutorial`;
  return `https://www.youtube.com/results?search_query=${n}+exercise+tutorial`;
}

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function formatVolume(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

function isStrengthPhase(phase) {
  return phase.phase === 'main';
}

/* ── YouTube play icon SVG ── */
const YTIcon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
    <rect width="20" height="14" rx="3" fill="#FF0000" />
    <polygon points="8,3 8,11 14,7" fill="#fff" />
  </svg>
);

/* ── Exercise Detail Expanded View (view mode only) ── */
function ExerciseDetail({ exercise }) {
  const muscles = exercise.target_muscles
    ? exercise.target_muscles.split(',').map(m => m.trim()).filter(Boolean)
    : [];
  const realUrl = exercise.url;
  const videoId = extractVideoId(realUrl);

  return (
    <div style={{ padding: '12px 0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {muscles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {muscles.map(m => (
            <span key={m} style={{
              fontSize: 10, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '3px 8px',
            }}>{m}</span>
          ))}
        </div>
      )}
      <div>
        <div style={{
          fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '1.5px', color: C.textMuted, marginBottom: 6,
        }}>HOW TO DO IT</div>
        {exercise.description ? (
          <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>{exercise.description}</div>
        ) : (
          <div style={{ fontSize: 12, color: C.textHint, fontStyle: 'italic' }}>No instructions added yet</div>
        )}
      </div>
      {realUrl && videoId ? (
        <div>
          <div onClick={() => window.open(realUrl, '_blank', 'noopener')} style={{
            height: 160, borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
            background: C.card, border: C.border, position: 'relative',
          }}>
            <img src={`https://img.youtube.com/vi/${videoId}/0.jpg`} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6,
            }} />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
          <button onClick={() => window.open(realUrl, '_blank', 'noopener')} style={{
            width: '100%', padding: '10px', borderRadius: 10, marginTop: 6,
            background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
            color: C.textSec, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <YTIcon /> Watch video
          </button>
        </div>
      ) : (
        <button onClick={() => window.open(youtubeSearchUrl(exercise.name, exercise.exercise_type || exercise.type), '_blank', 'noopener')} style={{
          width: '100%', padding: '10px', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
          color: C.textSec, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        >
          <YTIcon /> Watch on YouTube
        </button>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {exercise.difficulty && (
          <span style={{
            fontSize: 10, color: C.textMuted, background: C.card, borderRadius: 6, padding: '3px 8px',
          }}>{exercise.difficulty}</span>
        )}
        {exercise.exercise_type && (
          <span style={{
            fontSize: 10, color: typeColor(exercise.exercise_type),
            background: C.card, borderRadius: 6, padding: '3px 8px',
          }}>{exercise.exercise_type}</span>
        )}
        {exercise.source && (
          <span style={{
            fontSize: 10, color: C.textMuted, background: C.card, borderRadius: 6, padding: '3px 8px',
          }}>{exercise.source}</span>
        )}
      </div>
      <button onClick={(e) => {
        e.stopPropagation();
        const toast = document.createElement('div');
        toast.textContent = 'Exercise alternatives coming soon';
        Object.assign(toast.style, {
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)',
          padding: '8px 16px', borderRadius: '8px', fontSize: '12px', zIndex: '999',
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      }} style={{
        width: '100%', padding: '10px', border: '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 8, background: 'rgba(255,255,255,0.03)',
        color: C.textMuted, fontSize: 12, fontWeight: 400, cursor: 'pointer',
      }}>
        Swap exercise &rarr;
      </button>
    </div>
  );
}

/* ── Exercise Row (view mode) ── */
function ExerciseRow({ exercise, isExpanded, onToggle }) {
  const color = typeColor(exercise.exercise_type || exercise.type);
  const detail = formatExerciseDetail(exercise);

  return (
    <div>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0', cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{exercise.name}</div>
          {detail && (
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: MONO, marginTop: 2 }}>{detail}</div>
          )}
        </div>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      </div>
      {isExpanded && <ExerciseDetail exercise={exercise} />}
    </div>
  );
}

/* ── Set Type Labels ── */
const SET_TYPE_LABELS = {
  normal: '',
  warmup: 'W',
  dropset: 'D',
  failure: 'F',
};

const SET_TYPES = ['normal', 'warmup', 'dropset', 'failure'];

/* ── Set Row (active session mode) ── */
function SetRow({ setNum, setData, onComplete, onWeightChange, onRepsChange, onSetTypeChange, inputRef }) {
  const [weight, setWeight] = useState(setData?.weight ?? '');
  const [reps, setReps] = useState(setData?.reps ?? '');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const isCompleted = setData?.completed || false;
  const setType = setData?.set_type || 'normal';
  const isWarmup = setType === 'warmup';

  // Sync from parent state when setData changes (e.g. resume)
  useEffect(() => {
    if (setData?.weight != null) setWeight(setData.weight);
    if (setData?.reps != null) setReps(setData.reps);
  }, [setData?.weight, setData?.reps]);

  function handleComplete() {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (w === 0 && r === 0) return; // don't allow empty sets
    onComplete({ weight: w, reps: r, set_type: setType });
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 64px 1fr 1fr 40px',
      gap: 6, alignItems: 'center', padding: '6px 0',
      opacity: isWarmup && !isCompleted ? 0.5 : 1,
      background: isCompleted ? 'rgba(29,158,117,0.06)' : 'transparent',
      borderRadius: 6, paddingLeft: 4, paddingRight: 4,
      transition: 'background 0.2s',
    }}>
      {/* Set number with type selector */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          style={{
            width: 44, height: 44, borderRadius: 6, border: 'none',
            background: isCompleted ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.06)',
            color: isCompleted ? C.green : C.textSec,
            fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: 'pointer',
          }}
        >
          {SET_TYPE_LABELS[setType] || setNum}
        </button>
        {showTypeMenu && (
          <div style={{
            position: 'absolute', top: 34, left: 0, zIndex: 10,
            background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, overflow: 'hidden', minWidth: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {SET_TYPES.map(t => (
              <button key={t} onClick={() => { onSetTypeChange(t); setShowTypeMenu(false); }} style={{
                display: 'block', width: '100%', padding: '8px 12px', border: 'none',
                background: t === setType ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: C.text, fontSize: 12, textAlign: 'left', cursor: 'pointer',
              }}>
                {t === 'normal' ? 'Normal' : t === 'warmup' ? 'Warm-up' : t === 'dropset' ? 'Drop Set' : 'Failure'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Previous (dashes for now — Ticket 5) */}
      <div style={{ fontSize: 11, color: C.textHint, fontFamily: MONO, textAlign: 'center' }}>
        — x —
      </div>

      {/* Weight input */}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={weight}
        onChange={e => {
          setWeight(e.target.value);
          onWeightChange(e.target.value);
        }}
        onFocus={e => e.target.select()}
        placeholder="kg"
        style={{
          height: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
          background: isCompleted ? 'rgba(29,158,117,0.08)' : 'rgba(255,255,255,0.04)',
          color: C.text, fontSize: 15, fontFamily: MONO, textAlign: 'center',
          outline: 'none', width: '100%',
        }}
      />

      {/* Reps input */}
      <input
        type="text"
        inputMode="numeric"
        value={reps}
        onChange={e => {
          setReps(e.target.value);
          onRepsChange(e.target.value);
        }}
        onFocus={e => e.target.select()}
        placeholder="reps"
        style={{
          height: 44, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
          background: isCompleted ? 'rgba(29,158,117,0.08)' : 'rgba(255,255,255,0.04)',
          color: C.text, fontSize: 15, fontFamily: MONO, textAlign: 'center',
          outline: 'none', width: '100%',
        }}
      />

      {/* Checkmark button */}
      <button
        onClick={handleComplete}
        style={{
          width: 40, height: 40, borderRadius: 8, border: 'none',
          background: isCompleted ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.06)',
          color: isCompleted ? C.green : C.textMuted,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  );
}

/* ── Exercise Card (active session mode) ── */
function ExerciseSessionCard({ exercise, sets, onLogSet, nextSetRef }) {
  const defaultSetCount = exercise.default_sets || 3;
  const [setCount, setSetCount] = useState(Math.max(defaultSetCount, sets.length));
  const [localSets, setLocalSets] = useState(() => {
    // Initialize local set data for inputs
    const result = {};
    for (const s of sets) {
      result[s.set_number] = { ...s };
    }
    return result;
  });
  const inputRefs = useRef({});

  // Sync when sets change from parent (e.g. resume)
  useEffect(() => {
    setLocalSets(prev => {
      const next = { ...prev };
      for (const s of sets) {
        next[s.set_number] = { ...s };
      }
      return next;
    });
    if (sets.length > setCount) setSetCount(sets.length);
  }, [sets]);

  const color = typeColor(exercise.exercise_type || exercise.type);
  const muscles = exercise.target_muscles
    ? exercise.target_muscles.split(',').map(m => m.trim()).filter(Boolean)
    : [];

  // Find first incomplete set for auto-focus ref
  const firstIncompleteSet = (() => {
    for (let i = 1; i <= setCount; i++) {
      if (!localSets[i]?.completed) return i;
    }
    return null;
  })();

  async function handleComplete(setNum, data) {
    const setData = {
      set_number: setNum,
      weight: data.weight,
      reps: data.reps,
      set_type: data.set_type,
    };
    // Only mark completed after server confirms — prevents data loss on network failure
    const result = await onLogSet(exercise.id, setData);
    if (result) {
      setLocalSets(prev => ({
        ...prev,
        [setNum]: { ...prev[setNum], ...setData, completed: true },
      }));
    }
  }

  function handleSetTypeChange(setNum, newType) {
    setLocalSets(prev => ({
      ...prev,
      [setNum]: { ...prev[setNum], set_type: newType },
    }));
  }

  return (
    <div style={{
      background: C.card, border: C.border, borderRadius: 10,
      borderTop: `2px solid ${color}`,
      marginBottom: 6, overflow: 'hidden',
    }}>
      <div style={{ padding: 12 }}>
        {/* Exercise name + muscle tags */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{exercise.name}</div>
          {muscles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {muscles.map(m => (
                <span key={m} style={{
                  fontSize: 9, color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 6px',
                }}>{m}</span>
              ))}
            </div>
          )}
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 64px 1fr 1fr 40px',
          gap: 6, padding: '4px 4px', marginBottom: 2,
        }}>
          {['SET', 'PREVIOUS', 'KG', 'REPS', ''].map((h, i) => (
            <div key={i} style={{
              fontSize: 9, fontWeight: 600, color: C.textMuted,
              letterSpacing: '1px', textAlign: 'center',
            }}>{h}</div>
          ))}
        </div>

        {/* Set rows */}
        {Array.from({ length: setCount }, (_, i) => i + 1).map(setNum => (
          <SetRow
            key={setNum}
            setNum={setNum}
            setData={localSets[setNum]}
            onComplete={(data) => handleComplete(setNum, data)}
            onWeightChange={(v) => setLocalSets(prev => ({
              ...prev, [setNum]: { ...prev[setNum], weight: v },
            }))}
            onRepsChange={(v) => setLocalSets(prev => ({
              ...prev, [setNum]: { ...prev[setNum], reps: v },
            }))}
            onSetTypeChange={(t) => handleSetTypeChange(setNum, t)}
            inputRef={el => {
              inputRefs.current[setNum] = el;
              if (setNum === firstIncompleteSet && nextSetRef) {
                nextSetRef.current = el;
              }
            }}
          />
        ))}

        {/* Add Set button */}
        <button
          onClick={() => setSetCount(prev => prev + 1)}
          style={{
            width: '100%', padding: '8px', marginTop: 4, borderRadius: 6,
            border: '1px dashed rgba(255,255,255,0.08)', background: 'transparent',
            color: C.textMuted, fontSize: 12, cursor: 'pointer',
          }}
        >
          + Add Set
        </button>
      </div>
    </div>
  );
}

/* ── Phase Checkbox (non-strength phases in active mode) ── */
function PhaseCheckbox({ phase, checked, onToggle }) {
  return (
    <div style={{
      background: C.card, border: C.border, borderRadius: 10,
      borderTop: `2px solid ${phase.color}`,
      marginBottom: 6, overflow: 'hidden',
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: 14, display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          border: checked ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
          background: checked ? 'rgba(29,158,117,0.2)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {checked && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={C.green} strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 500,
            color: checked ? C.green : C.text,
            textDecoration: checked ? 'line-through' : 'none',
          }}>
            Complete {phase.label.toLowerCase()}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
            {phase.duration_min} min &middot; {phase.exercises.length} exercise{phase.exercises.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Session Timer Bar ── */
function SessionBar({ elapsed, totalVolume, onFinish, onDiscard, formatTime, isFinishing }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: 'rgba(12,18,34,0.95)', backdropFilter: 'blur(12px)',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      padding: '10px 0', marginBottom: 12, marginTop: -4,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Timer */}
          <div style={{
            fontSize: 20, fontFamily: MONO, fontWeight: 600, color: C.accent,
            letterSpacing: '1px',
          }}>
            {formatTime(elapsed)}
          </div>
          {/* Volume */}
          <div style={{ fontSize: 12, color: C.textSec }}>
            <span style={{ fontFamily: MONO, fontWeight: 500 }}>{formatVolume(totalVolume)}</span> kg
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu(!showMenu)} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: C.textMuted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', top: 36, right: 0, zIndex: 30,
                background: '#1a2235', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, overflow: 'hidden', minWidth: 150,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}>
                <button onClick={() => { setShowMenu(false); onDiscard(); }} style={{
                  display: 'block', width: '100%', padding: '10px 14px', border: 'none',
                  background: 'transparent', color: '#ef4444', fontSize: 13,
                  textAlign: 'left', cursor: 'pointer',
                }}>
                  Discard workout
                </button>
              </div>
            )}
          </div>

          {/* Finish button */}
          <button onClick={onFinish} disabled={isFinishing} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'rgba(29,158,117,0.2)', color: C.green,
            fontSize: 13, fontWeight: 600, cursor: isFinishing ? 'default' : 'pointer',
            opacity: isFinishing ? 0.5 : 1, transition: 'opacity 0.2s',
          }}>
            {isFinishing ? 'Finishing...' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Workout Summary Card ── */
function SummaryCard({ data, onDone }) {
  if (!data) return null;
  const { session, summary } = data;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 360,
        background: 'rgba(20,28,50,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 28, textAlign: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '2px',
          color: C.green, textTransform: 'uppercase', marginBottom: 8,
        }}>WORKOUT COMPLETE</div>

        <div style={{ fontSize: 32, marginBottom: 20 }}>&#127881;</div>

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
        }}>
          {[
            { label: 'Duration', value: summary.duration_formatted },
            { label: 'Volume', value: `${formatVolume(summary.total_volume)} kg` },
            { label: 'Sets', value: String(summary.total_sets) },
            { label: 'Exercises', value: String(summary.exercises_completed) },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 8px',
            }}>
              <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 20, fontFamily: MONO, fontWeight: 600, color: C.text }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Exercise list */}
        {summary.exercises && summary.exercises.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12,
            }} />
            <div style={{
              fontSize: 10, fontWeight: 600, color: C.textMuted,
              letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8, textAlign: 'left',
            }}>Exercises completed</div>
            {summary.exercises.map(ex => (
              <div key={ex.exercise_id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 0', fontSize: 13,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={C.green} strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span style={{ color: C.text, flex: 1, textAlign: 'left' }}>{ex.name}</span>
                <span style={{ color: C.textMuted, fontSize: 12, fontFamily: MONO }}>
                  {ex.sets} set{ex.sets !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onDone} style={{
          width: '100%', padding: '14px', borderRadius: 10, border: 'none',
          background: 'rgba(29,158,117,0.2)', color: C.green,
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ── */
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 320,
        background: 'rgba(20,28,50,0.98)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 20 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: C.textSec, fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '12px', borderRadius: 8, border: 'none',
            background: confirmColor || 'rgba(29,158,117,0.2)',
            color: confirmColor ? '#fff' : C.green,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Resume Banner ── */
function ResumeBanner({ session, onResume, onDiscard }) {
  const time = new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{
      background: 'rgba(216,90,48,0.1)', border: '1px solid rgba(216,90,48,0.2)',
      borderRadius: 10, padding: 14, marginBottom: 12,
    }}>
      <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>
        You have an unfinished workout from {time}.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onResume} style={{
          flex: 1, padding: '10px', borderRadius: 8, border: 'none',
          background: 'rgba(216,90,48,0.2)', color: C.accent,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Resume</button>
        <button onClick={onDiscard} style={{
          flex: 1, padding: '10px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
          color: C.textMuted, fontSize: 13, cursor: 'pointer',
        }}>Discard</button>
      </div>
    </div>
  );
}

/* ── Phase Section (view mode) ── */
function PhaseSection({ phase, expandedId, onToggleExpand }) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      background: C.card, border: C.border, borderRadius: 10,
      borderTop: `2px solid ${phase.color}`,
      marginBottom: 6, overflow: 'hidden',
    }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: 12, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '1.5px', color: phase.color,
        }}>
          {phase.label} &middot; {phase.duration_min} min
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.textMuted} strokeWidth="1.5"
          style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
          <polyline points="2,3 5,7 8,3" />
        </svg>
      </div>
      {open && (
        <div style={{ padding: '0 12px 8px' }}>
          {phase.exercises.map((ex, i) => (
            <ExerciseRow
              key={ex.id || `${ex.name}-${i}`}
              exercise={ex}
              isExpanded={expandedId === (ex.id || `${ex.name}-${i}`)}
              onToggle={() => onToggleExpand(ex.id || `${ex.name}-${i}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Phase Bar ── */
function PhaseBar({ phases }) {
  const totalDuration = phases.reduce((s, p) => s + p.duration_min, 0);
  if (totalDuration === 0) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 2 }}>
        {phases.map((p, i) => (
          <div key={i} style={{
            flex: p.duration_min / totalDuration, background: p.color, borderRadius: 2,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
        {phases.map((p, i) => (
          <div key={i} style={{
            flex: p.duration_min / totalDuration,
            fontSize: 9, color: p.color, textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {p.label.toLowerCase().replace('opening ', '').replace('closing ', '')}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Today's Workout View ── */
function TodayView({ onLogout }) {
  const { workoutData: workout, workoutLoading: loading, fetchWorkout, invalidateWorkout } = useData();
  const [expandedId, setExpandedId] = useState(null);
  const [completedPhases, setCompletedPhases] = useState({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [startDisabled, setStartDisabled] = useState(false);
  const nextSetRef = useRef(null);

  const session = useWorkoutSession();

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  // Check for active session on mount
  useEffect(() => {
    session.checkActiveSession();
  }, [session.checkActiveSession]);

  async function handleStart() {
    if (!workout || !workout.phases || startDisabled) return;
    setStartDisabled(true);
    const workoutIds = workout.phases.map(p => p.workout_id).filter(Boolean);
    await session.startSession(workoutIds[0], workoutIds);
    setStartDisabled(false);
  }

  async function handleLogSet(exerciseId, setData) {
    const result = await session.logSet(exerciseId, setData);
    if (result) {
      // Scroll next incomplete set into view after a tick
      setTimeout(() => {
        if (nextSetRef.current) {
          nextSetRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nextSetRef.current.focus();
        }
      }, 100);
    }
    return result;
  }

  async function handleFinish() {
    if (session.isLoading) return;
    setConfirmFinish(false);
    const data = await session.completeSession();
    if (data) {
      setSummaryData(data);
      invalidateWorkout();
    }
  }

  async function handleDiscard() {
    setConfirmDiscard(false);
    await session.discardSession();
  }

  async function handleDiscardResume() {
    await session.dismissResume();
  }

  function toggleExpand(id) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  const now = new Date();
  const dayName = DAY_NAMES[now.getDay()];

  if (loading) {
    return (
      <div>
        <div style={{ height: 10, width: 80, borderRadius: 4, background: C.card, marginBottom: 8 }} />
        <div style={{ height: 20, width: 160, borderRadius: 6, background: C.card, marginBottom: 6 }} />
        <div style={{ height: 14, width: 120, borderRadius: 4, background: C.card, marginBottom: 24 }} />
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 64, borderRadius: 10, background: C.card, marginBottom: 6 }} />
        ))}
      </div>
    );
  }

  if (!workout || !workout.phases || workout.phases.length === 0) {
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', color: C.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>
          {dayName}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>Rest Day</h2>
        <div style={{ textAlign: 'center', padding: '48px 16px', color: C.textSec }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 18a5 5 0 00-10 0" /><line x1="12" y1="9" x2="12" y2="2" />
              <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" /><line x1="1" y1="18" x2="3" y2="18" />
              <line x1="21" y1="18" x2="23" y2="18" /><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
            </svg>
          </div>
          <p style={{ fontSize: 14 }}>No workout scheduled for today.</p>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Recovery is part of the process.</p>
        </div>
      </div>
    );
  }

  const totalDuration = workout.phases.reduce((s, p) => s + p.duration_min, 0);
  const totalExercises = workout.phases.reduce((s, p) => s + p.exercises.length, 0);

  /* ─── ACTIVE SESSION MODE ─── */
  if (session.isActive) {
    return (
      <div style={{ paddingBottom: 40 }}>
        {/* Session bar (timer + volume + finish) */}
        <SessionBar
          elapsed={session.elapsedSeconds}
          totalVolume={session.totalVolume}
          onFinish={() => setConfirmFinish(true)}
          onDiscard={() => setConfirmDiscard(true)}
          formatTime={session.formatTime}
          isFinishing={session.isLoading}
        />

        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
          }}>{dayName}</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>
            {workout.name}
          </h2>
          <div style={{ fontSize: 12, color: C.textSec }}>
            {session.totalSets} sets &middot; {formatVolume(session.totalVolume)} kg &middot; {session.exercisesDone} exercises
          </div>
        </div>

        {/* Phases */}
        {workout.phases.map((phase, i) => {
          if (isStrengthPhase(phase)) {
            // Main workout — show set logging cards
            return (
              <div key={phase.phase || i}>
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
                  color: phase.color, textTransform: 'uppercase',
                  padding: '8px 0 4px',
                }}>
                  {phase.label}
                </div>
                {phase.exercises.map(ex => {
                  const exSets = session.exerciseSets[ex.id]?.sets || [];
                  return (
                    <ExerciseSessionCard
                      key={ex.id}
                      exercise={ex}
                      sets={exSets}
                      onLogSet={handleLogSet}
                      nextSetRef={nextSetRef}
                    />
                  );
                })}
              </div>
            );
          } else {
            // Non-strength phase — show as checkbox
            return (
              <PhaseCheckbox
                key={phase.phase || i}
                phase={phase}
                checked={!!completedPhases[phase.phase]}
                onToggle={() => setCompletedPhases(prev => ({
                  ...prev, [phase.phase]: !prev[phase.phase],
                }))}
              />
            );
          }
        })}

        {/* Finish Workout button (sticky at bottom) */}
        <div style={{
          position: 'sticky', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))', zIndex: 15, paddingTop: 12,
        }}>
          <button onClick={() => setConfirmFinish(true)} style={{
            width: '100%', padding: '16px', borderRadius: 12,
            background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.25)',
            color: C.green, fontSize: 16, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            backdropFilter: 'blur(8px)',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Finish Workout
          </button>
        </div>

        {/* Confirm finish dialog */}
        {confirmFinish && (
          <ConfirmDialog
            title="Finish this workout?"
            message="Your session will be saved with all logged sets."
            confirmLabel="Finish"
            onConfirm={handleFinish}
            onCancel={() => setConfirmFinish(false)}
          />
        )}

        {/* Confirm discard dialog */}
        {confirmDiscard && (
          <ConfirmDialog
            title="Discard this workout?"
            message="All logged sets will be lost. This cannot be undone."
            confirmLabel="Discard"
            confirmColor="rgba(239,68,68,0.3)"
            onConfirm={handleDiscard}
            onCancel={() => setConfirmDiscard(false)}
          />
        )}

        {/* Summary card */}
        {summaryData && (
          <SummaryCard
            data={summaryData}
            onDone={() => {
              setSummaryData(null);
              // Reset all session state is already handled by completeSession
            }}
          />
        )}
      </div>
    );
  }

  /* ─── VIEW MODE (no active session) ─── */
  return (
    <div>
      {/* Resume banner */}
      {session.resumeData && (
        <ResumeBanner
          session={session.resumeData.session}
          onResume={session.resumeSession}
          onDiscard={handleDiscardResume}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
          }}>{dayName}</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, marginBottom: 4 }}>
            {workout.name}
          </h2>
          <div style={{ fontSize: 12, color: C.textSec }}>
            {totalDuration} min &middot; {totalExercises} exercises
          </div>
        </div>
        {onLogout && (
          <button onClick={onLogout} style={{
            background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: C.textMuted,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>

      {/* Phase Bar */}
      <PhaseBar phases={workout.phases} />

      {/* Phase Sections */}
      {workout.phases.map((phase, i) => (
        <PhaseSection
          key={phase.phase || i}
          phase={phase}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
        />
      ))}

      {/* Start Workout (sticky at bottom) */}
      <div style={{
        position: 'sticky', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))', zIndex: 15, paddingTop: 12,
      }}>
        <button
          onClick={handleStart}
          disabled={startDisabled}
          style={{
            width: '100%', padding: '16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 16, fontWeight: 600, cursor: startDisabled ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            backdropFilter: 'blur(8px)',
            opacity: startDisabled ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          {startDisabled ? (
            <>Starting...</>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Start Workout
            </>
          )}
        </button>
      </div>

      {/* Summary card (shows after completing via summary) */}
      {summaryData && (
        <SummaryCard data={summaryData} onDone={() => setSummaryData(null)} />
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function Workout({ onLogout }) {
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
      <TodayView onLogout={onLogout} />
    </div>
  );
}
