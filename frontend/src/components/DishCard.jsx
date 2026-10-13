import { useEffect, useRef, useState } from 'react';
import { updateDish } from '../api';

// `dish` is the SAVED version from the server. Edits are kept in a local draft.
export default function DishCard({ dish, onSaved }) {
  // Draft = what the user is typing. It is NOT sent anywhere until Save.
  const [draft, setDraft] = useState({
    dishName: dish.dishName,
    isPublished: dish.isPublished,
  });
  // baseVersion = the version the draft was started from. Sent as expectedVersion.
  const [baseVersion, setBaseVersion] = useState(dish.version);

  // The values the draft started from (used to tell if the USER edited anything)
  const baseValues = useRef({ dishName: dish.dishName, isPublished: dish.isPublished });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflictDish, setConflictDish] = useState(null); // set on 409
  const [imageFailed, setImageFailed] = useState(false);

  // Dirty = the draft differs from the saved values
  const isDirty =
    draft.dishName !== dish.dishName || draft.isPublished !== dish.isPublished;

  function resetDraftTo(source) {
    baseValues.current = { dishName: source.dishName, isPublished: source.isPublished };
    setDraft({ dishName: source.dishName, isPublished: source.isPublished });
    setBaseVersion(source.version);
    setError('');
    setConflictDish(null);
  }

  // Saved data changed (e.g. from polling). Decide what to do with the draft.
  useEffect(() => {
    if (dish.version === baseVersion) return; // nothing new
    const userEdited =
      draft.dishName !== baseValues.current.dishName ||
      draft.isPublished !== baseValues.current.isPublished;
    // No edits to protect -> safe to follow the server.
    // If the user has edits, leave the draft AND baseVersion alone: a later Save
    // will send the old version and get a 409, so nothing is overwritten silently.
    if (!userEdited || !isDirty) resetDraftTo(dish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish]);

  const newerAvailable = dish.version !== baseVersion && isDirty;

  async function handleSave() {
    setSaving(true);
    setError('');
    setConflictDish(null);
    try {
      const updated = await updateDish(dish.dishId, {
        dishName: draft.dishName,
        isPublished: draft.isPublished,
        expectedVersion: baseVersion,
      });
      onSaved(updated); // update the saved list in App
      resetDraftTo(updated); // draft now matches saved, badge disappears
    } catch (err) {
      // Keep the draft in every failure case so the user doesn't lose their edits
      if (err.status === 409) {
        setConflictDish(err.currentDish);
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    resetDraftTo(dish);
  }

  // We never auto-retry with the new version: the user must choose to throw away their draft
  function handleReloadLatest() {
    const ok = window.confirm('Reloading will discard your draft changes. Continue?');
    if (!ok) return;
    onSaved(conflictDish); // saved list gets the latest dish from the server
    resetDraftTo(conflictDish);
  }

  return (
    <div className={`dish-card ${isDirty ? 'dirty' : ''}`}>
      {imageFailed ? (
        <div className="image-placeholder">No image</div>
      ) : (
        <img
          className="dish-image"
          src={dish.imageUrl}
          alt={dish.dishName}
          onError={() => setImageFailed(true)}
        />
      )}

      <div className="dish-body">
        <p className="dish-meta">
          ID: {dish.dishId} · Version: {dish.version} ·{' '}
          {dish.isPublished ? 'Published' : 'Unpublished'}
        </p>

        {isDirty && <span className="badge">Unsaved changes</span>}

        <label>
          Name
          <input
            type="text"
            value={draft.dishName}
            onChange={(e) => setDraft({ ...draft, dishName: e.target.value })}
          />
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={draft.isPublished}
            onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })}
          />
          Published
        </label>

        {newerAvailable && !conflictDish && (
          <p className="notice-text">
            A newer version is available. Save will conflict; reload to see it.
          </p>
        )}

        {error && <p className="error-text">{error}</p>}

        {conflictDish && (
          <div className="conflict-box">
            <p>Someone else updated this dish.</p>
            <button onClick={handleReloadLatest}>Reload latest</button>
          </div>
        )}

        <div className="button-row">
          <button onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={handleDiscard} disabled={saving || !isDirty}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
