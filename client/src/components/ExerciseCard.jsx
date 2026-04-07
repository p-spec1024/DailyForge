import { useState, useEffect, useRef } from 'react';
import { C, MONO, GOLD, typeColor, formatExerciseDetail, youtubeSearchUrl, extractVideoId, YTIcon } from './workout/tokens.jsx';

/* ── Exercise Detail Expanded View (view mode only) ── */
function ExerciseDetail({ exercise, onSwap, onReset }) {
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
        if (onSwap) onSwap(exercise);
      }} style={{
        width: '100%', padding: '10px', border: '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 8, background: 'rgba(255,255,255,0.03)',
        color: C.textMuted, fontSize: 12, fontWeight: 400, cursor: 'pointer',
      }}>
        Swap exercise &rarr;
      </button>
      {exercise.original_exercise_id && onReset && (
        <button onClick={(e) => {
          e.stopPropagation();
          onReset(exercise.original_exercise_id);
        }} style={{
          width: '100%', padding: '8px', marginTop: 4,
          border: '1px dashed rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)', borderRadius: 6,
          color: C.textSec, fontSize: 12,
          cursor: 'pointer',
        }}>
          ← Reset to default: {exercise.original_exercise_name}
        </button>
      )}
    </div>
  );
}

/* ── Exercise Row (view mode) ── */
export default function ExerciseRow({ exercise, isExpanded, onToggle, onSwap, onReset }) {
  const color = typeColor(exercise.exercise_type || exercise.type);
  const detail = formatExerciseDetail(exercise);

  return (
    <div>
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 0', cursor: 'pointer',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{exercise.name}</div>
            {exercise.original_exercise_id && (
              <span style={{
                fontSize: 8, color: C.green, background: 'rgba(29,158,117,0.12)',
                borderRadius: 4, padding: '1px 5px', fontWeight: 600,
                letterSpacing: '0.5px', textTransform: 'uppercase',
              }}>SWAPPED</span>
            )}
          </div>
          {detail && (
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: MONO, marginTop: 2 }}>{detail}</div>
          )}
        </div>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      </div>
      {/* Reset to default link — always visible for swapped exercises */}
      {exercise.original_exercise_id && onReset && !isExpanded && (
        <button onClick={(e) => {
          e.stopPropagation();
          onReset(exercise.original_exercise_id);
        }} style={{
          display: 'block', padding: '2px 0 8px', border: 'none',
          background: 'transparent', color: C.textMuted, fontSize: 11,
          cursor: 'pointer', textDecoration: 'underline',
          textDecorationColor: 'rgba(255,255,255,0.15)',
        }}>
          Reset to default: {exercise.original_exercise_name}
        </button>
      )}
      {isExpanded && <ExerciseDetail exercise={exercise} onSwap={onSwap} onReset={onReset} />}
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

/* ── PR Badge (inline, mid-workout) ── */
function PrBadgeInline({ prs }) {
  if (!prs || prs.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', gridColumn: '1 / -1', padding: '2px 4px 4px' }}>
      {prs.map(pr => (
        <span key={pr.type} style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(255,215,0,0.15)', color: GOLD,
          textTransform: 'uppercase',
        }}>
          {'\u{1F3C6}'} {pr.type} PR
        </span>
      ))}
    </div>
  );
}

