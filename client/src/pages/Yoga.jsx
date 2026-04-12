import { useState } from 'react';
import { useYogaSession } from '../hooks/useYogaSession.js';
import PracticeTypeSelector from '../components/yoga/PracticeTypeSelector.jsx';
import LevelSelector from '../components/yoga/LevelSelector.jsx';
import DurationSelector from '../components/yoga/DurationSelector.jsx';
import FocusChips from '../components/yoga/FocusChips.jsx';
import RecentSessions from '../components/yoga/RecentSessions.jsx';
import StartButton from '../components/yoga/StartButton.jsx';
import PosePreviewModal from '../components/yoga/PosePreviewModal.jsx';
import YogaSessionPlayer from '../components/yoga/YogaSessionPlayer.jsx';

const s = {
  page: {
    maxWidth: 420,
    margin: '0 auto',
    padding: '0 16px',
    background: '#0a1628',
    minHeight: 'calc(100vh - 80px)',
    position: 'relative',
    paddingBottom: 90,
  },
  header: {
    fontSize: 17,
    fontWeight: 600,
    color: '#fff',
    letterSpacing: '-0.2px',
    padding: '2px 0 18px',
  },
};

export default function Yoga() {
  const [playingSession, setPlayingSession] = useState(null);
  const {
    config,
    recentSessions,
    isGenerating,
    generatedSession,
    error,
    selectType,
    selectLevel,
    selectDuration,
    toggleFocus,
    loadRecent,
    generateSession,
    clearSession,
  } = useYogaSession();

  const handleStart = async () => {
    try {
      await generateSession();
    } catch {
      // error state is set by the hook
    }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>Yoga</div>
      {error && (
        <div style={{
          padding: '8px 12px',
          marginBottom: 12,
          borderRadius: 8,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#fca5a5',
          fontSize: 12,
        }}>
          {error}
        </div>
      )}
      <PracticeTypeSelector selected={config.type} onSelect={selectType} />
      <LevelSelector selected={config.level} onSelect={selectLevel} />
      <DurationSelector selected={config.duration} onSelect={selectDuration} />
      <FocusChips selected={config.focus} onToggle={toggleFocus} />
      <RecentSessions sessions={recentSessions} onLoad={loadRecent} />
      <StartButton config={config} isGenerating={isGenerating} onStart={handleStart} />

      {generatedSession && !playingSession && (
        <PosePreviewModal
          session={generatedSession}
          config={config}
          isGenerating={isGenerating}
          onRegenerate={handleStart}
          onBegin={() => {
            setPlayingSession(generatedSession);
            clearSession();
          }}
          onClose={clearSession}
        />
      )}

      {playingSession && (
        <YogaSessionPlayer
          session={playingSession}
          config={config}
          onExit={() => setPlayingSession(null)}
        />
      )}
    </div>
  );
}
