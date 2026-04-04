import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api.js';

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

const CAT_COLORS = {
  health: '#D85A30',
  learning: '#1D9E75',
  mindfulness: '#a78bfa',
  personal: '#F9CB40',
};

const CATS = ['health', 'learning', 'mindfulness', 'personal'];
const MONO = "'SF Mono', 'Fira Code', monospace";

function getIncrement(unit) {
  if (unit === 'L' || unit === 'hr') return 0.5;
  if (unit === 'min') return 5;
  return 1;
}

function getMessage(done, total) {
  if (total === 0) return 'Add habits to get started.';
  const pct = done / total;
  if (pct >= 1) return 'Perfect day. Every habit crushed.';
  if (pct >= 0.7) return 'Strong progress. Keep pushing.';
  if (pct >= 0.4) return 'Good start. Finish what you started.';
  return 'New day, fresh start.';
}

/* ── Progress Ring ── */
function ProgressRing({ done, total }) {
  const size = 64;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  const offset = circ * (1 - pct);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '16px 0', marginBottom: 16,
    }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="#D85A30" strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, lineHeight: 1 }}>{done}</span>
          <span style={{ fontSize: 10, color: C.textMuted, fontFamily: MONO }}>/{total}</span>
        </div>
      </div>
      <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
        {getMessage(done, total)}
      </div>
    </div>
  );
}

/* ── Circular Checkbox ── */
function Checkbox({ checked, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
      border: checked ? 'none' : `1.5px solid rgba(255,255,255,0.15)`,
      background: checked ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'all 0.2s',
    }}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

