import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { C } from '../components/workout/tokens.jsx';
import WorkoutCalendar from '../components/Calendar/WorkoutCalendar.jsx';
import BodyMeasurements from '../components/profile/BodyMeasurements.jsx';
import ProfileSettings from '../components/profile/ProfileSettings.jsx';
import { api } from '../utils/api.js';

export default function Profile({ onLogout }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get('/users/profile')
      .then((p) => { if (alive) { setProfile(p); setProfileLoading(false); } })
      .catch((err) => {
        if (alive) {
          setProfileError(err?.userMessage || 'Failed to load profile');
          setProfileLoading(false);
        }
      });
    return () => { alive = false; };
  }, []);

  const unitSystem = profile?.unit_system || 'metric';

  return (
    <div style={{
      maxWidth: 480,
      margin: '0 auto',
      padding: '24px 16px',
    }}>
      <h1 style={{
        margin: '8px 4px 20px',
        color: C.text,
        fontSize: 20,
        fontWeight: 500,
      }}>Profile</h1>

      <WorkoutCalendar />

      <div
        onClick={() => navigate('/exercise-history')}
        style={{
          background: C.card,
          border: C.border,
          borderRadius: 12,
          padding: '16px 18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ color: C.text, fontSize: 15, fontWeight: 500, marginBottom: 2 }}>
            📊 Exercise History
          </div>
          <div style={{ color: C.textMuted, fontSize: 12 }}>
            View your progression charts
          </div>
        </div>
        <span style={{ color: C.textMuted, fontSize: 18 }}>›</span>
      </div>

      {profile && (
        <ProfileSettings unitSystem={unitSystem} onChange={setProfile} />
      )}

      {profileLoading && (
        <div style={{
          color: C.textMuted, fontSize: 13, padding: 16, marginTop: 16,
        }}>
          Loading profile…
        </div>
      )}

      {profileError && (
        <div style={{
          color: '#ef4444', fontSize: 13, padding: 12, marginTop: 16,
          background: 'rgba(239,68,68,0.08)', borderRadius: 10,
        }}>
          Couldn't load profile: {profileError}
        </div>
      )}

      {profile && (
        <BodyMeasurements
          profile={profile}
          onProfileChange={setProfile}
        />
      )}

      {onLogout && (
        <button
          onClick={onLogout}
          style={{
            marginTop: 24,
            padding: '12px 24px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.12)',
            color: C.textSec,
            fontSize: 14,
            cursor: 'pointer',
            width: '100%',
            minHeight: 44,
          }}
        >
          Log out
        </button>
      )}
    </div>
  );
}
