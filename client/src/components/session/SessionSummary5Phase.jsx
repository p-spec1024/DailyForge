import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api.js';
import { C, MONO, GOLD, formatVolume } from '../workout/tokens.jsx';

function SummarySection({ title, icon, color, children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `0.5px solid ${color}30`,
      borderRadius: 12, padding: 14, marginBottom: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color,
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function StatLine({ label, value, color: valColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0', fontSize: 13,
    }}>
      <span style={{ color: C.textSec }}>{label}</span>
      <span style={{ color: valColor || C.text, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function DetailList({ items, color }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ padding: '4px 0 2px' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          fontSize: 12, color: C.textSec, padding: '2px 0',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0 }} />
          {item}
        </div>
      ))}
    </div>
  );
}

export default function SessionSummary5Phase({ flow, workoutName, workoutId, onDone }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const results = flow.phaseResults;
  const totalDuration = flow.getTotalDuration();
  const totalMin = Math.round(totalDuration / 60);

  const now = new Date();
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startTime = flow.startedAt ? new Date(flow.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

  const hasBreathwork = results.opening_breathwork || results.closing_breathwork;
  const hasYoga = results.warmup || results.cooldown;
  const hasStrength = results.main_work;

  // Compute total volume
  const totalVolume = results.main_work?.totalVolume || 0;

  // Save session
  async function handleSave() {
    if (saving || saved) return;
    setSaving(true);
    setSaveError(false);
    try {
      await api.post('/session/complete-5phase', {
        session_id: flow.sessionId,
        workout_id: workoutId,
        total_duration: totalDuration,
        phases: {
          opening_breathwork: results.opening_breathwork ? {
            technique_name: results.opening_breathwork.technique_name,
            duration: results.opening_breathwork.duration,
            completed: results.opening_breathwork.completed,
            rounds_completed: results.opening_breathwork.rounds_completed,
          } : null,
          warmup: results.warmup ? {
            poses_done: results.warmup.poses_done,
            pose_names: results.warmup.pose_names,
            duration: results.warmup.duration,
            completed: results.warmup.completed,
          } : null,
          main_work: results.main_work ? {
            sets: results.main_work.sets,
            prs: results.main_work.prs,
            duration: results.main_work.duration,
            completed: results.main_work.completed,
            exerciseNames: results.main_work.exerciseNames,
            totalVolume: results.main_work.totalVolume,
          } : null,
          cooldown: results.cooldown ? {
            poses_done: results.cooldown.poses_done,
            pose_names: results.cooldown.pose_names,
            duration: results.cooldown.duration,
            completed: results.cooldown.completed,
          } : null,
          closing_breathwork: results.closing_breathwork ? {
            technique_name: results.closing_breathwork.technique_name,
            duration: results.closing_breathwork.duration,
            completed: results.closing_breathwork.completed,
            silent_sit: true,
            rounds_completed: results.closing_breathwork.rounds_completed,
          } : null,
        },
      });
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  // Auto-save once results are populated (guards against empty first render)
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const saveAttemptedRef = useRef(false);
  useEffect(() => {
    if (saveAttemptedRef.current) return;
    if (Object.keys(results).length === 0) return;
    saveAttemptedRef.current = true;
    handleSaveRef.current();
  }, [results]);

  function formatDur(secs) {
    if (!secs) return '0m';
    const m = Math.round(secs / 60);
    return `${m}m`;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#0a1628',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        display: 'flex', flexDirection: 'column', height: '100%',
      }}>
        {/* Header */}
        <div style={{
          flexShrink: 0, padding: '48px 20px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '2px',
            color: C.green, textTransform: 'uppercase', marginBottom: 8,
          }}>SESSION COMPLETE</div>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#127881;</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 4 }}>
            {dayName} &middot; {workoutName || 'Workout'}
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 4 }}>
            {dateStr} &middot; Started {startTime}
          </div>
          <div style={{ fontSize: 14, color: C.textSec, marginBottom: 24 }}>
            Total: {totalMin} min
            {totalVolume > 0 && <> &middot; {formatVolume(totalVolume)} kg</>}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', minHeight: 0 }}>
          {/* Breathwork section */}
          {hasBreathwork && (
            <SummarySection title="Breathwork" icon={'\uD83E\uDEC1'} color="#a78bfa">
              {results.opening_breathwork && (
                <>
                  <StatLine
                    label={`Opening: ${results.opening_breathwork.technique_name || 'Breathwork'}`}
                    value={formatDur(results.opening_breathwork.duration)}
                  />
                  {results.opening_breathwork.rounds_completed > 0 && (
                    <div style={{ fontSize: 11, color: C.textMuted, paddingLeft: 4, paddingBottom: 2 }}>
                      {results.opening_breathwork.rounds_completed} round{results.opening_breathwork.rounds_completed !== 1 ? 's' : ''} completed
                    </div>
                  )}
                </>
              )}
              {results.closing_breathwork && (
                <>
                  <StatLine
                    label={`Closing: ${results.closing_breathwork.technique_name || 'Breathwork'}`}
                    value={formatDur(results.closing_breathwork.duration)}
                  />
                  {results.closing_breathwork.rounds_completed > 0 && (
                    <div style={{ fontSize: 11, color: C.textMuted, paddingLeft: 4, paddingBottom: 2 }}>
                      {results.closing_breathwork.rounds_completed} round{results.closing_breathwork.rounds_completed !== 1 ? 's' : ''} completed
                    </div>
                  )}
                </>
              )}
              <div style={{
                borderTop: '0.5px solid rgba(255,255,255,0.06)', marginTop: 6, paddingTop: 6,
              }}>
                <StatLine label="Total" value={formatDur(
                  (results.opening_breathwork?.duration || 0) + (results.closing_breathwork?.duration || 0)
                )} />
              </div>
            </SummarySection>
          )}

          {/* Yoga section */}
          {hasYoga && (
            <SummarySection title="Yoga" icon={'\uD83E\uDDD8'} color="#5DCAA5">
              {results.warmup && (
                <>
                  <StatLine
                    label={`Warm-up: ${results.warmup.poses_done || 0} pose${results.warmup.poses_done === 1 ? '' : 's'}`}
                    value={formatDur(results.warmup.duration)}
                  />
                  <DetailList items={results.warmup.pose_names} color="#5DCAA5" />
                </>
              )}
              {results.cooldown && (
                <>
                  <StatLine
                    label={`Cool-down: ${results.cooldown.poses_done || 0} pose${results.cooldown.poses_done === 1 ? '' : 's'}`}
                    value={formatDur(results.cooldown.duration)}
                  />
                  <DetailList items={results.cooldown.pose_names} color="#5DCAA5" />
                </>
              )}
              <div style={{
                borderTop: '0.5px solid rgba(255,255,255,0.06)', marginTop: 6, paddingTop: 6,
              }}>
                <StatLine label="Total" value={formatDur(
                  (results.warmup?.duration || 0) + (results.cooldown?.duration || 0)
                )} />
              </div>
            </SummarySection>
          )}

          {/* Strength section */}
          {hasStrength && (
            <SummarySection title="Strength" icon={'\uD83D\uDCAA'} color="#D85A30">
              <StatLine label="Sets" value={String(results.main_work.sets || 0)} />
              {totalVolume > 0 && (
                <StatLine label="Total volume" value={`${formatVolume(totalVolume)} kg`} />
              )}
              {results.main_work.prs > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 0', fontSize: 13, color: GOLD,
                }}>
                  <span>&#127942;</span> {results.main_work.prs} new PR{results.main_work.prs > 1 ? 's' : ''}!
                </div>
              )}
              {/* Exercise names */}
              <DetailList items={results.main_work.exerciseNames} color="#D85A30" />
              <div style={{
                borderTop: '0.5px solid rgba(255,255,255,0.06)', marginTop: 6, paddingTop: 6,
              }}>
                <StatLine label="Total" value={formatDur(results.main_work.duration)} />
              </div>
            </SummarySection>
          )}

          {/* PR details */}
          {hasStrength && results.main_work.prDetails && results.main_work.prDetails.length > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 12, padding: 14, marginBottom: 12,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>&#127942;</span> Personal Records
              </div>
              {results.main_work.prDetails.map((pr, i) => (
                <div key={`${pr.exercise_id}-${pr.pr_type}`} style={{
                  padding: '4px 0', fontSize: 12, color: C.textSec,
                  borderTop: i > 0 ? '0.5px solid rgba(245,158,11,0.1)' : 'none',
                }}>
                  <span style={{ color: C.text }}>{pr.exercise_name}</span>
                  {' \u2014 '}
                  <span style={{ color: GOLD, fontFamily: MONO, fontWeight: 600 }}>
                    {pr.new_value}{pr.unit === 'kg' ? ' kg' : pr.unit === 'vol' ? ' vol' : ''}
                  </span>
                  {' (was '}
                  <span style={{ color: C.textMuted }}>{pr.previous_best}</span>
                  {')'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          flexShrink: 0, padding: '16px 20px',
          paddingBottom: 96,
        }}>
          {saveError && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10, marginBottom: 10,
              background: 'rgba(220,38,38,0.1)', border: '0.5px solid rgba(220,38,38,0.25)',
            }}>
              <span style={{ fontSize: 13, color: '#f87171' }}>
                Failed to save session
              </span>
              <button onClick={() => { saveAttemptedRef.current = false; handleSave(); }} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none',
                background: 'rgba(220,38,38,0.15)', color: '#f87171',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>Retry</button>
            </div>
          )}
          <button onClick={onDone} style={{
            width: '100%', padding: '16px', borderRadius: 12, border: 'none',
            background: 'rgba(29,158,117,0.2)', color: C.green,
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}>{saved ? 'Done' : saving ? 'Saving...' : 'Done'}</button>
        </div>
      </div>
    </div>
  );
}
