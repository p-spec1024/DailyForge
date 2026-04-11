import { useEffect, useState } from 'react';
import { C } from '../workout/tokens.jsx';
import { api } from '../../utils/api.js';
import HeightPromptModal from './HeightPromptModal.jsx';
import AddMeasurementModal from './AddMeasurementModal.jsx';
import MeasurementsSummary from './MeasurementsSummary.jsx';
import MeasurementsChart from './MeasurementsChart.jsx';
import CircumferencesCard from './CircumferencesCard.jsx';
import ProgressPhotos from './ProgressPhotos.jsx';

export default function BodyMeasurements({ profile, onProfileChange }) {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [e, s] = await Promise.all([
          api.get('/body-measurements'),
          api.get('/body-measurements/stats'),
        ]);
        if (!alive) return;
        setEntries(e);
        setStats(s);
      } catch (err) {
        if (alive) setError(err?.userMessage || 'Failed to load measurements');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function refresh() {
    try {
      const [e, s] = await Promise.all([
        api.get('/body-measurements'),
        api.get('/body-measurements/stats'),
      ]);
      setEntries(e);
      setStats(s);
    } catch (err) {
      setError(err?.userMessage || 'Failed to refresh measurements');
    }
  }

  if (loading) {
    return (
      <div style={{ color: C.textMuted, fontSize: 13, padding: 16 }}>
        Loading body measurements…
      </div>
    );
  }

  const needsHeight = profile.height_cm == null;
  const unitSystem = profile.unit_system || 'metric';

  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{
        margin: '4px 4px 12px',
        color: C.text,
        fontSize: 16,
        fontWeight: 500,
      }}>Body Measurements</h2>

      {error && (
        <div style={{
          color: '#ef4444', fontSize: 12, padding: 12, marginBottom: 12,
          background: 'rgba(239,68,68,0.08)', borderRadius: 8,
        }}>{error}</div>
      )}

      <MeasurementsSummary
        stats={stats}
        unitSystem={unitSystem}
        onAdd={() => setShowAdd(true)}
      />

      {entries.length > 0 && (
        <MeasurementsChart entries={entries} unitSystem={unitSystem} />
      )}

      <CircumferencesCard stats={stats} unitSystem={unitSystem} />

      <ProgressPhotos />

      {needsHeight && (
        <HeightPromptModal
          unitSystem={unitSystem}
          onSaved={(updated) => onProfileChange?.(updated)}
        />
      )}

      {showAdd && (
        <AddMeasurementModal
          unitSystem={unitSystem}
          onClose={() => setShowAdd(false)}
          onSaved={() => refresh()}
        />
      )}
    </div>
  );
}
