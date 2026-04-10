import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../utils/api.js';

const DEFAULTS = {
  type: 'vinyasa',
  level: 'intermediate',
  duration: 30,
  focus: [],
};

export function useYogaSession() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('yoga_config');
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSession, setGeneratedSession] = useState(null);
  const [error, setError] = useState(null);

  // Persist config
  useEffect(() => {
    localStorage.setItem('yoga_config', JSON.stringify(config));
  }, [config]);

  // Load recent sessions on mount
  useEffect(() => {
    api.get('/yoga/recent').then(data => {
      setRecentSessions(data.sessions || []);
    }).catch(() => {});
  }, []);

  const selectType = useCallback((type) => {
    setConfig(prev => ({ ...prev, type }));
  }, []);

  const selectLevel = useCallback((level) => {
    setConfig(prev => ({ ...prev, level }));
  }, []);

  const selectDuration = useCallback((duration) => {
    setConfig(prev => ({ ...prev, duration }));
  }, []);

  const toggleFocus = useCallback((area) => {
    setConfig(prev => {
      const focus = prev.focus.includes(area)
        ? prev.focus.filter(f => f !== area)
        : [...prev.focus, area];
      return { ...prev, focus };
    });
  }, []);

  const loadRecent = useCallback((session) => {
    setConfig({
      type: session.type || 'vinyasa',
      level: session.level || 'intermediate',
      duration: session.duration || 30,
      focus: session.focus || [],
    });
  }, []);

  const generatingRef = useRef(false);

  const generateSession = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setIsGenerating(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: config.type,
        level: config.level,
        duration: String(config.duration),
      });
      if (config.focus.length > 0) {
        params.set('focus', config.focus.join(','));
      }
      const data = await api.get(`/yoga/generate?${params}`);
      setGeneratedSession(data.session);
      return data.session;
    } catch (err) {
      setError(err.message || 'Failed to generate session');
      throw err;
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [config]);

  const clearSession = useCallback(() => {
    setGeneratedSession(null);
  }, []);

  return {
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
  };
}
