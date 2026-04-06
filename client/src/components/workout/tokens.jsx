/* ── Shared design tokens and helpers for workout components ── */

export const C = {
  bg: '#0c1222',
  card: 'rgba(255,255,255,0.04)',
  border: '0.5px solid rgba(255,255,255,0.06)',
  text: 'rgba(255,255,255,0.95)',
  textSec: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.35)',
  textHint: 'rgba(255,255,255,0.2)',
  accent: '#D85A30',
  green: '#1D9E75',
};

export const MONO = "'SF Mono', 'Fira Code', monospace";

export function typeColor(type) {
  if (!type) return '#D85A30';
  const t = type.toLowerCase();
  if (t === 'strength') return '#D85A30';
  if (t === 'yoga') return '#1D9E75';
  if (t === 'breathwork') return '#a78bfa';
  if (t === 'cardio') return '#F9CB40';
  if (t === 'stretch' || t === 'mobility') return '#5DCAA5';
  return '#D85A30';
}

export function formatExerciseDetail(ex) {
  const parts = [];
  if (ex.default_sets && ex.default_reps) parts.push(`${ex.default_sets} \u00d7 ${ex.default_reps}`);
  else if (ex.default_sets) parts.push(`${ex.default_sets} sets`);
  else if (ex.default_reps) parts.push(`\u00d7${ex.default_reps}`);
  if (ex.default_duration_secs) {
    const m = Math.floor(ex.default_duration_secs / 60);
    const s = ex.default_duration_secs % 60;
    parts.push(m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`);
  }
  return parts.join(' \u00b7 ') || null;
}

export function formatVolume(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(v));
}

export function youtubeSearchUrl(name, type) {
  const n = encodeURIComponent(name).replace(/%20/g, '+');
  const t = (type || '').toLowerCase();
  if (t === 'yoga') return `https://www.youtube.com/results?search_query=${n}+yoga+pose+tutorial`;
  if (t === 'breathwork') return `https://www.youtube.com/results?search_query=${n}+breathing+technique`;
  if (t === 'strength') return `https://www.youtube.com/results?search_query=${n}+dumbbell+exercise+form`;
  if (t === 'stretch' || t === 'mobility') return `https://www.youtube.com/results?search_query=${n}+stretch+tutorial`;
  if (t === 'cardio') return `https://www.youtube.com/results?search_query=${n}+exercise+tutorial`;
  return `https://www.youtube.com/results?search_query=${n}+exercise+tutorial`;
}

export function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function isStrengthPhase(phase) {
  return phase.phase === 'main';
}

export const YTIcon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
    <rect width="20" height="14" rx="3" fill="#FF0000" />
    <polygon points="8,3 8,11 14,7" fill="#fff" />
  </svg>
);
