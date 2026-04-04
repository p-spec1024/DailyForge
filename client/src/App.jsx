import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import NavBar from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Workout from './pages/Workout.jsx';
import Habits from './pages/Habits.jsx';

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
    <>
      <div style={{ paddingBottom: 80 }}>
        <Routes>
          <Route path="/" element={<Workout onLogout={logout} />} />
          <Route path="/habits" element={<Habits onLogout={logout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <NavBar />
    </>
  );
}
