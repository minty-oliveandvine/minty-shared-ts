"use client";

/**
 * My Profile: read the person (and the company it was opened from, when it was), and edit the
 * details card - first name, last name, email - in place.
 *
 * - The company is the host's cookie's: opened from inside one, the profile names it, the
 *   person's role there and its plan; opened from the entity list, there is none to name.
 * - A save sends only what changed, answers with the fresh profile, and tells the header and the
 *   side menu the new name at once (`primeViewer`). A refusal is Flask's sentence, shown in the
 *   card; the card stays open so nothing typed is lost.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { requireSidebarHost } from "../host";
import { primeViewer } from "../lib/viewer";
import { changesFrom, LOAD_FAILED, SAVE_FAILED, SAVED } from "./profileView";
import {
  isRefusal,
  type Profile,
  type ProfileApi,
  type ProfileChanges,
  type ProfileNotify,
} from "./types";

export type Draft = Required<ProfileChanges>;

type Loaded = { attempt: number; profile: Profile | null; error: string | null };

// Primitives only: a fresh object per read would make useSyncExternalStore loop.
const noSubscribe = () => () => {};
const readEntityId = () => requireSidebarHost().entityId();
const serverEmpty = () => "";

const draftOf = (p: Profile): Draft => ({
  first_name: p.user.first_name,
  last_name: p.user.last_name,
  email: p.user.email,
});

/** Everything My Profile draws, as `useProfile` returns it - what `ProfileBody` is handed. */
export type ProfileModel = ReturnType<typeof useProfile>;

export function useProfile(api: ProfileApi, notify: ProfileNotify) {
  const entityId = useSyncExternalStore(noSubscribe, readEntityId, serverEmpty);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .load(entityId, controller.signal)
      .then((profile) => {
        if (!controller.signal.aborted) setLoaded({ attempt, profile, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // A 401 has already sent the browser for a fresh token; there is nothing to show.
        if (isRefusal(err) && err.status === 401) return;
        setLoaded({ attempt, profile: null, error: isRefusal(err) ? err.message : LOAD_FAILED });
      });
    return () => controller.abort();
  }, [api, attempt, entityId]);

  const status =
    loaded === null || loaded.attempt !== attempt ? "loading" : loaded.error ? "error" : "ready";
  const profile = status === "ready" ? (loaded?.profile ?? null) : null;

  const startEditing = useCallback(() => {
    if (!profile) return;
    setDraft(draftOf(profile));
    setSaveError(null);
  }, [profile]);

  const stopEditing = useCallback(() => {
    setDraft(null);
    setSaveError(null);
  }, []);

  const change = useCallback((field: keyof Draft, value: string) => {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  }, []);

  const save = useCallback(async () => {
    if (!profile || !draft || saving) return;
    const { changes, error } = changesFrom(draft, draftOf(profile));
    if (error) {
      setSaveError(error);
      return;
    }
    if (Object.keys(changes).length === 0) {
      stopEditing();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const fresh = await api.save(changes, entityId);
      setLoaded({ attempt, profile: fresh, error: null });
      primeViewer({ name: fresh.user.name, initials: fresh.user.initials });
      setDraft(null);
      notify(SAVED, "success");
    } catch (err) {
      if (!(isRefusal(err) && err.status === 401)) {
        setSaveError(isRefusal(err) ? err.message : SAVE_FAILED);
      }
    } finally {
      setSaving(false);
    }
  }, [api, notify, profile, draft, saving, entityId, attempt, stopEditing]);

  return {
    status,
    error: status === "error" ? (loaded?.error ?? LOAD_FAILED) : null,
    profile,
    entityId,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
    draft,
    editing: draft !== null,
    saving,
    saveError,
    startEditing,
    stopEditing,
    change,
    save,
  };
}