/* ── Quantity Controls (inline expanded) ── */
function QtyControls({ value, target, unit, color, onChange }) {
  const inc = getIncrement(unit);
  const pct = target ? Math.min((value / target) * 100, 100) : 0;
  const display = Number.isInteger(value) ? value : value.toFixed(1);
  const targetDisplay = target ? (Number.isInteger(target) ? target : target.toFixed(1)) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, paddingBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <button onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - inc)); }}
          style={{
            width: 28, height: 28, borderRadius: '50%', padding: 0,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>&minus;</button>
        <span style={{
          fontFamily: MONO, fontSize: 13, fontWeight: 600, minWidth: 60, textAlign: 'center',
        }}>
          {display}{unit || ''}{targetDisplay !== null ? `/${targetDisplay}${unit || ''}` : ''}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onChange(value + inc); }}
          style={{
            width: 28, height: 28, borderRadius: '50%', padding: 0,
            background: 'transparent', border: `1px solid ${color}`,
            color: color, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>+</button>
      </div>
      {target > 0 && (
        <div style={{
          width: '100%', height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`, background: color,
            borderRadius: 2, transition: 'width 0.3s',
          }} />
        </div>
      )}
    </div>
  );
}

/* ── Add Habit Bottom Sheet ── */
function AddHabitSheet({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('boolean');
  const [category, setCategory] = useState('personal');
  const [unit, setUnit] = useState('');
  const [target, setTarget] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(), type, category,
      unit: type === 'quantity' ? unit.trim() || null : null,
      target_value: type === 'quantity' && target ? Number(target) : null,
    });
  }

  const inputStyle = {
    padding: '10px 12px', borderRadius: 10,
    border: C.border, background: C.card,
    color: C.text, fontSize: 14, width: '100%',
    fontFamily: "'Outfit', sans-serif",
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#0e1526', borderRadius: '16px 16px 0 0',
        border: '0.5px solid rgba(255,255,255,0.06)',
        borderBottom: 'none',
        padding: '20px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 420, margin: '0 auto',
      }}>
        <div style={{
          width: 32, height: 3, borderRadius: 2,
          background: 'rgba(255,255,255,0.1)', margin: '0 auto 16px',
        }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: C.text }}>New habit</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input placeholder="Habit name" value={name} onChange={(e) => setName(e.target.value)}
            autoFocus style={inputStyle} />

          {/* Category picker */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '1.5px', color: C.textMuted, marginBottom: 8,
            }}>Category</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {CATS.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 11, fontWeight: 500,
                    textTransform: 'capitalize',
                    background: category === c ? `${CAT_COLORS[c]}15` : C.card,
                    color: category === c ? CAT_COLORS[c] : C.textMuted,
                    border: category === c ? `1px solid ${CAT_COLORS[c]}33` : C.border,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Type picker */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '1.5px', color: C.textMuted, marginBottom: 8,
            }}>Type</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['boolean', 'Yes / No'], ['quantity', 'Track number']].map(([v, label]) => (
                <button key={v} type="button" onClick={() => setType(v)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    background: type === v ? 'rgba(255,255,255,0.08)' : C.card,
                    color: type === v ? C.text : C.textMuted,
                    border: type === v ? '0.5px solid rgba(255,255,255,0.15)' : C.border,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {type === 'quantity' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Target" type="number" value={target}
                onChange={(e) => setTarget(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <input placeholder="Unit" value={unit}
                onChange={(e) => setUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
          )}

          <button type="submit" style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            color: C.text, fontSize: 14, fontWeight: 500,
            cursor: 'pointer', transition: 'background 0.2s, transform 0.1s',
            marginTop: 4,
          }}>
            Add habit
          </button>
        </form>
      </div>
    </>
  );
}

/* ── Main Page ── */
export default function Habits({ onLogout }) {
  const [habits, setHabits] = useState([]);
  const [streaks, setStreaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [expandedQty, setExpandedQty] = useState(null);

  async function load() {
    try {
      const [h, s] = await Promise.all([api.get('/habits'), api.get('/habits/streaks')]);
      setHabits(h);
      setStreaks(s);
    } catch (err) {
      console.error('Failed to load habits:', err);
    }
  }

  async function init() {
    try {
      const [h, s] = await Promise.all([api.get('/habits'), api.get('/habits/streaks')]);
      if (h.length === 0) {
        await api.post('/habits/seed-defaults');
        const [h2, s2] = await Promise.all([api.get('/habits'), api.get('/habits/streaks')]);
        setHabits(h2);
        setStreaks(s2);
      } else {
        setHabits(h);
        setStreaks(s);
      }
    } catch (err) {
      console.error('Failed to init habits:', err);
    }
    setLoading(false);
  }

  useEffect(() => { init(); }, []);

  function getStreakData(habitId) {
    const s = streaks.find((sk) => sk.habit_id === habitId);
    return {
      current: s ? Number(s.current_streak) : 0,
      best: s ? Number(s.best_streak) : 0,
    };
  }

  async function toggleBoolean(habit) {
    const newValue = Number(habit.today_value) > 0 ? 0 : 1;
    // Optimistic update
    setHabits((prev) => prev.map((h) =>
      h.id === habit.id ? { ...h, today_value: newValue } : h
    ));
    try {
      await api.post(`/habits/${habit.id}/check`, { value: newValue });
      load(); // Background refresh
    } catch (err) {
      console.error('Failed to toggle habit:', err);
      // Revert on failure
      setHabits((prev) => prev.map((h) =>
        h.id === habit.id ? { ...h, today_value: habit.today_value } : h
      ));
    }
  }

  async function updateQty(habit, newValue) {
    // Optimistic update
    setHabits((prev) => prev.map((h) =>
      h.id === habit.id ? { ...h, today_value: newValue } : h
    ));
    try {
      await api.post(`/habits/${habit.id}/check`, { value: newValue });
      load();
    } catch (err) {
      console.error('Failed to update habit:', err);
      setHabits((prev) => prev.map((h) =>
        h.id === habit.id ? { ...h, today_value: habit.today_value } : h
      ));
    }
  }

  async function addHabit(data) {
    try {
      await api.post('/habits', data);
      setShowAdd(false);
      load();
    } catch (err) {
      console.error('Failed to add habit:', err);
    }
  }

  async function deleteHabit(habitId) {
    try {
      await api.delete(`/habits/${habitId}`);
      load();
    } catch (err) {
      console.error('Failed to delete habit:', err);
    }
  }

  function toggleCollapse(cat) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  // Group habits by category
  const grouped = {};
  for (const h of habits) {
    const cat = h.category || 'personal';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(h);
  }

  const doneCount = habits.filter((h) => Number(h.today_value) > 0).length;
  const totalCount = habits.length;

  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ height: 10, width: 80, borderRadius: 4, background: C.card, marginBottom: 8 }} />
        <div style={{ height: 20, width: 140, borderRadius: 6, background: C.card, marginBottom: 24 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            height: 64, borderRadius: 10, background: C.card, marginBottom: 6,
          }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 4,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
            color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
          }}>{dayName}</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text }}>Daily habits</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: C.card, border: C.border, borderRadius: 8,
            padding: '5px 10px', fontSize: 12, fontWeight: 500, color: C.textSec,
          }}>{dateStr}</div>
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
      </div>

      {/* Progress Ring */}
      <ProgressRing done={doneCount} total={totalCount} />

      {/* Category Sections */}
      {CATS.filter((cat) => grouped[cat]?.length > 0).map((cat) => {
        const items = grouped[cat];
        const catDone = items.filter((h) => Number(h.today_value) > 0).length;
        const color = CAT_COLORS[cat];
        const isCollapsed = collapsed[cat];

        return (
          <div key={cat} style={{
            background: C.card, border: C.border, borderRadius: 10,
            borderTop: `2px solid ${color}`,
            marginBottom: 6, overflow: 'hidden',
          }}>
            {/* Category Header */}
            <div onClick={() => toggleCollapse(cat)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 12, cursor: 'pointer', userSelect: 'none',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
                color, textTransform: 'uppercase',
              }}>{cat}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontFamily: MONO, color: C.textMuted,
                }}>{catDone}/{items.length}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.textMuted} strokeWidth="1.5"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <polyline points="2,3 5,7 8,3" />
                </svg>
              </div>
            </div>

            {/* Habit Rows */}
            {!isCollapsed && (
              <div style={{ padding: '0 12px 8px' }}>
                {items.map((h) => {
                  const done = Number(h.today_value) > 0;
                  const val = Number(h.today_value) || 0;
                  const { current, best } = getStreakData(h.id);
                  const isQtyExpanded = expandedQty === h.id;

                  return (
                    <div key={h.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.03)' }}>
                      <div
                        onClick={() => {
                          if (h.type === 'quantity') {
                            setExpandedQty(isQtyExpanded ? null : h.id);
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 0', cursor: h.type === 'quantity' ? 'pointer' : 'default',
                        }}
                      >
                        {/* Checkbox */}
                        {h.type === 'boolean' ? (
                          <Checkbox checked={done} color={color}
                            onClick={(e) => { e.stopPropagation(); toggleBoolean(h); }} />
                        ) : (
                          <Checkbox checked={val >= (Number(h.target_value) || 1)} color={color}
                            onClick={(e) => e.stopPropagation()} />
                        )}

                        {/* Name + auto label */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 500,
                            color: done ? C.text : C.textSec,
                            transition: 'color 0.2s',
                          }}>{h.name}</div>
                          {h.auto_type && (
                            <div style={{
                              fontSize: 9, color: C.textMuted,
                              marginTop: 1,
                            }}>auto</div>
                          )}
                        </div>

                        {/* Right side: streak or qty display */}
                        {h.type === 'quantity' ? (
                          <span style={{
                            fontFamily: MONO, fontSize: 12, color: C.textSec,
                          }}>
                            {Number.isInteger(val) ? val : val.toFixed(1)}/{Number(h.target_value) || 0}{h.unit || ''}
                          </span>
                        ) : (
                          <span style={{
                            fontFamily: MONO, fontSize: 12,
                            color: current > 0 ? C.textSec : C.textHint,
                          }}>
                            {current}d
                          </span>
                        )}
                      </div>

                      {/* Expanded qty controls */}
                      {h.type === 'quantity' && isQtyExpanded && (
                        <QtyControls
                          value={val}
                          target={Number(h.target_value) || 0}
                          unit={h.unit}
                          color={color}
                          onChange={(v) => updateQty(h, v)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Habit Button */}
      <button onClick={() => setShowAdd(true)} style={{
        width: '100%', padding: '12px', borderRadius: 10, marginTop: 6,
        background: 'transparent',
        border: '1px dashed rgba(255,255,255,0.1)',
        color: C.textMuted, fontSize: 13, fontWeight: 400,
        cursor: 'pointer', transition: 'border-color 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New habit
      </button>

      {/* Bottom Sheet */}
      {showAdd && <AddHabitSheet onClose={() => setShowAdd(false)} onAdd={addHabit} />}
    </div>
  );
}
