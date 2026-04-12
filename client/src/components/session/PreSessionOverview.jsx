import { useState, useEffect } from 'react';
import { api } from '../../utils/api.js';
import { C } from '../workout/tokens.jsx';
import BottomSheet from '../BottomSheet.jsx';

const PHASE_COLORS = {
  opening_breathwork: '#a78bfa',
  warmup: '#5DCAA5',
  main_work: '#D85A30',
  cooldown: '#5DCAA5',
  closing_breathwork: '#a78bfa',
};

const DURATION_OPTIONS = [3, 5, 7];
const LEVEL_OPTIONS = ['beginner', 'intermediate', 'advanced'];

function PhaseCard({ phase, label, icon, children, color, skipped, onToggleSkip }) {
  return (
    <div style={{
      background: skipped ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
      border: `0.5px solid ${skipped ? 'rgba(255,255,255,0.04)' : `${color}30`}`,
      borderRadius: 12, padding: 14, marginBottom: 10,
      opacity: skipped ? 0.4 : 1, transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '1px',
            color, textTransform: 'uppercase', marginBottom: 4,
          }}>Phase {phase}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            {icon} {label}
          </div>
          {!skipped && children}
        </div>
        <button onClick={onToggleSkip} style={{
          background: skipped ? 'rgba(29,158,117,0.1)' : 'rgba(255,255,255,0.06)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
          color: skipped ? C.green : C.textMuted, fontWeight: 500,
        }}>{skipped ? 'Add' : 'Skip'}</button>
      </div>
    </div>
  );
}

function MiniSelector({ options, selected, onSelect, format }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
      {options.map(o => {
        const active = o === selected;
        return (
          <button key={o} onClick={() => onSelect(o)} style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            background: active ? 'rgba(93,202,165,0.15)' : 'rgba(255,255,255,0.04)',
            border: active ? '0.5px solid rgba(93,202,165,0.3)' : '0.5px solid rgba(255,255,255,0.06)',
            color: active ? '#5DCAA5' : C.textMuted, fontWeight: active ? 600 : 400,
          }}>{format ? format(o) : o}</button>
        );
      })}
    </div>
  );
}

