import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../utils/api.js';
import { C, MONO } from '../workout/tokens.jsx';
import { usePausableTimer } from '../../hooks/usePausableTimer.js';
import MidSessionPicker from '../session/MidSessionPicker.jsx';
import SavePreferencePrompt from '../SavePreferencePrompt.jsx';

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PHASE_LABELS = {
  warmup: 'Warm-up',
  peak: 'Peak',
  cooldown: 'Cool-down',
  savasana: 'Savasana',
};

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: '#0a1628',
    zIndex: 130,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px 8px',
  },
  phaseLabel: { fontSize: 13, color: '#5DCAA5', fontWeight: 600 },
  exitBtn: {
    background: 'none', border: 'none', fontSize: 12, color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer', padding: '6px 8px',
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '8px 16px 120px',
    WebkitOverflowScrolling: 'touch',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '0.5px solid rgba(93,202,165,0.2)',
    borderRadius: 14, padding: 20, textAlign: 'center',
  },
  poseName: { fontSize: 22, fontWeight: 600, color: '#fff', marginBottom: 4 },
  sanskrit: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: 16 },
  timer: (paused) => ({
    fontSize: 32, fontFamily: MONO, fontWeight: 300,
    color: paused ? 'rgba(255,255,255,0.4)' : '#fff',
    fontVariantNumeric: 'tabular-nums', marginBottom: 4,
  }),
  pausedLabel: {
    fontSize: 11, fontWeight: 600, letterSpacing: '1.5px',
    color: '#5DCAA5', textTransform: 'uppercase', marginBottom: 4,
  },
  progressOuter: {
    height: 4, borderRadius: 2,
    background: 'rgba(255,255,255,0.08)',
    marginBottom: 16, overflow: 'hidden', marginTop: 8,
  },
  progressInner: (pct) => ({
    height: '100%', borderRadius: 2,
    background: '#5DCAA5', width: `${pct * 100}%`,
    transition: 'width 0.25s linear',
  }),
  description: {
    fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5,
    textAlign: 'left', marginBottom: 16,
  },
  muscles: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  navRow: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    padding: '12px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(transparent, rgba(10,22,40,0.95) 30%)',
    display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center',
    zIndex: 140,
  },
  prevBtn: (disabled) => ({
    padding: '12px 24px', borderRadius: 10,
    background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)',
    color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.65)',
    fontSize: 14, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  }),
  pauseBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(93,202,165,0.1)', border: '1px solid rgba(93,202,165,0.25)',
    color: '#5DCAA5', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  nextBtn: {
    padding: '12px 24px', borderRadius: 10,
    background: 'rgba(93,202,165,0.15)', border: '1px solid rgba(93,202,165,0.3)',
    color: '#5DCAA5', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  doneScreen: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: 32, textAlign: 'center',
  },
  doneTitle: { fontSize: 26, fontWeight: 600, color: '#fff', marginBottom: 8 },
  doneSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 },
  doneBtn: {
    padding: '14px 36px', borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #5eead4 0%, #2dd4bf 100%)',
    color: '#0a1628', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};

