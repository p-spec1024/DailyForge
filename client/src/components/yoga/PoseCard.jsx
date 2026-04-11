const POSE_EMOJI = {
  warmup: '🌅',
  peak: '🔥',
  cooldown: '🌙',
  savasana: '🧘',
};

const base = {
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  cardPeak: {
    background: 'rgba(94,234,212,0.04)',
    border: '1px solid rgba(94,234,212,0.2)',
    borderRadius: 10,
    padding: '10px 12px',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  img: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(94,234,212,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  imgPeak: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(94,234,212,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: 500,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  muscles: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  musclesPeak: {
    fontSize: 10,
    color: '#5eead4',
    marginTop: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dur: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 0,
  },
  durPeak: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#5eead4',
    fontWeight: 500,
    flexShrink: 0,
  },
  info: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  },
  infoPeak: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(94,234,212,0.15)',
    border: 'none',
    color: '#5eead4',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
  },
};

export default function PoseCard({ pose, isPeak, onInfo, suggestion }) {
  const muscles = pose.target_muscles
    ? pose.target_muscles.split(',').map(m => m.trim()).join(' · ')
    : '';

  const showHint =
    suggestion &&
    (suggestion.reason === 'duration_increase' || suggestion.reason === 'maintain');

  return (
    <div style={isPeak ? base.cardPeak : base.card}>
      <div style={isPeak ? base.imgPeak : base.img}>
        {POSE_EMOJI[pose.phase] || '🧘'}
      </div>
      <div style={base.body}>
        <div style={base.name}>{pose.name}</div>
        {muscles && <div style={isPeak ? base.musclesPeak : base.muscles}>{muscles}</div>}
        {showHint && (
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Try holding for {suggestion.suggestedHoldSeconds}s today
          </div>
        )}
      </div>
      <div style={isPeak ? base.durPeak : base.dur}>{pose.hold_seconds}s</div>
      <button style={isPeak ? base.infoPeak : base.info} onClick={() => onInfo(pose)}>ⓘ</button>
    </div>
  );
}
