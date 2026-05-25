"use client";

import { useState, useCallback } from "react";
import { markPublished } from "@/lib/draftStorage";
import type { MasterProfile } from "@/lib/types";

interface Props {
  getProfile: () => MasterProfile;
  draftId: string;
}

export default function PublishButton({ getProfile, draftId }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    try {
      const profile = getProfile();

      // Get userId from Supabase if configured
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      let userId: string | undefined = undefined;
      if (isSupabaseConfigured() && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }

      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, userId }),
      });
      if (!res.ok) throw new Error("发布失败");

      const data = await res.json();
      if (data.url) {
        setPublishedUrl(data.url);
        markPublished(draftId, data.url, data.pageId);
      }
    } catch (err) {
      alert("发布失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setPublishing(false);
    }
  }, [getProfile, draftId]);

  if (publishedUrl) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white rounded-2xl shadow-xl border border-gray-200 px-5 py-3">
        <span className="text-green-500 text-lg">✅</span>
        <span className="text-sm font-medium text-gray-700">发布成功！</span>
        <a
          href={publishedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-500 underline hover:text-blue-600"
        >
          打开链接
        </a>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.origin + publishedUrl);
          }}
          className="text-xs bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition"
        >
          复制链接
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handlePublish}
      disabled={publishing}
      className="fixed bottom-6 right-6 z-50 bg-brand-dark text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-black transition shadow-xl flex items-center gap-2 disabled:opacity-60"
    >
      <span>{publishing ? "⏳" : "🚀"}</span>
      {publishing ? "发布中..." : "发布专属链接"}
    </button>
  );
}