/* ── Set Row (active session mode) ── */
function SetRow({ setNum, setData, previousSet, prs, onComplete, onWeightChange, onRepsChange, onSetTypeChange, onInputFocus, inputRef }) {
  const [weight, setWeight] = useState(setData?.weight ?? '');
  const [reps, setReps] = useState(setData?.reps ?? '');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const isCompleted = setData?.completed || false;
  const setType = setData?.set_type || 'normal';
  const isWarmup = setType === 'warmup';
  const hasPrs = prs && prs.length > 0;

  useEffect(() => {
    if (setData?.weight != null) setWeight(setData.weight);
    if (setData?.reps != null) setReps(setData.reps);
  }, [setData?.weight, setData?.reps]);

  // Trigger glow animation when PRs appear
  useEffect(() => {
    if (hasPrs) {
      setGlowing(true);
      const timer = setTimeout(() => setGlowing(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasPrs]);

  function handleComplete() {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (w === 0 && r === 0) return;
    onComplete({ weight: w, reps: r, set_type: setType });
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 72px 1fr 1fr 40px',
      gap: 6, alignItems: 'center', padding: '6px 0',
      opacity: isWarmup && !isCompleted ? 0.5 : 1,
      background: hasPrs ? 'rgba(255,215,0,0.06)' : isCompleted ? 'rgba(29,158,117,0.06)' : 'transparent',
      borderRadius: 6, paddingLeft: 4, paddingRight: 4,
      transition: 'background 0.2s, box-shadow 0.3s',
      boxShadow: glowing ? `0 0 12px rgba(255,215,0,0.4), 0 0 24px rgba(255,215,0,0.2)` : 'none',
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

      {/* Previous performance */}
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: MONO, textAlign: 'center', whiteSpace: 'nowrap' }}>
        {previousSet
          ? `${previousSet.weight ?? 0}kg × ${previousSet.reps ?? 0}`
          : '—'}
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
        onFocus={e => { e.target.select(); if (onInputFocus) onInputFocus(); }}
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
        onFocus={e => { e.target.select(); if (onInputFocus) onInputFocus(); }}
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
          background: hasPrs ? 'rgba(255,215,0,0.15)' : isCompleted ? 'rgba(29,158,117,0.2)' : 'rgba(255,255,255,0.06)',
          color: hasPrs ? GOLD : isCompleted ? C.green : C.textMuted,
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
      <PrBadgeInline prs={prs} />
    </div>
  );
}

/* ── Exercise Card (active session mode) ── */
export function ExerciseSessionCard({ exercise, sets, previousData, prData, onLogSet, onInputFocus, onSwap, onReset }) {
  const defaultSetCount = exercise.default_sets || 3;
  const [setCount, setSetCount] = useState(Math.max(defaultSetCount, sets.length));
  const [localSets, setLocalSets] = useState(() => {
    const result = {};
    for (const s of sets) {
      result[s.set_number] = { ...s };
    }
    return result;
  });
  const inputRefs = useRef({});

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

  async function handleComplete(setNum, data) {
    const setData = {
      set_number: setNum,
      weight: data.weight,
      reps: data.reps,
      set_type: data.set_type,
    };
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
        {/* Exercise name + muscle tags + swap */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{exercise.name}</div>
              {exercise.original_exercise_id && (
                <span style={{
                  fontSize: 8, color: C.green, background: 'rgba(29,158,117,0.12)',
                  borderRadius: 4, padding: '1px 5px', fontWeight: 600,
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>SWAPPED</span>
              )}
            </div>
            {onSwap && (
              <button onClick={() => onSwap(exercise)} style={{
                padding: '4px 8px', borderRadius: 6, border: 'none',
                background: 'rgba(255,255,255,0.06)', color: C.textMuted,
                fontSize: 10, cursor: 'pointer',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="16 3 21 3 21 8" />
                  <line x1="4" y1="20" x2="21" y2="3" />
                  <polyline points="21 16 21 21 16 21" />
                  <line x1="15" y1="15" x2="21" y2="21" />
                  <line x1="4" y1="4" x2="9" y2="9" />
                </svg>
              </button>
            )}
          </div>
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

        {/* Reset to default link for swapped exercises */}
        {exercise.original_exercise_id && onReset && (
          <button onClick={(e) => {
            e.stopPropagation();
            onReset(exercise.original_exercise_id);
          }} style={{
            display: 'block', padding: '2px 0 6px', border: 'none',
            background: 'transparent', color: C.textMuted, fontSize: 11,
            cursor: 'pointer', textDecoration: 'underline',
            textDecorationColor: 'rgba(255,255,255,0.15)',
          }}>
            Reset to default: {exercise.original_exercise_name}
          </button>
        )}

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 72px 1fr 1fr 40px',
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
            previousSet={previousData?.sets?.find(s => s.setNumber === setNum) || null}
            prs={prData?.[setNum] || null}
            onComplete={(data) => handleComplete(setNum, data)}
            onWeightChange={(v) => setLocalSets(prev => ({
              ...prev, [setNum]: { ...prev[setNum], weight: v },
            }))}
            onRepsChange={(v) => setLocalSets(prev => ({
              ...prev, [setNum]: { ...prev[setNum], reps: v },
            }))}
            onSetTypeChange={(t) => handleSetTypeChange(setNum, t)}
            onInputFocus={onInputFocus}
            inputRef={el => { inputRefs.current[setNum] = el; }}
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
