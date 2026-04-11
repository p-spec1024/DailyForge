import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { DataProvider } from './contexts/DataProvider.jsx';
import NavBar from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Workout from './pages/Workout.jsx';
import Breathwork from './pages/Breathwork.jsx';
import BreathworkTimer from './pages/BreathworkTimer.jsx';
import Yoga from './pages/Yoga.jsx';
import Session from './pages/Session.jsx';
import Profile from './pages/Profile.jsx';
import ExerciseHistory from './pages/ExerciseHistory.jsx';
import ExerciseProgress from './pages/ExerciseProgress.jsx';

export default function App() {
  const { user, loading, login, register, logout } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={login} />} />
        <Route path="/register" element={<Register onRegister={register} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <DataProvider>
      <div style={{ paddingBottom: 80 }}>
        <Routes>
          <Route path="/" element={<Workout onLogout={logout} />} />
          <Route path="/session" element={<Session />} />
          <Route path="/yoga" element={<Yoga />} />
          <Route path="/breathe" element={<Breathwork />} />
          <Route path="/breathe/:techniqueId" element={<BreathworkTimer />} />
          <Route path="/profile" element={<Profile onLogout={logout} />} />
          <Route path="/exercise-history" element={<ExerciseHistory />} />
          <Route path="/progress/:exerciseId" element={<ExerciseProgress />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <NavBar />
    </DataProvider>
  );
}
