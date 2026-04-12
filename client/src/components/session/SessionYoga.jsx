import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../utils/api.js';
import { C, MONO } from '../workout/tokens.jsx';
import { usePausableTimer } from '../../hooks/usePausableTimer.js';
import MidSessionPicker from './MidSessionPicker.jsx';
import SavePreferencePrompt from '../SavePreferencePrompt.jsx';

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
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [swapAlternatives, setSwapAlternatives] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swappedPoses, setSwappedPoses] = useState({}); // { index: { original, swapped } }
  const [savePromptData, setSavePromptData] = useState(null);
  const [promptedIndices, setPromptedIndices] = useState(new Set());
  const wasPausedBeforeSwapRef = useRef(false);

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
    navigatingRef.current = true;
    setCurrentIndex(index);
    poseTimer.start(); // resets elapsed to 0 and starts fresh
  }

  // Open swap picker for current pose
  const handleOpenSwap = useCallback(() => {
    if (!currentPose) return;
    wasPausedBeforeSwapRef.current = poseTimer.isPaused;
    poseTimer.pause();
    setSwapLoading(true);
    setShowSwapPicker(true);
    const params = new URLSearchParams({
      exerciseId: currentPose.id,
      category: currentPose.category || currentPose.phase || 'peak',
    });
    // Try to infer practice type from the session
    if (currentPose.practice_types?.length > 0) {
      params.set('practiceType', currentPose.practice_types[0]);
    }
    if (currentPose.difficulty) {
      params.set('maxDifficulty', currentPose.difficulty);
    }
    api.get(`/yoga/alternatives?${params}`)
      .then(data => setSwapAlternatives(data.alternatives || []))
      .catch(() => setSwapAlternatives([]))
      .finally(() => setSwapLoading(false));
  }, [currentPose, poseTimer]);

  const handleSwapSelect = useCallback((alt) => {
    setShowSwapPicker(false);
    const newPoses = [...poses];
    const original = newPoses[currentIndex];
    newPoses[currentIndex] = {
      ...alt,
      hold_seconds: original.hold_seconds,
      phase: original.phase,
      target_muscles: alt.target_muscles || original.target_muscles,
    };
    setSwappedPoses(prev => ({
      ...prev,
      [currentIndex]: { original, swapped: alt },
    }));
    setPoses(newPoses);
    poseTimer.start();
  }, [poses, currentIndex, poseTimer]);

  const handleSwapClose = useCallback(() => {
    setShowSwapPicker(false);
    if (!wasPausedBeforeSwapRef.current) {
      poseTimer.resume();
    }
  }, [poseTimer]);

  // Core advance logic shared by next/skip/auto-advance
  const advancePose = useCallback(() => {
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
  }, [currentIndex, poses, onComplete]);

  const handleNext = useCallback(() => {
    // Show save prompt for completed (not skipped) swapped poses
    const swapInfo = swappedPoses[currentIndex];
    if (swapInfo && !promptedIndices.has(currentIndex)) {
      setPromptedIndices(prev => new Set(prev).add(currentIndex));
      setSavePromptData({
        exerciseName: swapInfo.swapped.name,
        originalExerciseId: swapInfo.original.id,
        chosenExerciseId: swapInfo.swapped.id,
      });
    }
    advancePose();
  }, [currentIndex, poses, advancePose, swappedPoses, promptedIndices]);

  // Skip bypasses save prompt (spec: "User swaps then skips — No save prompt")
  const handleSkipPose = useCallback(() => {
    setPromptedIndices(prev => new Set(prev).add(currentIndex));
    advancePose();
  }, [currentIndex, advancePose]);

  function handlePrevious() {
    if (currentIndex > 0) {
      navigateTo(currentIndex - 1);
    }
  }

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
        position: 'relative',
      }}>
        {/* Name + swap row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginBottom: 4, padding: '0 4px',
        }}>
          <div style={{
            fontSize: 22, fontWeight: 600, color: C.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            minWidth: 0, flex: '0 1 auto',
          }}>
            {currentPose.name}
          </div>
          {currentPose.id && (
            <button onClick={handleOpenSwap} title="Swap pose" style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: 8,
              background: 'rgba(93,202,165,0.1)', border: '1px solid rgba(93,202,165,0.2)',
              color: '#5DCAA5', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3l4 4-4 4" />
                <path d="M20 7H4" />
                <path d="M8 21l-4-4 4-4" />
                <path d="M4 17h16" />
              </svg>
            </button>
          )}
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

      {showSwapPicker && (
        <MidSessionPicker
          type="yoga"
          currentName={currentPose.name}
          alternatives={swapAlternatives}
          loading={swapLoading}
          onSelect={handleSwapSelect}
          onClose={handleSwapClose}
          accentColor="#5DCAA5"
        />
      )}

      {savePromptData && (
        <SavePreferencePrompt
          exerciseName={savePromptData.exerciseName}
          originalExerciseId={savePromptData.originalExerciseId}
          chosenExerciseId={savePromptData.chosenExerciseId}
          saveAction={() => api.put('/workout/exercise-pref', {
            exercise_id: savePromptData.originalExerciseId,
            chosen_exercise_id: savePromptData.chosenExerciseId,
          })}
          onSave={() => setSavePromptData(null)}
          onDismiss={() => setSavePromptData(null)}
        />
      )}
    </div>
  );
}
