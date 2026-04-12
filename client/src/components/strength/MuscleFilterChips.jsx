import { useRef, useEffect } from 'react';
import { C } from '../workout/tokens.jsx';

const PRESET_GROUPS = [
  'All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Forearms',
];

export default function MuscleFilterChips({ selected, onSelect }) {
  const scrollRef = useRef(null);

  // Scroll active chip into view
  useEffect(() => {
    if (!scrollRef.current) return;
    const active = scrollRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selected]);

  return (
    <div
      ref={scrollRef}
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {PRESET_GROUPS.map(group => {
        const value = group === 'All' ? null : group.toLowerCase();
        const isActive = selected === value;
        return (
          <button
            key={group}
            data-active={isActive}
            onClick={() => onSelect(value)}
            style={{
              flexShrink: 0,
              padding: '7px 14px',
              borderRadius: 20,
              border: isActive
                ? '1px solid rgba(245,158,11,0.4)'
                : '1px solid rgba(255,255,255,0.08)',
              background: isActive
                ? 'rgba(245,158,11,0.15)'
                : 'rgba(255,255,255,0.04)',
              color: isActive ? '#f59e0b' : C.textSec,
              fontSize: 12,
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {group}
          </button>
        );
      })}
    </div>
  );
}
