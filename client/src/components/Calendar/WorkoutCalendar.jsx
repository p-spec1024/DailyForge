import { useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api.js';
import { C } from '../workout/tokens.jsx';
import CalendarDay from './CalendarDay.jsx';
import SessionBottomSheet from './SessionBottomSheet.jsx';
import StreakCounter from './StreakCounter.jsx';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toMonthParam(year, monthIdx) {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
}

function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function buildGrid(year, monthIdx) {
  // 6 rows × 7 cols, starting on Sunday. Fill with prev/next month days
  const firstOfMonth = new Date(year, monthIdx, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sun
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const daysInPrev = new Date(year, monthIdx, 0).getDate();

  const cells = [];
  // Leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    const d = new Date(year, monthIdx - 1, day);
    cells.push({
      day,
      isCurrentMonth: false,
      dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }
  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      isCurrentMonth: true,
      dateStr: `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }
  // Trailing days — fill to 42 cells (6 rows)
  let nextDay = 1;
  while (cells.length < 42) {
    const d = new Date(year, monthIdx + 1, nextDay);
    cells.push({
      day: nextDay,
      isCurrentMonth: false,
      dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    });
    nextDay++;
  }
  return cells;
}

export default function WorkoutCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIdx, setMonthIdx] = useState(today.getMonth());
  const [data, setData] = useState({ sessions: [], streak: { current: 0, best: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get(`/session/calendar?month=${toMonthParam(year, monthIdx)}`)
      .then((res) => {
        if (!cancelled) {
          setData({
            sessions: res.sessions || [],
            streak: res.streak || { current: 0, best: 0 },
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load calendar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [year, monthIdx]);

  const sessionsByDate = useMemo(() => {
    const map = {};
    for (const s of data.sessions) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [data.sessions]);

  const streakSet = useMemo(
    () => new Set(data.streak.dates || []),
    [data.streak.dates]
  );

  const grid = useMemo(() => buildGrid(year, monthIdx), [year, monthIdx]);
  const tStr = todayStr();

  const goPrev = () => {
    if (monthIdx === 0) { setYear(y => y - 1); setMonthIdx(11); }
    else setMonthIdx(m => m - 1);
  };
  const goNext = () => {
    if (monthIdx === 11) { setYear(y => y + 1); setMonthIdx(0); }
    else setMonthIdx(m => m + 1);
  };

  const selectedSessions = selectedDate ? (sessionsByDate[selectedDate] || []) : [];

  return (
    <div style={{
      background: C.card,
      border: C.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <button
          type="button"
          onClick={goPrev}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.textSec,
            fontSize: 20,
            cursor: 'pointer',
            padding: '4px 10px',
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label="Previous month"
        >
          &lsaquo;
        </button>
        <div style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>
          {MONTH_NAMES[monthIdx]} {year}
        </div>
        <button
          type="button"
          onClick={goNext}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.textSec,
            fontSize: 20,
            cursor: 'pointer',
            padding: '4px 10px',
            minHeight: 44,
            minWidth: 44,
          }}
          aria-label="Next month"
        >
          &rsaquo;
        </button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <StreakCounter current={data.streak.current} best={data.streak.best} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        marginBottom: 4,
      }}>
        {DOW.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              color: C.textMuted,
              fontSize: 10,
              padding: '4px 0',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 150ms',
      }}>
        {grid.map((cell, i) => {
          const isFuture = cell.dateStr > tStr;
          const isToday = cell.dateStr === tStr;
          const sessions = sessionsByDate[cell.dateStr];
          return (
            <CalendarDay
              key={i}
              day={cell.day}
              isToday={isToday}
              isFuture={isFuture}
              isCurrentMonth={cell.isCurrentMonth}
              inStreak={streakSet.has(cell.dateStr)}
              sessions={sessions}
              onTap={() => setSelectedDate(cell.dateStr)}
            />
          );
        })}
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {selectedDate && (
        <SessionBottomSheet
          dateStr={selectedDate}
          sessions={selectedSessions}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}
