import { useState, useCallback } from 'react';

/**
 * Manages save-as-routine state: open/close modal, track if already saved.
 * Returns { isOpen, hasBeenSaved, open, close, onSaved, canSave(exercises) }.
 * Caller renders <SaveRoutineModal isOpen={isOpen} onClose={close} exercises={...} onSaved={onSaved} />.
 */
export function useSaveRoutine() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasBeenSaved, setHasBeenSaved] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const onSaved = useCallback(() => {
    setHasBeenSaved(true);
    setIsOpen(false);
  }, []);

  // Helper: returns the open callback only if save is available, else undefined.
  // Use as: onSaveRoutine={canSave(exercises) ? open : undefined}
  const canSave = useCallback((exercises) => {
    return !hasBeenSaved && exercises && exercises.length > 0;
  }, [hasBeenSaved]);

  return { isOpen, hasBeenSaved, open, close, onSaved, canSave };
}