export default function YogaSessionPlayer({ session, config, onExit }) {
  const [activePoses, setActivePoses] = useState(session?.poses || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'failed'
  const [saveError, setSaveError] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const phaseStartRef = useRef(Date.now());
  const navigatingRef = useRef(false);
  const savedRef = useRef(false);
  const lastFinishArgsRef = useRef(null);
  const poseTimer = usePausableTimer({ autoStart: true });
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [swapAlternatives, setSwapAlternatives] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swappedPoses, setSwappedPoses] = useState({});
  const [savePromptData, setSavePromptData] = useState(null);
  const [promptedIndices, setPromptedIndices] = useState(new Set());
  const wasPausedBeforeSwapRef = useRef(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    setDescExpanded(false);
    if (navigatingRef.current) navigatingRef.current = false;
  }, [currentIndex]);

  const poses = activePoses; // alias for minimal diff
  const currentPose = poses[currentIndex];
  const holdSeconds = currentPose?.hold_seconds || 30;

  // Swap handlers
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
    const newPoses = [...activePoses];
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
    setActivePoses(newPoses);
    poseTimer.start();
  }, [activePoses, currentIndex, poseTimer]);

  const handleSwapClose = useCallback(() => {
    setShowSwapPicker(false);
    if (!wasPausedBeforeSwapRef.current) {
      poseTimer.resume();
    }
  }, [poseTimer]);

  const saveSession = useCallback(async (payload) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      await api.post('/yoga/session', payload);
      setSaveState('saved');
    } catch (err) {
      setSaveState('failed');
      setSaveError(err?.userMessage || err?.message || 'Failed to save');
    }
  }, []);

  const finish = useCallback((didComplete) => {
    if (savedRef.current) return;
    savedRef.current = true;
    poseTimer.pause();
    setCompleted(true);

    const completedPoses = didComplete ? poses : poses.slice(0, currentIndex);
    const elapsedMin = Math.max(1, Math.round(
      (Date.now() - phaseStartRef.current) / 60000
    ));
    // For partial sessions, log actual elapsed time (clamped to server's 5-min floor).
    // For completed sessions, log the configured duration.
    const duration = didComplete
      ? config.duration
      : Math.max(5, Math.min(120, elapsedMin));

    const payload = {
      type: session?.type || config.type,
      level: config.level,
      duration,
      focus: config.focus,
      poses: completedPoses,
    };
    lastFinishArgsRef.current = payload;
    saveSession(payload);
  }, [poses, currentIndex, session, config, poseTimer, saveSession]);

  const retrySave = useCallback(() => {
    if (lastFinishArgsRef.current) {
      saveSession(lastFinishArgsRef.current);
    }
  }, [saveSession]);

  const goNext = useCallback(() => {
    // Show save prompt for swapped pose
    const swapInfo = swappedPoses[currentIndex];
    if (swapInfo && !promptedIndices.has(currentIndex)) {
      setPromptedIndices(prev => new Set(prev).add(currentIndex));
      setSavePromptData({
        exerciseName: swapInfo.swapped.name,
        originalExerciseId: swapInfo.original.id,
        chosenExerciseId: swapInfo.swapped.id,
      });
    }
    if (currentIndex >= poses.length - 1) {
      finish(true);
      return;
    }
    navigatingRef.current = true;
    setCurrentIndex(i => i + 1);
    poseTimer.start();
  }, [currentIndex, poses.length, finish, poseTimer, swappedPoses, promptedIndices]);

  const goPrev = () => {
    if (currentIndex <= 0) return;
    navigatingRef.current = true;
    setCurrentIndex(i => i - 1);
    poseTimer.start();
  };

  // Auto-advance when hold time expires
  useEffect(() => {
    if (navigatingRef.current || poseTimer.isPaused || !currentPose || completed) return;
    if (poseTimer.elapsed >= holdSeconds) {
      navigatingRef.current = true;
      goNext();
    }
  }, [poseTimer.elapsed, poseTimer.isPaused, holdSeconds, currentPose, goNext, completed]);

  if (!currentPose && !completed) {
    return (
      <div style={s.overlay}>
        <div style={s.doneScreen}>
          <div style={s.doneTitle}>No poses to play</div>
          <button style={s.doneBtn} onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div style={s.overlay}>
        <div style={s.doneScreen}>
          <div style={s.doneTitle}>Session complete</div>
          <div style={s.doneSub}>
            {poses.length} poses · {config.duration}m {config.type}
          </div>

          {saveState === 'saving' && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
              Saving session…
            </div>
          )}
          {saveState === 'saved' && (
            <div style={{ fontSize: 12, color: '#5DCAA5', marginBottom: 16 }}>
              ✓ Saved
            </div>
          )}
          {saveState === 'failed' && (
            <div style={{
              padding: '10px 14px', marginBottom: 16, borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', fontSize: 12, maxWidth: 300,
            }}>
              Couldn't save: {saveError || 'unknown error'}
            </div>
          )}

          {saveState === 'failed' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ ...s.doneBtn, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                onClick={retrySave}
              >Retry</button>
              <button style={s.doneBtn} onClick={onExit}>Done anyway</button>
            </div>
          ) : (
            <button
              style={{ ...s.doneBtn, ...(saveState === 'saving' && { opacity: 0.5, cursor: 'default' }) }}
              onClick={onExit}
              disabled={saveState === 'saving'}
            >Done</button>
          )}
        </div>
      </div>
    );
  }

  const progress = Math.min(1, poseTimer.elapsed / holdSeconds);
  const phaseLabel = PHASE_LABELS[currentPose.phase] || 'Practice';
  const description = currentPose.description || '';
  const showReadMore = description.length > 140;
  const shortDesc = showReadMore ? description.slice(0, 140).trimEnd() + '…' : description;

  return (
    <div style={s.overlay}>
      <div style={s.topBar}>
        <div style={s.phaseLabel}>
          {phaseLabel} · {currentIndex + 1} of {poses.length}
        </div>
        <button style={s.exitBtn} onClick={() => finish(false)}>End session</button>
      </div>

      <div style={s.body}>
        <div style={{ ...s.card, position: 'relative' }}>
          {/* Name + swap row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 4, padding: '0 4px',
          }}>
            <div style={{
              ...s.poseName, marginBottom: 0,
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
            <div style={s.sanskrit}>{currentPose.sanskrit_name}</div>
          )}

          <div style={s.timer(poseTimer.isPaused)}>
            {formatTime(poseTimer.elapsed)} / {formatTime(holdSeconds)}
          </div>

          {poseTimer.isPaused && <div style={s.pausedLabel}>Paused</div>}

          <div style={s.progressOuter}>
            <div style={s.progressInner(progress)} />
          </div>

          {description && (
            <div style={s.description}>
              {descExpanded || !showReadMore ? description : shortDesc}
              {showReadMore && (
                <button
                  onClick={() => setDescExpanded(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#5DCAA5', fontSize: 12, fontWeight: 500, marginLeft: 4, padding: 0,
                  }}
                >{descExpanded ? 'Show less' : 'Read more'}</button>
              )}
            </div>
          )}

          {currentPose.target_muscles && (
            <div style={s.muscles}>{currentPose.target_muscles}</div>
          )}
        </div>
      </div>

      <div style={s.navRow}>
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          style={s.prevBtn(currentIndex === 0)}
        >Previous</button>

        <button
          onClick={poseTimer.isPaused ? poseTimer.resume : poseTimer.pause}
          style={s.pauseBtn}
          aria-label={poseTimer.isPaused ? 'Resume' : 'Pause'}
        >
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

        <button onClick={goNext} style={s.nextBtn}>
          {currentIndex >= poses.length - 1 ? 'Finish' : 'Next →'}
        </button>
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
