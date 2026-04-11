import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../utils/api.js';
import { C, MONO } from '../workout/tokens.jsx';
import { usePausableTimer } from '../../hooks/usePausableTimer.js';

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getFirstSentence(text) {
  if (!text) return '';
  const match = text.match(/^[^.!?]*[.!?]/);
  return match ? match[0] : text.slice(0, 100) + (text.length > 100 ? '...' : '');
}

function PoseDescription({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const short = getFirstSentence(text);
  const isLong = text.length > short.length + 5;

  return (
    <div style={{
      fontSize: 13, color: C.textSec, lineHeight: 1.5,
      textAlign: 'left', marginBottom: 16,
    }}>
      {expanded ? text : short}
      {isLong && (
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#5DCAA5', fontSize: 12, fontWeight: 500, marginLeft: 4,
          padding: 0,
        }}>{expanded ? 'Show less' : 'Read more'}</button>
      )}
    </div>
  );
}

export default function SessionYoga({ phase, duration, level, focus, onComplete }) {
  const [poses, setPoses] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const phaseStartRef = useRef(Date.now());
  const autoStartedRef = useRef(false);

  // Shared pausable timer for pose hold tracking
  const poseTimer = usePausableTimer();

  // Determine category filter
  const categoryFilter = phase === 'warmup' ? 'warmup,flow' : 'cooldown,savasana';
  const durationMin = Math.round(duration / 60);

  useEffect(() => {
    const params = new URLSearchParams({
      duration: durationMin,
      level,
      category_filter: categoryFilter,
    });
    if (focus?.length > 0) params.set('focus', focus.join(','));
    api.get(`/yoga/generate?${params}`)
      .then(data => {
        const p = data.session?.poses || [];
        setPoses(p);
        if (p.length > 0 && !autoStartedRef.current) {
          autoStartedRef.current = true;
          phaseStartRef.current = Date.now();
          setIsActive(true);
          poseTimer.start();
        }
      })
      .catch(() => { setPoses([]); setLoadError(true); })
      .finally(() => setLoading(false));
  }, [durationMin, level, categoryFilter]);

  const currentPose = poses[currentIndex];
  const holdSeconds = currentPose?.hold_seconds || 30;

  // Guard: prevents auto-advance from re-firing immediately after navigation
  const navigatingRef = useRef(false);

  // Reset the navigation guard after React commits the new index
  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false;
    }
  }, [currentIndex]);

  function navigateTo(index) {
    console.log('[SessionYoga] navigateTo:', index, 'from:', currentIndex);
    navigatingRef.current = true;
    setCurrentIndex(index);
    poseTimer.start(); // resets elapsed to 0 and starts fresh
  }

  const handleNext = useCallback(() => {
    console.log('[SessionYoga] handleNext, currentIndex:', currentIndex, 'total:', poses.length);
    if (currentIndex >= poses.length - 1) {
      const actualDuration = Math.floor((Date.now() - phaseStartRef.current) / 1000);
      onComplete({
        completed: true,
        poses_done: poses.length,
        pose_names: poses.map(p => p.name),
        duration: actualDuration,
      });
    } else {
      navigateTo(currentIndex + 1);
    }
  }, [currentIndex, poses, onComplete, poseTimer]);

  function handlePrevious() {
    console.log('[SessionYoga] Previous tapped, currentIndex:', currentIndex);
    if (currentIndex > 0) {
      navigateTo(currentIndex - 1);
    }
  }

  const handleSkipPose = () => {
    handleNext();
  };

  const handlePause = () => {
    poseTimer.pause();
  };

  const handleResume = () => {
    poseTimer.resume();
  };

  // Auto-advance when pose hold time expires
  useEffect(() => {
    if (navigatingRef.current || poseTimer.isPaused || !currentPose) return;
    if (poseTimer.elapsed >= holdSeconds) {
      console.log('[SessionYoga] auto-advance at elapsed:', poseTimer.elapsed, '>=', holdSeconds);
      navigatingRef.current = true;
      handleNext();
    }
  }, [poseTimer.elapsed, poseTimer.isPaused, holdSeconds, currentPose, handleNext]);

  const handleEndPhase = () => {
    const actualDuration = Math.floor((Date.now() - phaseStartRef.current) / 1000);
    onComplete({
      completed: false,
      poses_done: currentIndex,
      pose_names: poses.slice(0, currentIndex).map(p => p.name),
      duration: actualDuration,
    });
  };

  if (loading) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>Generating {phase} sequence...</div>;
  }

  if (poses.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ color: loadError ? '#f87171' : C.textMuted, marginBottom: 16, fontSize: 14 }}>
          {loadError ? 'Failed to load yoga poses' : 'No poses found for this configuration'}
        </div>
        <button onClick={handleEndPhase} style={{
          padding: '12px 32px', borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.08)', color: C.textSec,
          fontSize: 14, cursor: 'pointer',
        }}>Skip</button>
      </div>
    );
  }

  if (!isActive) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted }}>Starting...</div>;
  }

  const progress = Math.min(1, poseTimer.elapsed / holdSeconds);
  const phaseLabel = phase === 'warmup' ? 'Warm-up' : 'Cool-down';

  return (
    <div style={{ padding: '10px 0' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: '#5DCAA5', fontWeight: 600 }}>
          {phaseLabel} &middot; {currentIndex + 1} of {poses.length}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={handleSkipPose} style={{
            background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer',
          }}>Skip ›</button>
          <button onClick={handleEndPhase} style={{
            background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer',
          }}>End {phaseLabel}</button>
        </div>
      </div>

      {/* Pose card */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '0.5px solid rgba(93,202,165,0.2)',
        borderRadius: 14, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: C.text, marginBottom: 4 }}>
          {currentPose.name}
        </div>
        {currentPose.sanskrit_name && (
          <div style={{ fontSize: 13, color: C.textMuted, fontStyle: 'italic', marginBottom: 16 }}>
            {currentPose.sanskrit_name}
          </div>
        )}

        {/* Timer */}
        <div style={{
          fontSize: 32, fontFamily: MONO, fontWeight: 300,
          color: poseTimer.isPaused ? 'rgba(255,255,255,0.4)' : C.text,
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 4,
        }}>
          {formatTime(poseTimer.elapsed)} / {formatTime(holdSeconds)}
        </div>

        {/* Paused indicator */}
        {poseTimer.isPaused && (
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '1.5px',
            color: '#5DCAA5', textTransform: 'uppercase', marginBottom: 4,
          }}>PAUSED</div>
        )}

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
          marginBottom: 16, overflow: 'hidden', marginTop: poseTimer.isPaused ? 4 : 8,
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: '#5DCAA5',
            width: `${progress * 100}%`,
            transition: 'width 0.25s linear',
          }} />
        </div>

        {/* Description */}
        <PoseDescription text={currentPose.description} />

        {/* Muscles */}
        {currentPose.target_muscles && (
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>
            {currentPose.target_muscles}
          </div>
        )}
      </div>

      {/* Navigation + Pause */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 16,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <button onClick={handlePrevious} disabled={currentIndex === 0} style={{
          padding: '12px 24px', borderRadius: 10,
          background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
          color: currentIndex === 0 ? C.textHint : C.textSec,
          fontSize: 14, cursor: currentIndex === 0 ? 'default' : 'pointer',
          opacity: currentIndex === 0 ? 0.4 : 1,
        }}>Previous</button>

        {/* Pause/Resume button */}
        <button onClick={poseTimer.isPaused ? handleResume : handlePause} style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(93,202,165,0.1)', border: '1px solid rgba(93,202,165,0.25)',
          color: '#5DCAA5', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {poseTimer.isPaused ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 20,12 6,21" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          )}
        </button>

        <button onClick={handleNext} style={{
          padding: '12px 24px', borderRadius: 10,
          background: 'rgba(93,202,165,0.15)', border: '1px solid rgba(93,202,165,0.3)',
          color: '#5DCAA5', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>{currentIndex >= poses.length - 1 ? 'Finish' : 'Next \u2192'}</button>
      </div>
    </div>
  );
}
