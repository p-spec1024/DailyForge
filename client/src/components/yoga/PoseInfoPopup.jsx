import { useState, useEffect } from 'react';

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  popup: {
    background: '#1a2942',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    maxWidth: 300,
    maxHeight: '70vh',
    width: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  closeRow: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '12px 12px 0 12px',
    background: '#1a2942',
    borderRadius: '16px 16px 0 0',
  },
  close: {
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
  },
  scrollBody: {
    overflowY: 'auto',
    padding: '8px 20px 20px',
    WebkitOverflowScrolling: 'touch',
  },
  name: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 2,
  },
  sanskrit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  label: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: {
    fontSize: 13,
    color: '#5eead4',
    marginBottom: 10,
  },
  desc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.5,
    marginBottom: 12,
    whiteSpace: 'pre-line',
  },
  readMore: {
    color: '#5eead4',
    fontSize: 12,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginTop: 4,
    display: 'inline-block',
  },
  separator: {
    borderTop: '1px solid rgba(255,255,255,0.08)',
    marginTop: 10,
    paddingTop: 10,
  },
  transition: {
    fontSize: 12,
    color: 'rgba(94,234,212,0.8)',
    fontStyle: 'italic',
  },
};

const DIFFICULTY_LABELS = {
  beginner: 'Easy',
  intermediate: 'Moderate',
  advanced: 'Challenging',
};

function buildPoseDescription(pose) {
  // Use DB description if available
  if (pose.description) return pose.description;
  if (pose.instructions) return pose.instructions;
  if (pose.steps) return pose.steps;

  // Generate a useful description from available data
  const parts = [];
  const muscles = pose.target_muscles
    ? pose.target_muscles.split(',').map(m => m.trim()).filter(Boolean)
    : [];

  if (muscles.length > 0) {
    parts.push(`This pose targets your ${muscles.slice(0, 3).join(', ')}${muscles.length > 3 ? ' and more' : ''}.`);
  }

  if (pose.hold_seconds) {
    parts.push(`Hold for ${pose.hold_seconds} seconds, breathing steadily.`);
  }

  return parts.length > 0 ? parts.join(' ') : 'Hold this pose and breathe deeply.';
}

const DESC_TRUNCATE_LEN = 200;

export default function PoseInfoPopup({ pose, nextPose, onClose }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [pose]);

  if (!pose) return null;

  const fullDesc = buildPoseDescription(pose);
  const isLong = fullDesc.length > DESC_TRUNCATE_LEN;
  const displayDesc = isLong && !expanded
    ? fullDesc.slice(0, DESC_TRUNCATE_LEN).replace(/\s+\S*$/, '') + '...'
    : fullDesc;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.popup} onClick={e => e.stopPropagation()}>
        <div style={s.closeRow}>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>
        <div style={s.scrollBody}>
          <div style={s.name}>{pose.name}</div>
          {pose.sanskrit_name && <div style={s.sanskrit}>{pose.sanskrit_name}</div>}
          <div style={s.desc}>
            {displayDesc}
            {isLong && !expanded && (
              <button style={s.readMore} onClick={() => setExpanded(true)}>Read more</button>
            )}
          </div>
          {pose.target_muscles && (
            <>
              <div style={s.label}>Muscles</div>
              <div style={s.value}>
                {pose.target_muscles.split(',').map(m => m.trim()).join(' · ')}
              </div>
            </>
          )}
          <div style={s.label}>Hold time</div>
          <div style={s.value}>{pose.hold_seconds}s</div>
          {pose.difficulty && (
            <>
              <div style={s.label}>Difficulty</div>
              <div style={s.value}>{DIFFICULTY_LABELS[pose.difficulty] || pose.difficulty}</div>
            </>
          )}
          <div style={s.separator}>
            <div style={s.transition}>
              {nextPose ? `→ flows into ${nextPose.name}` : '— end of session'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
