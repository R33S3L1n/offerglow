// localStorage wrapper for draft profiles.
// Images are NOT stored here — only reference keys (e.g. "heroImage": "img_abc123").
// Actual image data lives in IndexedDB via imageStorage.ts.

import type { MasterProfile } from "./types";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export interface DraftMeta {
  id: string;
  name: string;
  updatedAt: string;
  status: "draft" | "published";
  publishedUrl?: string;
  pageId?: string; // The KV pageId for visit count queries
}

const DRAFT_PREFIX = "draft:";
const DRAFT_LIST_KEY = "draft_list";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function storageKey(id: string): string {
  return DRAFT_PREFIX + id;
}

export function saveDraft(profile: MasterProfile, existingId?: string): string {
  const id = existingId || generateId();
  const now = new Date().toISOString();

  const payload = {
    id,
    profile,
    savedAt: now,
    version: 1,
  };

  // 1. Save locally
  localStorage.setItem(storageKey(id), JSON.stringify(payload));

  // Update local draft list
  const list = listDrafts();
  const existing = list.find((d) => d.id === id);
  if (existing) {
    existing.name = profile.name || "未命名";
    existing.updatedAt = now;
  } else {
    list.unshift({
      id,
      name: profile.name || "未命名",
      updatedAt: now,
      status: "draft",
    });
  }
  localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list));

  // 2. Sync to Supabase in background if logged in
  if (isSupabaseConfigured() && supabase) {
    const client = supabase;
    client.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (user) {
        client
          .from("drafts")
          .upsert({
            id,
            user_id: user.id,
            profile,
            updated_at: now,
          })
          .then(({ error }) => {
            if (error) {
              console.error("Failed to sync draft to Supabase:", error);
            }
          });
      }
    });
  }

  return id;
}

export function loadDraft(id: string): { profile: MasterProfile; savedAt: string } | null {
  const raw = localStorage.getItem(storageKey(id));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return { profile: data.profile, savedAt: data.savedAt };
  } catch {
    return null;
  }
}

export function listDrafts(): DraftMeta[] {
  try {
    const raw = localStorage.getItem(DRAFT_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteDraft(id: string): void {
  localStorage.removeItem(storageKey(id));
  const list = listDrafts().filter((d) => d.id !== id);
  localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list));

  // Delete from Supabase in background if logged in
  if (isSupabaseConfigured() && supabase) {
    const client = supabase;
    client.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (user) {
        client
          .from("drafts")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id)
          .then(({ error }) => {
            if (error) {
              console.error("Failed to delete draft from Supabase:", error);
            }
          });
      }
    });
  }
}

export function renameDraft(id: string, newName: string): void {
  const list = listDrafts();
  const draft = list.find((d) => d.id === id);
  if (draft) {
    draft.name = newName;
    localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list));
  }

  // Rename on Supabase in background if logged in
  if (isSupabaseConfigured() && supabase) {
    const client = supabase;
    client.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (user) {
        // To rename in drafts table, we need to update profile.name in jsonb
        client
          .from("drafts")
          .select("profile")
          .eq("id", id)
          .eq("user_id", user.id)
          .single()
          .then(({ data, error }) => {
            if (!error && data && data.profile) {
              const updatedProfile = { ...data.profile, name: newName };
              client
                .from("drafts")
                .update({ profile: updatedProfile, updated_at: new Date().toISOString() })
                .eq("id", id)
                .eq("user_id", user.id)
                .then(({ error: err }) => {
                  if (err) console.error("Failed to update name on Supabase:", err);
                });
            }
          });
      }
    });
  }
}

export function markPublished(id: string, url: string, pageId?: string): void {
  const list = listDrafts();
  const draft = list.find((d) => d.id === id);
  if (draft) {
    draft.status = "published";
    draft.publishedUrl = url;
    if (pageId) draft.pageId = pageId;
    localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list));
  }
}

// Sync all localStorage drafts to Supabase cloud upon sign-in
export async function syncLocalDraftsToCloud(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const client = supabase;

  const { data: { session } } = await client.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const localDrafts = listDrafts();
  if (localDrafts.length === 0) return;

  const upserts = localDrafts
    .map((d) => {
      const data = loadDraft(d.id);
      if (!data) return null;
      return {
        id: d.id,
        user_id: user.id,
        profile: data.profile,
        updated_at: data.savedAt,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (upserts.length > 0) {
    const { error } = await client.from("drafts").upsert(upserts);
    if (error) {
      console.error("Error syncing local drafts to cloud:", error);
    } else {
      console.log("Successfully synced local drafts to cloud!");
    }
  }
}
