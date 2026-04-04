import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import NavBar from './components/NavBar.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Workout from './pages/Workout.jsx';

function PlaceholderPage({ title, onLogout }) {
  return (
    <div style={{
      maxWidth: 420, margin: '0 auto', padding: '20px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100vh - 80px)',
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>{title}</h2>
    </div>
  );
}

function ProfilePage({ onLogout }) {
  return (
    <div style={{
      maxWidth: 420, margin: '0 auto', padding: '20px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 'calc(100vh - 80px)',
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>Profile</h2>
      {onLogout && (
        <button onClick={onLogout} style={{
          marginTop: 24, padding: '10px 24px', borderRadius: 8,
          background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer',
        }}>
          Log out
        </button>
      )}
    </div>
  );
}

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
          <Route path="/yoga" element={<PlaceholderPage title="Yoga" />} />
          <Route path="/breathe" element={<PlaceholderPage title="Breathe" />} />
          <Route path="/profile" element={<ProfilePage onLogout={logout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <NavBar />
    </>
  );
}
