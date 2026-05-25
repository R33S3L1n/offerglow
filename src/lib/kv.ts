// Publish storage: Supabase in production (if configured), Vercel KV, or in-memory Map.
// This avoids database dependency conflicts and supports elegant single-machine fallback.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

interface PublishRecord {
  html: string;
  title: string;
  createdAt: string;
}

// In-memory fallback for local development (no Vercel KV credentials needed).
const globalMemory = globalThis as typeof globalThis & {
  __offerglowMemoryStore?: Map<string, PublishRecord>;
  __offerglowMemoryVisits?: Map<string, number>;
};

const memoryStore =
  globalMemory.__offerglowMemoryStore ??
  (globalMemory.__offerglowMemoryStore = new Map<string, PublishRecord>());

const memoryVisits =
  globalMemory.__offerglowMemoryVisits ??
  (globalMemory.__offerglowMemoryVisits = new Map<string, number>());

function isVercelKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet(key: string): Promise<PublishRecord | null> {
  if (!isVercelKvConfigured()) {
    return memoryStore.get(key) ?? null;
  }
  const { kv } = await import("@vercel/kv");
  return (await kv.get<PublishRecord>(key)) ?? null;
}

async function kvSet(key: string, value: PublishRecord): Promise<void> {
  if (!isVercelKvConfigured()) {
    memoryStore.set(key, value);
    return;
  }
  const { kv } = await import("@vercel/kv");
  await kv.set(key, value);
}

async function kvIncr(key: string): Promise<number> {
  if (!isVercelKvConfigured()) {
    const cur = memoryVisits.get(key) ?? 0;
    memoryVisits.set(key, cur + 1);
    return cur + 1;
  }
  const { kv } = await import("@vercel/kv");
  return await kv.incr(key);
}

async function kvGetNum(key: string): Promise<number> {
  if (!isVercelKvConfigured()) {
    return memoryVisits.get(key) ?? 0;
  }
  const { kv } = await import("@vercel/kv");
  return (await kv.get<number>(key)) ?? 0;
}

export async function savePublishedPage(
  id: string,
  html: string,
  title: string,
  userId?: string
): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    const client = supabase;
    const { error } = await client
      .from("published_pages")
      .upsert({
        id,
        user_id: userId || null,
        title,
        html,
        visits: 0,
        created_at: new Date().toISOString(),
      });
    if (error) {
      console.error("Failed to save published page to Supabase:", error);
      throw error;
    }
    return;
  }

  await kvSet(`page:${id}`, {
    html,
    title,
    createdAt: new Date().toISOString(),
  });
  
  if (!isVercelKvConfigured()) {
    memoryVisits.set(`visits:${id}`, 0);
  } else {
    const { kv } = await import("@vercel/kv");
    await kv.set(`visits:${id}`, 0);
  }
}

export async function getPublishedPage(id: string): Promise<PublishRecord | null> {
  if (isSupabaseConfigured() && supabase) {
    const client = supabase;
    const { data, error } = await client
      .from("published_pages")
      .select("html, title, created_at")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return {
      html: data.html,
      title: data.title,
      createdAt: data.created_at,
    };
  }

  return kvGet(`page:${id}`);
}

export async function incrementVisits(id: string): Promise<number> {
  if (isSupabaseConfigured() && supabase) {
    const client = supabase;
    const { error } = await client.rpc("increment_page_visits", { page_id: id });
    if (error) {
      console.error("Failed to increment visits in Supabase:", error);
    }
    return getVisitCount(id);
  }

  return kvIncr(`visits:${id}`);
}

export async function getVisitCount(id: string): Promise<number> {
  if (isSupabaseConfigured() && supabase) {
    const client = supabase;
    const { data, error } = await client
      .from("published_pages")
      .select("visits")
      .eq("id", id)
      .single();
    if (error || !data) return 0;
    return data.visits;
  }

  return kvGetNum(`visits:${id}`);
}
