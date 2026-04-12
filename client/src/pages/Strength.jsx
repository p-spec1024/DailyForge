import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../components/workout/tokens.jsx';
import EmptyWorkoutCard from '../components/strength/EmptyWorkoutCard.jsx';
import ExerciseBrowser from '../components/strength/ExerciseBrowser.jsx';

export default function Strength() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  function handleStartEmpty() {
    if (starting) return;
    setStarting(true);
    // Navigate to empty workout mode
    navigate('/?mode=empty');
  }

  function handleDoExercise(exercise) {
    // Navigate to empty workout with this exercise pre-loaded
    navigate(`/?mode=empty&exerciseId=${exercise.id}&exerciseName=${encodeURIComponent(exercise.name)}`);
  }

  return (
    <div style={{
      maxWidth: 420,
      margin: '0 auto',
      padding: '0 16px',
      background: '#0a1628',
      minHeight: 'calc(100vh - 80px)',
      paddingBottom: 90,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '2px 0 18px',
      }}>
        <div style={{
          fontSize: 17,
          fontWeight: 600,
          color: '#fff',
          letterSpacing: '-0.2px',
        }}>
          Strength
        </div>
      </div>

      {/* Empty Workout CTA */}
      <EmptyWorkoutCard onStart={handleStartEmpty} disabled={starting} />

      {/* My Routines — placeholder for S6-T4 */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '1.5px',
        color: C.textMuted,
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        My Routines
      </div>
      <div style={{
        background: C.card,
        border: C.border,
        borderRadius: 12,
        padding: '20px 16px',
        textAlign: 'center',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.3 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="12" y2="16" />
          </svg>
        </div>
        <div style={{ fontSize: 13, color: C.textSec, marginBottom: 2 }}>
          No saved routines yet
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          Finish a workout to save it as a reusable routine
        </div>
      </div>

      {/* Exercise Browser */}
      <ExerciseBrowser onDoExercise={handleDoExercise} />
    </div>
  );
}
