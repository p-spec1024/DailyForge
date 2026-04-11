export default function SuggestionHint({ suggestedWeight, suggestedReps, unit = 'metric', onApply }) {
  if (suggestedWeight == null || suggestedReps == null) return null;

  const unitLabel = unit === 'imperial' ? 'lb' : 'kg';
  const weightDisplay = Number.isInteger(suggestedWeight)
    ? suggestedWeight
    : Number(suggestedWeight).toFixed(1);

  function handleClick(e) {
    e.stopPropagation();
    if (onApply) onApply(suggestedWeight, suggestedReps);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        display: 'block',
        background: 'none',
        border: 'none',
        padding: '4px 4px 6px',
        margin: 0,
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = '#F59E0B')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
    >
      Suggested: {weightDisplay}{unitLabel} &times; {suggestedReps}
      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>tap to fill</span>
    </button>
  );
}