export default function PreSessionOverview({ workoutId, workoutName, sessionType, flow, onBegin }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [techniques, setTechniques] = useState([]);
  const [showTechniquePicker, setShowTechniquePicker] = useState(null); // 'opening' | 'closing'

  useEffect(() => {
    if (!workoutId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    api.get(`/session/overview/${workoutId}`)
      .then(data => {
        setOverview(data);
        // Initialize flow config from server data
        flow.updatePhaseConfig('opening_breathwork', {
          technique_id: data.phases.opening_breathwork.suggested_technique_id,
          technique_name: data.phases.opening_breathwork.suggested_technique_name,
          duration: data.phases.opening_breathwork.duration,
        });
        flow.updatePhaseConfig('warmup', {
          duration: data.phases.warmup.default_duration,
          level: data.phases.warmup.default_level,
          focus: data.phases.warmup.focus_areas,
        });
        flow.updatePhaseConfig('cooldown', {
          duration: data.phases.cooldown.default_duration,
          level: data.phases.cooldown.default_level,
          focus: data.phases.cooldown.focus_areas,
        });
        flow.updatePhaseConfig('closing_breathwork', {
          technique_id: data.phases.closing_breathwork.suggested_technique_id,
          technique_name: data.phases.closing_breathwork.suggested_technique_name,
          duration: data.phases.closing_breathwork.duration,
        });
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [workoutId, retryCount]);

  // Load techniques for picker
  useEffect(() => {
    if (showTechniquePicker) {
      const cat = showTechniquePicker === 'opening' ? 'energizing' : 'calming';
      api.get(`/breathwork/techniques?category=${cat}`)
        .then(setTechniques)
        .catch(() => setTechniques([]));
    }
  }, [showTechniquePicker]);

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>
        Preparing session...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ color: '#f87171', marginBottom: 16, fontSize: 14 }}>Failed to load session overview</div>
        <button onClick={() => setRetryCount(c => c + 1)} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none',
          background: 'rgba(220,38,38,0.15)', color: '#f87171',
          fontSize: 14, cursor: 'pointer',
        }}>Retry</button>
      </div>
    );
  }

  const now = new Date();
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const displayName = workoutName || overview?.workout?.name || 'Workout';
  const config = flow.phaseConfig;

  const formatDuration = (secs) => `${Math.round(secs / 60)} min`;
  const totalSecs = (flow.skippedPhases.includes('opening_breathwork') ? 0 : config.opening_breathwork.duration)
    + (flow.skippedPhases.includes('warmup') ? 0 : config.warmup.duration)
    + (overview?.phases?.main_work?.estimated_duration || 0)
    + (flow.skippedPhases.includes('cooldown') ? 0 : config.cooldown.duration)
    + (flow.skippedPhases.includes('closing_breathwork') ? 0 : config.closing_breathwork.duration);

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '1.5px',
          color: C.textMuted, textTransform: 'uppercase', marginBottom: 4,
        }}>TODAY'S SESSION</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>{dayName} &middot; {displayName}</div>
      </div>

      {/* Phase 1: Opening Breathwork */}
      <PhaseCard phase={1} label="Opening Breathwork" icon={'\uD83E\uDEC1'}
        color={PHASE_COLORS.opening_breathwork}
        skipped={flow.skippedPhases.includes('opening_breathwork')}
        onToggleSkip={() => flow.toggleSkipPhase('opening_breathwork')}>
        <div style={{ fontSize: 13, color: C.textSec }}>
          {config.opening_breathwork.technique_name} &middot; {formatDuration(config.opening_breathwork.duration)}
        </div>
        <button onClick={() => setShowTechniquePicker('opening')} style={{
          background: 'none', border: 'none', color: '#a78bfa',
          fontSize: 11, cursor: 'pointer', padding: '4px 0', marginTop: 2,
        }}>change technique</button>
      </PhaseCard>

      {/* Phase 2: Warm-up */}
      <PhaseCard phase={2} label="Dynamic Warm-up" icon={'\uD83E\uDDD8'}
        color={PHASE_COLORS.warmup}
        skipped={flow.skippedPhases.includes('warmup')}
        onToggleSkip={() => flow.toggleSkipPhase('warmup')}>
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 4 }}>
          Focus: {config.warmup.focus?.join(', ') || 'Full body'}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <MiniSelector options={DURATION_OPTIONS} selected={config.warmup.duration / 60}
            onSelect={d => flow.updatePhaseConfig('warmup', { duration: d * 60 })}
            format={d => `${d}m`} />
          <MiniSelector options={LEVEL_OPTIONS} selected={config.warmup.level}
            onSelect={l => flow.updatePhaseConfig('warmup', { level: l })} />
        </div>
      </PhaseCard>

      {/* Phase 3: Main Work */}
      <PhaseCard phase={3} label="Main Work" icon={'\uD83D\uDCAA'}
        color={PHASE_COLORS.main_work}
        skipped={false}
        onToggleSkip={() => {}}>
        <div style={{ fontSize: 13, color: C.textSec }}>
          {displayName} &middot; {overview?.phases?.main_work?.exercise_count || '?'} exercises
          &middot; ~{formatDuration(overview?.phases?.main_work?.estimated_duration || 0)}
        </div>
      </PhaseCard>

      {/* Phase 4: Cool-down */}
      <PhaseCard phase={4} label="Cool-down" icon={'\uD83E\uDDD8'}
        color={PHASE_COLORS.cooldown}
        skipped={flow.skippedPhases.includes('cooldown')}
        onToggleSkip={() => flow.toggleSkipPhase('cooldown')}>
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 4 }}>
          Focus: {config.cooldown.focus?.join(', ') || 'Full body'}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <MiniSelector options={DURATION_OPTIONS} selected={config.cooldown.duration / 60}
            onSelect={d => flow.updatePhaseConfig('cooldown', { duration: d * 60 })}
            format={d => `${d}m`} />
          <MiniSelector options={LEVEL_OPTIONS} selected={config.cooldown.level}
            onSelect={l => flow.updatePhaseConfig('cooldown', { level: l })} />
        </div>
      </PhaseCard>

      {/* Phase 5: Closing Breathwork */}
      <PhaseCard phase={5} label="Closing Breathwork" icon={'\uD83E\uDEC1'}
        color={PHASE_COLORS.closing_breathwork}
        skipped={flow.skippedPhases.includes('closing_breathwork')}
        onToggleSkip={() => flow.toggleSkipPhase('closing_breathwork')}>
        <div style={{ fontSize: 13, color: C.textSec }}>
          {config.closing_breathwork.technique_name} &middot; {formatDuration(config.closing_breathwork.duration)}
        </div>
        <button onClick={() => setShowTechniquePicker('closing')} style={{
          background: 'none', border: 'none', color: '#a78bfa',
          fontSize: 11, cursor: 'pointer', padding: '4px 0', marginTop: 2,
        }}>change technique</button>
      </PhaseCard>

      {/* Total */}
      <div style={{
        textAlign: 'center', fontSize: 14, color: C.textSec,
        marginTop: 8, marginBottom: 16,
      }}>
        Total: ~{formatDuration(totalSecs)}
      </div>

      {/* BEGIN SESSION */}
      <div style={{
        position: 'sticky', bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))',
        zIndex: 15, paddingTop: 12,
      }}>
        <button onClick={onBegin} style={{
          width: '100%', padding: '16px', borderRadius: 12,
          background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.25)',
          color: C.green, fontSize: 16, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          backdropFilter: 'blur(8px)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          BEGIN SESSION
        </button>
      </div>

      {/* Technique Picker Modal */}
      {showTechniquePicker && (
        <BottomSheet
          onClose={() => setShowTechniquePicker(null)}
          title={`${showTechniquePicker === 'opening' ? 'Opening' : 'Closing'} Technique`}
          zIndex={100}
        >
          {techniques.length === 0 ? (
            <div style={{ color: C.textMuted, padding: 20, textAlign: 'center' }}>Loading...</div>
          ) : techniques.map(t => {
            const phaseKey = showTechniquePicker === 'opening' ? 'opening_breathwork' : 'closing_breathwork';
            const isSelected = config[phaseKey].technique_id === t.id;
            return (
              <button key={t.id} onClick={() => {
                flow.updatePhaseConfig(phaseKey, { technique_id: t.id, technique_name: t.name });
                setShowTechniquePicker(null);
              }} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px', borderRadius: 8, marginBottom: 6, cursor: 'pointer',
                background: isSelected ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.04)',
                border: isSelected ? '1px solid rgba(167,139,250,0.3)' : '0.5px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {t.difficulty} &middot; {Math.round(t.estimated_duration / 60)}min
                </div>
              </button>
            );
          })}
        </BottomSheet>
      )}
    </div>
  );
}
