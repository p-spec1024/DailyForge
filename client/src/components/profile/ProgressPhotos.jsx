import { useEffect, useRef, useState } from 'react';
import { C } from '../workout/tokens.jsx';
import { api } from '../../utils/api.js';
import {
  savePhoto,
  getPhoto,
  deletePhoto,
  blobToUrl,
} from '../../services/photoStorage.js';

const MAX_PHOTOS = 50;

export default function ProgressPhotos() {
  const [photos, setPhotos] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [viewing, setViewing] = useState(null);
  const [viewingUrl, setViewingUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  // Refs mirror state so the unmount-only cleanup can revoke whatever's current
  // without depending on state in the effect (which would cause stale-cleanup bugs).
  const thumbsRef = useRef({});
  const viewingUrlRef = useRef(null);
  useEffect(() => { thumbsRef.current = thumbs; }, [thumbs]);
  useEffect(() => { viewingUrlRef.current = viewingUrl; }, [viewingUrl]);

  useEffect(() => {
    let alive = true;
    loadPhotos(() => alive);
    return () => {
      alive = false;
      Object.values(thumbsRef.current).forEach((url) => url && URL.revokeObjectURL(url));
      if (viewingUrlRef.current) URL.revokeObjectURL(viewingUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPhotos(isAlive = () => true) {
    try {
      const meta = await api.get('/progress-photos');
      const entries = await Promise.all(
        meta.map(async (p) => {
          const stored = await getPhoto(p.local_storage_key);
          return [p.id, stored?.thumbnailBlob ? blobToUrl(stored.thumbnailBlob) : null];
        })
      );
      if (!isAlive()) {
        // Component unmounted mid-load — release the URLs we just created.
        entries.forEach(([, url]) => url && URL.revokeObjectURL(url));
        return;
      }
      setPhotos(meta);
      setThumbs((prev) => {
        Object.values(prev).forEach((url) => url && URL.revokeObjectURL(url));
        return Object.fromEntries(entries);
      });
    } catch (e) {
      if (isAlive()) setError(e?.userMessage || e?.message || 'Failed to load photos');
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= MAX_PHOTOS) {
      setError(`Photo limit (${MAX_PHOTOS}) reached. Delete some to add more.`);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const key = await savePhoto(file);
      const meta = await api.post('/progress-photos', {
        taken_at: new Date().toISOString().slice(0, 10),
        view: 'front',
        local_storage_key: key,
      });
      const stored = await getPhoto(key);
      setPhotos((prev) => [meta, ...prev]);
      setThumbs((prev) => {
        const next = { ...prev };
        if (next[meta.id]) URL.revokeObjectURL(next[meta.id]);
        next[meta.id] = stored?.thumbnailBlob ? blobToUrl(stored.thumbnailBlob) : null;
        return next;
      });
    } catch (err) {
      setError(err?.userMessage || err?.message || 'Failed to save photo');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleView(photo) {
    const stored = await getPhoto(photo.local_storage_key);
    if (stored?.imageBlob) {
      setViewing(photo);
      setViewingUrl(blobToUrl(stored.imageBlob));
    }
  }

  function closeView() {
    if (viewingUrl) URL.revokeObjectURL(viewingUrl);
    setViewing(null);
    setViewingUrl(null);
  }

  async function handleDelete(photo) {
    if (!confirm('Delete this photo? It cannot be recovered.')) return;
    try {
      await api.delete(`/progress-photos/${photo.id}`);
      await deletePhoto(photo.local_storage_key);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setThumbs((prev) => {
        if (prev[photo.id]) URL.revokeObjectURL(prev[photo.id]);
        const { [photo.id]: _drop, ...rest } = prev;
        return rest;
      });
      if (viewing?.id === photo.id) closeView();
    } catch (e) {
      setError(e?.userMessage || e?.message || 'Failed to delete photo');
    }
  }

  return (
    <div style={{
      background: C.card,
      border: C.border,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 10, color: C.textMuted, textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Progress photos · {photos.length}/{MAX_PHOTOS}
        </div>
        {photos.length > 0 && (
          <label
            htmlFor="photo-input"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(216,90,48,0.18)',
              color: C.accent,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 36,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {busy ? 'Saving…' : '+ Photo'}
          </label>
        )}
        <input
          id="photo-input"
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {error && (
        <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>
      )}

      {photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 12px 12px' }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📷</div>
          <div style={{ color: C.text, fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            No progress photos
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 16 }}>
            Photos stay on this device only
          </div>
          <label
            htmlFor="photo-input"
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '10px 20px', borderRadius: 8,
              background: 'rgba(216,90,48,0.18)', color: C.accent,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', minHeight: 36,
            }}
          >
            {busy ? 'Saving…' : '+ Take first photo'}
          </label>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}>
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => handleView(p)}
              style={{
                aspectRatio: '1 / 1',
                border: 'none',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {thumbs[p.id] ? (
                <img
                  src={thumbs[p.id]}
                  alt={p.taken_at}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.textMuted, fontSize: 10,
                }}>
                  Missing
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                color: '#fff', fontSize: 10, padding: '8px 4px 4px',
                textAlign: 'center',
              }}>
                {new Date(p.taken_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </button>
          ))}
        </div>
      )}

      {viewing && viewingUrl && (
        <div
          onClick={closeView}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, padding: 20, flexDirection: 'column', gap: 16,
          }}
        >
          <img
            src={viewingUrl}
            alt={viewing.taken_at}
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(viewing); }}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: 'rgba(239,68,68,0.18)', color: '#ef4444',
                fontSize: 13, cursor: 'pointer', minHeight: 40,
              }}
            >
              Delete
            </button>
            <button
              onClick={closeView}
              style={{
                padding: '10px 18px', borderRadius: 8, border: 'none',
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                fontSize: 13, cursor: 'pointer', minHeight: 40,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
