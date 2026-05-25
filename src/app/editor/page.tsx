"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { loadDraft } from "@/lib/draftStorage";
import type { MasterProfile } from "@/lib/types";
import EditablePage from "@/components/editor/EditablePage";
import RichToolbar from "@/components/editor/RichToolbar";
import Link from "next/link";

function EditorContent() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDraft = async () => {
      if (draftId) {
        // 1. Try local storage
        const localData = loadDraft(draftId);
        if (localData) {
          setProfile(localData.profile);
          setLoading(false);
          return;
        }

        // 2. Try Supabase if configured
        try {
          const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
          if (isSupabaseConfigured() && supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const { data, error } = await supabase
                .from("drafts")
                .select("profile, updated_at")
                .eq("id", draftId)
                .eq("user_id", session.user.id)
                .single();

              if (!error && data) {
                setProfile(data.profile);
                setLoading(false);
                // Cache it locally so subsequent loads are instant
                const payload = {
                  id: draftId,
                  profile: data.profile,
                  savedAt: data.updated_at,
                  version: 1,
                };
                localStorage.setItem("draft:" + draftId, JSON.stringify(payload));
                return;
              }
            }
          }
        } catch (e) {
          console.error("Error fetching draft from Supabase:", e);
        }
      }
      setLoading(false);
    };

    fetchDraft();
  }, [draftId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">正在加载编辑器...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-3xl font-serif font-bold mb-4">没有找到草稿</p>
          <p className="text-gray-500 mb-8">
            请先在首页粘贴简历并生成网页分身。
          </p>
          <Link
            href="/"
            className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition"
          >
            回到首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <RichToolbar />
      <EditablePage initialProfile={profile} draftId={draftId!} />
    </>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">正在加载编辑器...</p>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}

