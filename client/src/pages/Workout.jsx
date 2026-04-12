import { useSearchParams } from 'react-router-dom';
import TodayView from './TodayView.jsx';
import EmptyWorkoutView from './EmptyWorkout.jsx';

export default function Workout({ onLogout }) {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const exerciseId = searchParams.get('exerciseId');
  const exerciseName = searchParams.get('exerciseName');
  const routineId = searchParams.get('routineId');

  if (mode === 'empty') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
        <EmptyWorkoutView
          initialExerciseId={exerciseId ? parseInt(exerciseId, 10) : null}
          initialExerciseName={exerciseName || null}
          routineId={routineId ? parseInt(routineId, 10) : null}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
      <TodayView onLogout={onLogout} />
    </div>
  );
}
