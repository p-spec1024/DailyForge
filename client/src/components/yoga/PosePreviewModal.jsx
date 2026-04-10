import { useState, useMemo, useEffect } from 'react';
import PoseCard from './PoseCard.jsx';
import PoseInfoPopup from './PoseInfoPopup.jsx';

const TYPE_LABELS = {
  vinyasa: 'Vinyasa',
  hatha: 'Hatha',
  yin: 'Yin',
  restorative: 'Restorative',
  sun_salutation: 'Sun Salutation',
};

const PHASE_LABELS = {
  warmup: 'Warmup',
  peak: 'Peak poses',
  cooldown: 'Cool-down',
  savasana: 'Savasana',
};

const PHASE_ORDER = ['warmup', 'peak', 'cooldown', 'savasana'];

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,22,40,0.98)',
    zIndex: 110,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 16px 0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    padding: '14px 16px',
  },
  statBox: (teal) => ({
    flex: 1,
    padding: '10px 8px',
    borderRadius: 10,
    background: teal ? 'rgba(94,234,212,0.08)' : 'rgba(255,255,255,0.04)',
    border: teal ? '1px solid rgba(94,234,212,0.2)' : '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center',
  }),
  statNum: (teal) => ({
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 600,
    color: teal ? '#5eead4' : '#fff',
  }),
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px',
    paddingBottom: 90,
    WebkitOverflowScrolling: 'touch',
  },
  phaseLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 6,
  },
  bottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(transparent, rgba(10,22,40,0.95) 30%)',
    display: 'flex',
    gap: 8,
    zIndex: 120,
  },
  regenBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 50,
    padding: '10px 14px',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  beginBtn: {
    flex: 2,
    background: 'linear-gradient(135deg, #5eead4 0%, #2dd4bf 100%)',
    border: 'none',
    borderRadius: 50,
    padding: '10px 16px',
    color: '#0a1628',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(94,234,212,0.3)',
  },
};

export default function PosePreviewModal({ session, config, isGenerating, onRegenerate, onBegin, onClose }) {
  const [infoPose, setInfoPose] = useState(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    setInfoPose(null);
  }, [session]);

  const grouped = useMemo(() => {
    if (!session?.poses) return [];
    const groups = {};
    for (const pose of session.poses) {
      const phase = pose.phase || 'peak';
      if (!groups[phase]) groups[phase] = [];
      groups[phase].push(pose);
    }
    return PHASE_ORDER.filter(p => groups[p]?.length).map(p => ({ phase: p, poses: groups[p] }));
  }, [session]);

  const poseCount = session?.poses?.length || 0;
  const duration = session?.duration || config.duration;
  const kcal = duration * 3;

  const focusLabel = config.focus.length > 0
    ? ` · ${config.focus.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ')} focus`
    : '';
  const subtitleText = `${duration}m ${TYPE_LABELS[session?.type || config.type] || config.type}${focusLabel}`;

  // Find next pose for info popup transition hint
  const nextPoseAfter = (pose) => {
    if (!session?.poses) return null;
    const idx = session.poses.indexOf(pose);
    return idx >= 0 && idx < session.poses.length - 1 ? session.poses[idx + 1] : null;
  };

  return (
    <div style={s.overlay}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Your session</div>
          <div style={s.subtitle}>{subtitleText}</div>
        </div>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={s.statsRow}>
        <div style={s.statBox(true)}>
          <div style={s.statNum(true)}>{poseCount}</div>
          <div style={s.statLabel}>poses</div>
        </div>
        <div style={s.statBox(false)}>
          <div style={s.statNum(false)}>{duration}</div>
          <div style={s.statLabel}>minutes</div>
        </div>
        <div style={s.statBox(false)}>
          <div style={s.statNum(false)}>{kcal}</div>
          <div style={s.statLabel}>kcal</div>
        </div>
      </div>

      <div style={s.list}>
        {grouped.map(({ phase, poses }) => (
          <div key={phase}>
            <div style={s.phaseLabel}>{PHASE_LABELS[phase] || phase}</div>
            {poses.map((pose, i) => (
              <PoseCard
                key={`${phase}-${i}`}
                pose={pose}
                isPeak={phase === 'peak'}
                onInfo={setInfoPose}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={s.bottomBar}>
        <button style={{ ...s.regenBtn, ...(isGenerating && { opacity: 0.5, cursor: 'default' }) }} onClick={onRegenerate} disabled={isGenerating}>
          <span style={{ fontSize: 13 }}>↻</span> {isGenerating ? 'Generating...' : 'Regenerate'}
        </button>
        <button style={s.beginBtn} onClick={onBegin}>Begin session →</button>
      </div>

      {infoPose && (
        <PoseInfoPopup
          pose={infoPose}
          nextPose={nextPoseAfter(infoPose)}
          onClose={() => setInfoPose(null)}
        />
      )}
    </div>
  );
}
