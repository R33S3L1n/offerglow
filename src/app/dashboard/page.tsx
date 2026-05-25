"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { listDrafts, deleteDraft, type DraftMeta } from "@/lib/draftStorage";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  if (h < 24) return `${h} 小时前`;
  if (d < 30) return `${d} 天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

interface DraftWithVisits extends DraftMeta {
  visits?: number;
}

export default function DashboardPage() {
  const [drafts, setDrafts] = useState<DraftWithVisits[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
        if (!isSupabaseConfigured() || !supabase) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
          setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (e) {
        console.error("Failed to initialize auth in dashboard:", e);
      }
    };
    initAuth();
  }, []);

  const loadDrafts = useCallback(async () => {
    const list = listDrafts();
    setDrafts(list);
    setLoaded(true);

    const fetchVisits = (draftList: DraftWithVisits[]) => {
      draftList.forEach(async (draft) => {
        if (draft.pageId) {
          try {
            const res = await fetch(`/api/visits/${draft.pageId}`);
            if (res.ok) {
              const { count } = await res.json();
              setDrafts((prev) =>
                prev.map((d) => (d.id === draft.id ? { ...d, visits: count } : d))
              );
            }
          } catch {
            // ignore
          }
        }
      });
    };
    fetchVisits(list);

    // Fetch from Supabase if configured
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (isSupabaseConfigured() && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data, error } = await supabase
            .from("drafts")
            .select("id, profile, updated_at")
            .eq("user_id", session.user.id)
            .order("updated_at", { ascending: false });

          if (!error && data) {
            const supabaseDrafts: DraftWithVisits[] = data.map((d: any) => ({
              id: d.id,
              name: d.profile.name || "未命名",
              updatedAt: d.updated_at,
              status: "draft",
            }));

            const merged = supabaseDrafts.map((sd) => {
              const local = list.find((ld) => ld.id === sd.id);
              if (local) {
                return {
                  ...sd,
                  status: local.status,
                  publishedUrl: local.publishedUrl,
                  pageId: local.pageId,
                };
              }
              return sd;
            });

            const missingInSupabase = list.filter(
              (ld) => !supabaseDrafts.some((sd) => sd.id === ld.id)
            );

            const finalDrafts = [...missingInSupabase, ...merged];
            setDrafts(finalDrafts);
            fetchVisits(finalDrafts);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load drafts from Supabase:", e);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`确定要删除「${name}」吗？此操作不可恢复。`)) return;
    setDeletingId(id);
    setTimeout(() => {
      deleteDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setDeletingId(null);
    }, 300);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f2eb" }}>
      {/* Top Nav */}
      <nav className="sticky top-0 z-40 border-b border-white/60 px-6 py-4 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(16px)" }}>
        <Link href="/" className="flex items-center gap-2 font-serif font-bold text-xl tracking-tight">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 shadow-inner" />
          OfferGlow
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400 font-medium">我的草稿</span>
          <Link
            href="/"
            className="bg-black text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-800 transition shadow-md"
          >
            + 新建页面
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-[0.2em] text-gray-400 uppercase mb-2">Dashboard</p>
          <h1 className="text-4xl font-serif font-bold text-gray-900">我的草稿</h1>
        </div>

        {!loaded ? (
          /* Loading skeleton */
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-24 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl mb-6">
              📄
            </div>
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-3">还没有任何草稿</h2>
            <p className="text-gray-500 mb-8 max-w-sm leading-relaxed">
              粘贴你的简历文本，让 OfferGlow AI 帮你一键生成专属求职主页。
            </p>
            <Link
              href="/"
              className="bg-black text-white px-8 py-3.5 rounded-full font-medium hover:bg-gray-800 transition shadow-lg"
            >
              开始生成 →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5 flex items-center gap-5 group transition-all duration-300 hover:shadow-md ${
                  deletingId === draft.id ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
                }`}
              >
                {/* Avatar / Icon */}
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-xl shadow-inner">
                  {draft.status === "published" ? "🌐" : "✏️"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate text-base">
                      {draft.name || "未命名"}
                    </h3>
                    <span
                      className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        draft.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {draft.status === "published" ? "已发布" : "草稿"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>更新于 {timeAgo(draft.updatedAt)}</span>
                    {draft.status === "published" && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {draft.visits !== undefined ? `${draft.visits} 次浏览` : "加载中…"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {draft.status === "published" && draft.publishedUrl && (
                    <>
                      <button
                        onClick={() => {
                          const fullUrl = window.location.origin + draft.publishedUrl;
                          navigator.clipboard.writeText(fullUrl);
                        }}
                        title="复制链接"
                        className="w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700 transition shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <a
                        href={draft.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="查看发布页"
                        className="w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-700 transition shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </>
                  )}
                  <Link
                    href={`/editor?draft=${draft.id}`}
                    title="继续编辑"
                    className="w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center text-gray-500 hover:text-blue-600 transition shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDelete(draft.id, draft.name || "未命名")}
                    title="删除草稿"
                    className="w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-red-50 hover:border-red-300 flex items-center justify-center text-gray-400 hover:text-red-500 transition shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* New draft CTA at bottom of list */}
            <Link
              href="/"
              className="border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/20 rounded-2xl px-6 py-5 flex items-center gap-4 text-gray-400 hover:text-blue-500 transition group"
            >
              <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-xl transition">
                +
              </div>
              <span className="font-medium text-sm">新建一个页面</span>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
