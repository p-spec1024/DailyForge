import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api.js';
import { C } from '../workout/tokens.jsx';
import TodaySessionCard from './TodaySessionCard.jsx';
import QuickStartButtons from './QuickStartButtons.jsx';
import WeekProgress from './WeekProgress.jsx';
import RecentWins from './RecentWins.jsx';

function greetingFor(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function HeaderSkeleton() {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ height: 22, width: 200, borderRadius: 6, background: C.card, marginBottom: 6 }} />
      <div style={{ height: 12, width: 60, borderRadius: 4, background: C.card }} />
    </div>
  );
}

function CardSkeleton({ height }) {
  return (
    <div
      style={{
        height,
        borderRadius: 12,
        background: C.card,
        marginBottom: 12,
      }}
    />
  );
}

export default function WorkoutDashboard({
  firstNameFallback,
  workoutName,
  durationMin,
  onStartFullSession,
  onStartStrength,
  onLogout,
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/dashboard')
      .then(d => {
        if (cancelled) return;
        setData(d);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greeting = greetingFor(hour);
  const firstName = data?.user?.firstName || firstNameFallback || '';
  const streak = data?.user?.streak ?? 0;

  function handleQuickStart(key) {
    if (key === 'strength') onStartStrength?.();
    else if (key === 'yoga') navigate('/yoga');
    else if (key === 'breathe') navigate('/breathe');
  }

  return (
    <div>
      {/* Greeting + streak */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
        }}
      >
        {loading ? (
          <HeaderSkeleton />
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: C.text,
                margin: 0,
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h2>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {!loading && (
            <div
              aria-label={`${streak} day streak`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 12,
                padding: '4px 10px',
                fontSize: 13,
                fontWeight: 600,
                color: '#f59e0b',
              }}
            >
              <span>🔥</span>
              <span>{streak}</span>
            </div>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label="Log out"
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: C.textMuted,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <>
          <CardSkeleton height={220} />
          <CardSkeleton height={88} />
          <CardSkeleton height={84} />
          <CardSkeleton height={120} />
        </>
      ) : (
        <>
          <TodaySessionCard
            workoutName={workoutName}
            durationMin={durationMin}
            lastSession={data?.lastSession}
            onStart={onStartFullSession}
          />

          <QuickStartButtons onSelect={handleQuickStart} />

          <WeekProgress
            days={data?.thisWeek?.days}
            todayIndex={data?.thisWeek?.todayIndex ?? 0}
          />

          <RecentWins
            recentPRs={data?.recentPRs}
            weekActivity={data?.weekActivity}
            milestone={data?.milestone}
          />

          {error && (
            <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 8 }}>
              Couldn't load dashboard data
            </div>
          )}
        </>
      )}
    </div>
  );
}
