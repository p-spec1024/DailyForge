import { useState, useEffect } from 'react';
import { api } from '../utils/api.js';
import { useData } from '../contexts/DataProvider.jsx';
import ExerciseLibrary from '../components/ExerciseLibrary.jsx';
import { YOGA_LIBRARY, DUMBBELL_LIBRARY, BREATHWORK_LIBRARY, STRETCHING_LIBRARY } from '../data/exercise-library.js';

/* ── Design tokens ── */
const C = {
  bg: '#0c1222',
  card: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.06)',
  text: 'rgba(255,255,255,0.95)',
  textSec: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',
  textHint: 'rgba(255,255,255,0.2)',
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

/* ── YouTube play icon SVG ── */
const YTIcon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
    <rect width="20" height="14" rx="3" fill="#FF0000" />
    <polygon points="8,3 8,11 14,7" fill="#fff" />
  </svg>
);

/* ── Exercise Detail Expanded View ── */
function ExerciseDetail({ exercise }) {
  const muscles = exercise.target_muscles
    ? exercise.target_muscles.split(',').map(m => m.trim()).filter(Boolean)
    : [];
  const realUrl = exercise.url;
  const videoId = extractVideoId(realUrl);

  return (
    <div style={{ padding: '12px 0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Muscle tags */}
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

      {/* How to do it */}
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

      {/* Video area */}
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

      {/* Info pills */}
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

      {/* Swap button */}
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

/* ── Exercise Row ── */
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

/* ── Phase Section ── */
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
  const [session, setSession] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  async function startSession() {
    if (!workout || !workout.phases) return;
    try {
      const workoutIds = workout.phases.map(p => p.workout_id).filter(Boolean);
      const s = await api.post('/session/start', { workout_ids: workoutIds, workout_id: workoutIds[0] });
      setSession(s);
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  }

  async function completeSession() {
    try {
      await api.put(`/session/${session.id}/complete`);
      setSession(prev => ({ ...prev, completed_at: new Date().toISOString() }));
      invalidateWorkout();
    } catch (err) {
      console.error('Failed to complete session:', err);
    }
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

  return (
    <div>
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

      {/* Start / Complete Session */}
      <div style={{ marginTop: 12 }}>
        {!session && (
          <button onClick={startSession} style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer',
            transition: 'background 0.2s, transform 0.1s',
          }}>
            Start session
          </button>
        )}
        {session && !session.completed_at && (
          <button onClick={completeSession} style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 15, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Complete session
          </button>
        )}
        {session?.completed_at && (
          <div style={{
            textAlign: 'center', padding: 14, borderRadius: 10,
            background: 'rgba(29,158,117,0.1)',
            border: '0.5px solid rgba(29,158,117,0.2)',
            color: '#1D9E75', fontSize: 14, fontWeight: 500,
          }}>
            Session complete
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-tab definitions ── */
const TABS = [
  { key: 'today', label: 'Today', color: '#D85A30' },
  { key: 'yoga', label: 'Yoga', color: '#1D9E75' },
  { key: 'dumbbell', label: 'Dumbbell', color: '#D85A30' },
  { key: 'breathwork', label: 'Breathwork', color: '#a78bfa' },
  { key: 'stretching', label: 'Stretching', color: '#5DCAA5' },
];

/* ── Main Component with Tabs ── */
export default function Workout({ onLogout }) {
  const [activeTab, setActiveTab] = useState('today');

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              whiteSpace: 'nowrap', cursor: 'pointer',
              background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
              border: isActive ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid transparent',
              color: isActive ? tab.color : C.textMuted,
              transition: 'all 0.2s',
            }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'today' && <TodayView onLogout={onLogout} />}
      {activeTab === 'yoga' && <ExerciseLibrary exercises={YOGA_LIBRARY} accentColor="#1D9E75" />}
      {activeTab === 'dumbbell' && <ExerciseLibrary exercises={DUMBBELL_LIBRARY} accentColor="#D85A30" />}
      {activeTab === 'breathwork' && <ExerciseLibrary exercises={BREATHWORK_LIBRARY} accentColor="#a78bfa" />}
      {activeTab === 'stretching' && <ExerciseLibrary exercises={STRETCHING_LIBRARY} accentColor="#5DCAA5" />}
    </div>
  );
}
