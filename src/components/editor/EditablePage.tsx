"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { MasterProfile } from "@/lib/types";
import { saveDraft } from "@/lib/draftStorage";
import { getImage, saveImage } from "@/lib/imageStorage";
import PublishButton from "./PublishButton";
import JdModal from "./JdModal";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import AuthModal from "@/components/auth/AuthModal";

// TECH-DEBT: Undo/redo uses full profile snapshots. For large profiles, switch to incremental patches.
const MAX_HISTORY = 50;

const THEME_OPTIONS = [
  { id: "warm", name: "暖沙金", color: "bg-[#B48E58]", className: "theme-warm" },
  { id: "minimal", name: "极简白", color: "bg-blue-600", className: "theme-minimal" },
  { id: "dark", name: "极客黑", color: "bg-[#A78BFA]", className: "theme-dark" },
  { id: "lilac", name: "丁香紫", color: "bg-[#8B5CF6]", className: "theme-lilac" },
  { id: "ocean", name: "静谧蓝", color: "bg-[#1E3A8A]", className: "theme-ocean" },
] as const;

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=1000";

const DEFAULT_PROJECT_IMAGES = [
  "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800",
];

const DEFAULT_CARD_IMAGE =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800";

const DEFAULT_WIDE_IMAGE =
  "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&q=80&w=1200";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function stripRuntimeImages(profile: MasterProfile): MasterProfile {
  const clean = {
    ...profile,
    projects: (profile.projects || []).map((project) => {
      const { imageData, ...rest } = project;
      return rest;
    }),
    customSections: (profile.customSections || []).map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        const { imageData, ...rest } = block;
        return rest;
      }),
    })),
  };
  delete clean.heroImageData;
  delete clean.projectImageData;
  return clean;
}

function isStoredImageKey(value: string | undefined): value is string {
  return !!value && /^(hero|project|block)_/.test(value);
}

interface Props {
  initialProfile: MasterProfile;
  draftId: string;
}

export default function EditablePage({ initialProfile, draftId }: Props) {
  const [profile, setProfile] = useState<MasterProfile>(initialProfile);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [history, setHistory] = useState<MasterProfile[]>([initialProfile]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isJdModalOpen, setIsJdModalOpen] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<{ matchScore: number; highlights: string[] } | null>(null);
  const [showJdResultBanner, setShowJdResultBanner] = useState(false);
  const [originalProfileBeforeRewrite, setOriginalProfileBeforeRewrite] = useState<MasterProfile | null>(null);

  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) {
        // Trigger background sync when signed in
        const { syncLocalDraftsToCloud } = await import("@/lib/draftStorage");
        syncLocalDraftsToCloud();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const selectedTheme =
    THEME_OPTIONS.find((theme) => theme.id === (profile.theme || "warm")) ??
    THEME_OPTIONS[0];

  // Load images from IndexedDB on mount
  useEffect(() => {
    (async () => {
      const imageUpdates: Partial<MasterProfile> = {};

      if (initialProfile.heroImage) {
        const img = await getImage(initialProfile.heroImage);
        if (img) {
          imageUpdates.heroImageData = img;
        }
      }

      const projectImageData: Record<number, string> = {};
      await Promise.all(
        Object.entries(initialProfile.projectImages || {}).map(async ([index, key]) => {
          const img = await getImage(key);
          if (img) projectImageData[Number(index)] = img;
        })
      );
      if (Object.keys(projectImageData).length > 0) {
        imageUpdates.projectImageData = projectImageData;
      }

      const customSections = await Promise.all(
        (initialProfile.customSections || []).map(async (section) => ({
          ...section,
          blocks: await Promise.all(
            section.blocks.map(async (block) => {
              if (!isStoredImageKey(block.image)) return block;
              const img = await getImage(block.image);
              return img ? { ...block, imageData: img } : block;
            })
          ),
        }))
      );
      if (customSections.some((section) => section.blocks.some((block) => block.imageData))) {
        imageUpdates.customSections = customSections;
      }

      if (Object.keys(imageUpdates).length > 0) {
        setProfile((prev) => ({ ...prev, ...imageUpdates }));
      }
    })();
  }, [initialProfile.customSections, initialProfile.heroImage, initialProfile.projectImages]);

  // Auto-save with 2s debounce
  const autoSave = useCallback((updated: MasterProfile) => {
    setSaveStatus("saving");
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveDraft(stripRuntimeImages(updated), draftId);
      setSaveStatus("saved");
    }, 2000);
  }, [draftId]);

  // Update profile with undo history
  const updateProfile = useCallback((updater: (prev: MasterProfile) => MasterProfile) => {
    setProfile((prev) => {
      const next = updater({ ...prev });
      autoSave(next);

      // Push to undo history
      setHistory((h) => {
        const newHistory = h.slice(0, historyIndex + 1);
        newHistory.push(next);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        return newHistory;
      });
      setHistoryIndex((i) => Math.min(i + 1, MAX_HISTORY - 1));

      return next;
    });
  }, [autoSave, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const prevProfile = history[newIndex];
    setProfile(prevProfile);
    autoSave(prevProfile);
  }, [history, historyIndex, autoSave]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const nextProfile = history[newIndex];
    setProfile(nextProfile);
    autoSave(nextProfile);
  }, [history, historyIndex, autoSave]);

  const handleJdRewrite = useCallback(async (companyName: string, jdText: string) => {
    setIsRewriting(true);
    try {
      const res = await fetch("/api/rewrite-for-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterProfile: profileRef.current,
          jobDescription: jdText,
          companyName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "AI 定制请求失败");
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Save profile snapshot before rewrite to compute diff highlights
      setOriginalProfileBeforeRewrite(JSON.parse(JSON.stringify(profileRef.current)));

      // Update profile with rewritten content
      updateProfile((prev) => ({
        ...prev,
        ...data.instanceProfile,
      }));

      // Set rewrite results
      setRewriteResult({
        matchScore: data.matchScore || 0,
        highlights: data.highlights || [],
      });
      setShowJdResultBanner(true);
      setIsJdModalOpen(false);
    } catch (err) {
      alert("AI 定制失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setIsRewriting(false);
    }
  }, [updateProfile]);

  const hasStringChanged = useCallback((curr: string | undefined, orig: string | undefined) => {
    if (!originalProfileBeforeRewrite) return false;
    return (curr || "").trim() !== (orig || "").trim();
  }, [originalProfileBeforeRewrite]);

  const hasSummaryChanged = useCallback(() => {
    if (!originalProfileBeforeRewrite) return false;
    return (profile.summary || []).join("\n") !== (originalProfileBeforeRewrite.summary || []).join("\n");
  }, [profile.summary, originalProfileBeforeRewrite]);

  const hasTagChanged = useCallback((tagIndex: number) => {
    if (!originalProfileBeforeRewrite) return false;
    const curr = profile.tags?.[tagIndex];
    const orig = originalProfileBeforeRewrite.tags?.[tagIndex];
    return curr !== orig;
  }, [profile.tags, originalProfileBeforeRewrite]);

  const hasMetricChanged = useCallback((metricIndex: number) => {
    if (!originalProfileBeforeRewrite) return false;
    const curr = profile.top_metrics?.[metricIndex];
    const orig = originalProfileBeforeRewrite.top_metrics?.[metricIndex];
    return !curr || !orig || curr.value !== orig.value || curr.label !== orig.label;
  }, [profile.top_metrics, originalProfileBeforeRewrite]);

  const hasTimelineChanged = useCallback((type: "work" | "edu", originalIndex: number) => {
    if (!originalProfileBeforeRewrite) return false;
    if (type === "work") {
      const curr = profile.experiences?.[originalIndex];
      const orig = originalProfileBeforeRewrite.experiences?.[originalIndex];
      if (!curr || !orig) return true;
      return curr.title !== orig.title || curr.date !== orig.date || curr.descriptions.join("\n") !== orig.descriptions.join("\n");
    } else {
      const curr = profile.educations?.[originalIndex];
      const orig = originalProfileBeforeRewrite.educations?.[originalIndex];
      if (!curr || !orig) return true;
      return curr.title !== orig.title || curr.date !== orig.date || (curr.descriptions || []).join("\n") !== (orig.descriptions || []).join("\n");
    }
  }, [profile.experiences, profile.educations, originalProfileBeforeRewrite]);

  const hasProjectChanged = useCallback((projIndex: number) => {
    if (!originalProfileBeforeRewrite) return false;
    const curr = profile.projects?.[projIndex];
    const orig = originalProfileBeforeRewrite.projects?.[projIndex];
    if (!curr || !orig) return true;
    return curr.title !== orig.title || curr.date !== orig.date || curr.descriptions.join("\n") !== orig.descriptions.join("\n") || (curr.metrics || []).map(m => `${m.value}:${m.label}`).join(",") !== (orig.metrics || []).map(m => `${m.value}:${m.label}`).join(",");
  }, [profile.projects, originalProfileBeforeRewrite]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const getCleanProfile = useCallback((): MasterProfile => {
    return profileRef.current;
  }, []);

  const uploadImage = useCallback(
    (scope: "hero" | "project" | "block", onStored: (key: string, dataUrl: string) => void) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/webp,image/gif";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          alert("请选择 PNG、JPG、WebP 或 GIF 图片");
          return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = typeof reader.result === "string" ? reader.result : "";
          if (!dataUrl) return;

          const imageKey = `${scope}_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;
          try {
            await saveImage(imageKey, dataUrl);
            onStored(imageKey, dataUrl);
          } catch (err) {
            alert("图片保存失败：" + (err instanceof Error ? err.message : "未知错误"));
          }
        };
        reader.onerror = () => alert("图片读取失败，请换一张图片试试");
        reader.readAsDataURL(file);
      };
      input.click();
    },
    []
  );

  const changeHeroImage = useCallback(() => {
    uploadImage("hero", (imageKey, dataUrl) => {
      updateProfile((prev) => ({
        ...prev,
        heroImage: imageKey,
        heroImageData: dataUrl,
      }));
    });
  }, [updateProfile, uploadImage]);

  const changeProjectImage = useCallback((projectIndex: number) => {
    uploadImage("project", (imageKey, dataUrl) => {
      updateProfile((prev) => ({
        ...prev,
        projectImages: {
          ...(prev.projectImages || {}),
          [projectIndex]: imageKey,
        },
        projectImageData: {
          ...(prev.projectImageData || {}),
          [projectIndex]: dataUrl,
        },
      }));
    });
  }, [updateProfile, uploadImage]);

  const changeCustomBlockImage = useCallback((sectionIndex: number, blockIndex: number) => {
    uploadImage("block", (imageKey, dataUrl) => {
      updateProfile((prev) => {
        const sections = [...(prev.customSections || [])];
        const blocks = [...sections[sectionIndex].blocks];
        blocks[blockIndex] = {
          ...blocks[blockIndex],
          image: imageKey,
          imageData: dataUrl,
        };
        sections[sectionIndex] = { ...sections[sectionIndex], blocks };
        return { ...prev, customSections: sections };
      });
    });
  }, [updateProfile, uploadImage]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="font-serif text-lg font-semibold">
            OfferGlow
          </a>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-sm text-gray-500">
            {profile.name || "未命名"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Theme Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full p-1 shadow-sm">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  updateProfile((prev) => ({
                    ...prev,
                    theme: t.id,
                  }))
                }
                className={`w-4 h-4 rounded-full ${t.color} border transition-all ${
                  (profile.theme || "warm") === t.id
                    ? "border-black scale-110 shadow-sm"
                    : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                }`}
                title={t.name}
              />
            ))}
          </div>
          <span className="text-xs text-gray-200">|</span>
          <button
            onClick={() => setIsJdModalOpen(true)}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>✨</span>
            JD 定制
          </button>
          <span className="text-xs text-gray-200">|</span>
          <a
            href="/dashboard"
            className="text-xs text-gray-400 hover:text-gray-700 transition flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            我的草稿
          </a>
          <span className="text-xs text-gray-200">|</span>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1" title={user.email}>
                👤 {user.email.split("@")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-400 hover:text-red-500 transition font-semibold"
              >
                退出
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="text-xs text-gray-500 hover:text-gray-900 transition font-semibold"
            >
              登录 / 注册
            </button>
          )}
          <span className="text-xs text-gray-200">|</span>
          <span className="text-xs text-gray-400">
            {saveStatus === "saving" ? "⏳ 保存中..." : "💾 已保存"}
          </span>
        </div>
      </div>

      {/* Editor preview */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {showJdResultBanner && rewriteResult && (
          <div className="mb-6 bg-gradient-to-r from-violet-50/90 via-indigo-50/90 to-blue-50/90 border border-violet-100 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
            {/* Subtle background glow */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-violet-200/40 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-10 -top-10 w-40 h-40 bg-indigo-200/40 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start md:items-center gap-6 relative">
              {/* Circular Score Badge */}
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white border border-violet-200 flex flex-col items-center justify-center shadow-sm">
                <span className="text-[10px] font-semibold text-violet-400">匹配度</span>
                <span className="text-2xl font-serif font-black text-violet-700 leading-none mt-1">
                  {rewriteResult.matchScore}
                  <span className="text-xs font-normal text-violet-500">%</span>
                </span>
              </div>
              
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <span>✨</span> AI 定制对齐成功！
                </h4>
                <div className="text-xs text-gray-600 space-y-1.5">
                  <p className="font-semibold text-gray-500">匹配亮点：</p>
                  <ul className="list-disc pl-4 space-y-0.5 font-medium">
                    {rewriteResult.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 relative flex-shrink-0 self-stretch md:self-auto justify-end">
              <button
                onClick={() => {
                  undo();
                  setShowJdResultBanner(false);
                  setOriginalProfileBeforeRewrite(null);
                }}
                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs px-4 py-2 rounded-full font-medium transition shadow-sm"
              >
                撤销修改
              </button>
              <button
                onClick={() => {
                  setShowJdResultBanner(false);
                  setOriginalProfileBeforeRewrite(null);
                }}
                className="bg-gray-900 hover:bg-black text-white text-xs px-4 py-2 rounded-full font-medium transition shadow-sm"
              >
                确认并保留
              </button>
            </div>
          </div>
        )}
        <div
          className={`${selectedTheme.className} bg-theme-sheet text-theme-main rounded-[2rem] shadow-2xl overflow-hidden border border-theme-divider`}
          id="editor-preview"
        >
          {/* Hero */}
          <section className="px-8 pt-16 pb-20 grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div>
              <div className="text-sm text-theme-sub tracking-[0.18em] uppercase mb-4 opacity-70">
                Personal Page
              </div>
              <h1 className="text-5xl md:text-7xl font-serif font-bold leading-[1.02] mb-6">
                <span className="block text-xl font-sans font-normal text-theme-sub mb-2 opacity-80">
                  Hi，我是
                </span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  className={`outline-none focus:bg-blue-50/50 focus:outline-2 focus:outline-blue-200 rounded px-1 -ml-1 ${
                    originalProfileBeforeRewrite && hasStringChanged(profile.name, originalProfileBeforeRewrite.name)
                      ? "bg-violet-50/90 border-b border-dashed border-violet-400 text-violet-950 font-bold"
                      : ""
                  }`}
                  onBlur={(e) => {
                    const html = e.currentTarget.innerHTML || "";
                    updateProfile((p) => ({
                      ...p,
                      name: html || p.name,
                    }));
                  }}
                  dangerouslySetInnerHTML={{ __html: profile.name || "" }}
                />
                。
              </h1>
              {profile.tagline !== undefined && (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className={`text-2xl font-serif font-bold leading-snug mb-4 outline-none focus:bg-blue-50/50 focus:outline-2 focus:outline-blue-200 rounded px-1 -ml-1 ${
                    originalProfileBeforeRewrite && hasStringChanged(profile.tagline, originalProfileBeforeRewrite.tagline)
                      ? "bg-violet-50/90 border-b border-dashed border-violet-400 text-violet-950"
                      : ""
                  }`}
                  onBlur={(e) => {
                    const html = e.currentTarget.innerHTML || "";
                    updateProfile((p) => ({
                      ...p,
                      tagline: html,
                    }));
                  }}
                  dangerouslySetInnerHTML={{ __html: profile.tagline || "" }}
                />
              )}
              <p
                contentEditable
                suppressContentEditableWarning
                className={`text-sm text-theme-sub mb-8 tracking-wide outline-none focus:bg-blue-50/50 focus:outline-2 focus:outline-blue-200 rounded px-1 -ml-1 ${
                  originalProfileBeforeRewrite && hasStringChanged(profile.headline, originalProfileBeforeRewrite.headline)
                    ? "bg-violet-50/90 border-b border-dashed border-violet-400 text-violet-950"
                    : ""
                }`}
                onBlur={(e) => {
                  const html = e.currentTarget.innerHTML || "";
                  updateProfile((p) => ({
                    ...p,
                    headline: html || "",
                  }));
                }}
                dangerouslySetInnerHTML={{ __html: profile.headline || "" }}
              />
              
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    const contactSec = document.getElementById("contact");
                    contactSec?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-theme-accent text-white hover-bg-theme-accent rounded-full px-8 py-3.5 text-sm font-medium transition shadow-md"
                >
                  联系我 →
                </button>
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={changeHeroImage}
                className="aspect-[4/5] rounded-[2rem] overflow-hidden bg-gray-100 shadow-2xl relative group/img cursor-pointer block w-full text-left"
                title="更换图片"
              >
                <img
                  src={
                    (profile as MasterProfile & { heroImageData?: string }).heroImageData ||
                    DEFAULT_HERO_IMAGE
                  }
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                  <span className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                    📸 点击更换图片
                  </span>
                </div>
              </button>
            </div>
          </section>
          {/* ── About Me & Milestones ── */}
          <section id="about" className="border-t border-theme-divider bg-theme-sheet py-20">
            <div className="px-8 flex flex-col gap-12">
              {/* Line divider with "关于我" in center */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-theme-divider"></div>
                </div>
                <div className="relative bg-theme-sheet px-4 text-xs font-semibold tracking-[0.2em] text-theme-sub uppercase opacity-70">
                  关于我
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-16">
                {/* Left Column: Narrative and Tags */}
                <div className="md:col-span-3">
                  <h2
                    contentEditable
                    suppressContentEditableWarning
                    className={`text-4xl md:text-5xl font-serif font-bold leading-[1.15] mb-8 outline-none focus:bg-blue-50/50 rounded whitespace-pre-line ${
                      originalProfileBeforeRewrite && hasStringChanged(profile.aboutTitle, originalProfileBeforeRewrite.aboutTitle)
                        ? "bg-violet-50/90 border-b border-dashed border-violet-400 text-violet-950"
                        : ""
                    }`}
                    onBlur={(e) => {
                      const html = e.currentTarget.innerHTML || "";
                      updateProfile((p) => ({
                        ...p,
                        aboutTitle: html,
                      }));
                    }}
                    dangerouslySetInnerHTML={{ __html: profile.aboutTitle || "全球视野。<br/>AI最前线。" }}
                  />

                  <div className="space-y-6 text-theme-sub leading-8 text-base mb-10">
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className={`outline-none focus:bg-blue-50/50 rounded p-1 -ml-1 ${
                        originalProfileBeforeRewrite && hasSummaryChanged()
                          ? "bg-violet-50/90 border-b border-dashed border-violet-400 text-violet-950"
                          : ""
                      }`}
                      onBlur={(e) => {
                        const html = e.currentTarget.innerHTML || "";
                        updateProfile((p) => ({
                          ...p,
                          summary: [html],
                        }));
                      }}
                      dangerouslySetInnerHTML={{ __html: (profile.summary || []).join(" ") }}
                    />
                  </div>

                  {/* Top metrics under summary */}
                  {profile.top_metrics && (
                    <div className="flex flex-wrap gap-4 mb-10 border-t border-theme-divider pt-8">
                      {profile.top_metrics.map((m, i) => (
                        <div
                          key={i}
                          className={`bg-theme-metric rounded-2xl px-6 py-4 min-w-[140px] relative group/metric ${
                            originalProfileBeforeRewrite && hasMetricChanged(i)
                              ? "ring-2 ring-violet-400 border-violet-300 animate-pulse"
                              : ""
                          }`}
                        >
                          <button
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/metric:opacity-100 transition shadow-sm hover:bg-red-100 text-xs"
                            onClick={() =>
                              updateProfile((p) => ({
                                ...p,
                                top_metrics: p.top_metrics.filter(
                                  (_, j) => j !== i
                                ),
                              }))
                            }
                            title="删除指标"
                          >
                            ✕
                          </button>
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            className="text-3xl font-serif font-bold mb-1 outline-none focus:bg-blue-50/50 rounded"
                            onBlur={(e) => {
                              const html = e.currentTarget.innerHTML || "";
                              updateProfile((p) => {
                                const updated = [...p.top_metrics];
                                updated[i] = {
                                  ...updated[i],
                                  value: html,
                                };
                                return { ...p, top_metrics: updated };
                              });
                            }}
                            dangerouslySetInnerHTML={{ __html: m.value || "" }}
                          />
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            className="text-[11px] font-medium tracking-wide opacity-80 outline-none focus:bg-blue-50/50 rounded"
                            onBlur={(e) => {
                              const html = e.currentTarget.innerHTML || "";
                              updateProfile((p) => {
                                const updated = [...p.top_metrics];
                                updated[i] = {
                                  ...updated[i],
                                  label: html,
                                };
                                return { ...p, top_metrics: updated };
                              });
                            }}
                            dangerouslySetInnerHTML={{ __html: m.label || "" }}
                          />
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          updateProfile((p) => ({
                            ...p,
                            top_metrics: [
                              ...(p.top_metrics || []),
                              { value: "99%", label: "新指标" }
                            ]
                          }))
                        }
                        className="border border-dashed border-theme-divider hover:border-theme-accent hover:bg-theme-accent/5 rounded-2xl px-6 py-4 flex flex-col items-center justify-center gap-1 text-theme-sub opacity-70 hover:opacity-100 hover:text-theme-accent transition min-w-[140px]"
                        title="添加指标"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs font-medium">添加指标</span>
                      </button>
                    </div>
                  )}

                  {/* Skill tags moved outside to be full width */}
                </div>

                {/* Right Column: Interactive Vertical Timeline */}
                <div className="md:col-span-2">
                  {(() => {
                    const milestones = [
                      ...(profile.experiences || []).map((exp, idx) => ({ ...exp, type: "work" as const, originalIndex: idx })),
                      ...(profile.educations || []).map((edu, idx) => ({ ...edu, type: "edu" as const, originalIndex: idx })),
                    ];
                    const parseYear = (dateStr: string) => {
                      const match = dateStr.match(/(?:19|20)\d{2}/);
                      return match ? parseInt(match[0], 10) : 0;
                    };
                    const sortedMilestones = [...milestones].sort((a, b) => parseYear(b.date) - parseYear(a.date));

                    return (
                      <div className="relative pl-8 border-l border-theme-divider flex flex-col gap-10 ml-6">
                        {sortedMilestones.map((milestone, idx) => {
                          const indexStr = String(idx + 1).padStart(2, "0");
                          return (
                            <div 
                              key={idx} 
                              className={`relative group/timeline-item transition-all ${
                                originalProfileBeforeRewrite && hasTimelineChanged(milestone.type, milestone.originalIndex)
                                  ? "ring-2 ring-violet-400 bg-violet-50/30 p-4 -m-4 rounded-2xl border border-dashed border-violet-200"
                                  : ""
                              }`}
                            >
                              <button
                                className="absolute -top-3 -right-2 w-6 h-6 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/timeline-item:opacity-100 transition shadow-sm text-xs z-10"
                                onClick={() => {
                                  updateProfile((p) => {
                                    if (milestone.type === "work") {
                                      return {
                                        ...p,
                                        experiences: p.experiences.filter((_, j) => j !== milestone.originalIndex),
                                      };
                                    } else {
                                      return {
                                        ...p,
                                        educations: p.educations.filter((_, j) => j !== milestone.originalIndex),
                                      };
                                    }
                                  });
                                }}
                                title="删除此项"
                              >
                                ✕
                              </button>

                              {/* Number Circle Marker */}
                              <div className="absolute -left-[52px] top-0 flex items-center justify-center w-10 h-10 rounded-full border border-theme-divider text-xs font-serif font-bold text-theme-accent bg-theme-sheet shadow-sm select-none z-10">
                                {indexStr}
                              </div>

                              <div
                                contentEditable
                                suppressContentEditableWarning
                                className="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-2 outline-none focus:bg-blue-50/50 rounded inline-block"
                                onBlur={(e) => {
                                  const html = e.currentTarget.innerHTML || "";
                                  updateProfile((p) => {
                                    if (milestone.type === "work") {
                                      const exps = [...p.experiences];
                                      exps[milestone.originalIndex] = { ...exps[milestone.originalIndex], date: html };
                                      return { ...p, experiences: exps };
                                    } else {
                                      const edus = [...p.educations];
                                      edus[milestone.originalIndex] = { ...edus[milestone.originalIndex], date: html };
                                      return { ...p, educations: edus };
                                    }
                                  });
                                }}
                                dangerouslySetInnerHTML={{ __html: milestone.date || "" }}
                              />

                              <h3
                                contentEditable
                                suppressContentEditableWarning
                                className="font-bold text-theme-main text-lg outline-none focus:bg-blue-50/50 rounded mb-2"
                                onBlur={(e) => {
                                  const html = e.currentTarget.innerHTML || "";
                                  updateProfile((p) => {
                                    if (milestone.type === "work") {
                                      const exps = [...p.experiences];
                                      exps[milestone.originalIndex] = { ...exps[milestone.originalIndex], title: html };
                                      return { ...p, experiences: exps };
                                    } else {
                                      const edus = [...p.educations];
                                      edus[milestone.originalIndex] = { ...edus[milestone.originalIndex], title: html };
                                      return { ...p, educations: edus };
                                    }
                                  });
                                }}
                                dangerouslySetInnerHTML={{ __html: milestone.title || "" }}
                              />


                            </div>
                          );
                        })}

                        {/* Add buttons */}
                        <div className="flex gap-4 mt-6">
                          <button
                            onClick={() => {
                              updateProfile((p) => ({
                                ...p,
                                experiences: [
                                  ...(p.experiences || []),
                                  { date: "202X.XX - 至今", title: "职位岗位 · 公司名称", descriptions: ["新增工作描述"] }
                                ]
                              }));
                            }}
                            className="flex-1 py-3 border border-dashed border-theme-divider rounded-xl text-theme-sub opacity-70 hover:opacity-100 hover:border-theme-accent hover:text-theme-accent hover:bg-theme-accent/5 text-xs font-medium flex items-center justify-center gap-1 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            工作经历
                          </button>
                          <button
                            onClick={() => {
                              updateProfile((p) => ({
                                ...p,
                                educations: [
                                  ...(p.educations || []),
                                  { date: "202X - 202X", title: "学历学位 · 学校名称", descriptions: ["学业情况或主修课程"] }
                                ]
                              }));
                            }}
                            className="flex-1 py-3 border border-dashed border-theme-divider rounded-xl text-theme-sub opacity-70 hover:opacity-100 hover:border-theme-accent hover:text-theme-accent hover:bg-theme-accent/5 text-xs font-medium flex items-center justify-center gap-1 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            教育背景
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Skill tags at the bottom, outside the 6:4 grid to be full width */}
              {profile.tags && (
                <div className="border-t border-theme-divider pt-10 mt-10 w-full">
                  <div className="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase mb-4 opacity-70">专业技能</div>
                  <div className="flex flex-row items-center overflow-x-auto flex-nowrap gap-2.5 pb-2 no-scrollbar">
                    {profile.tags.map((tag, i) => (
                      <div key={i} className="relative inline-flex group/tag">
                        <span
                          contentEditable
                          suppressContentEditableWarning
                          className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap shadow-sm border border-transparent outline-none cursor-text bg-theme-tag ${
                            originalProfileBeforeRewrite && hasTagChanged(i)
                              ? "ring-2 ring-violet-500 bg-violet-600 text-white animate-pulse"
                              : ""
                          }`}
                          onBlur={(e) => {
                            const html = e.currentTarget.innerHTML || "";
                            updateProfile((p) => {
                              const updated = [...p.tags];
                              updated[i] = html || updated[i];
                              return { ...p, tags: updated };
                            });
                          }}
                          dangerouslySetInnerHTML={{ __html: tag || "" }}
                        />
                        <button
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/tag:opacity-100 transition shadow text-[10px]"
                          onClick={() =>
                            updateProfile((p) => ({
                              ...p,
                              tags: p.tags.filter((_, j) => j !== i),
                            }))
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      className="px-4 py-2 rounded-full border border-dashed border-theme-accent text-theme-accent text-xs font-medium hover:bg-theme-accent/5 transition whitespace-nowrap flex-shrink-0"
                      onClick={() =>
                        updateProfile((p) => ({
                          ...p,
                          tags: [...(p.tags || []), "新标签"],
                        }))
                      }
                    >
                      + 添加技能
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Projects ── */}
          {profile.projects && (
            <section className="px-8 py-16 border-t border-theme-divider">
              <p className="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase mb-4">精选项目</p>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-12 text-theme-main">高光项目。</h2>
              <div className={`grid grid-cols-1 ${profile.projects.length > 0 ? "md:grid-cols-2" : ""} gap-8`}>
                {profile.projects.map((proj, i) => (
                  <article
                    key={i}
                    className={`relative rounded-[1.75rem] border border-theme-divider bg-theme-card p-6 shadow-sm group/card flex flex-col justify-between transition-all ${
                      originalProfileBeforeRewrite && hasProjectChanged(i)
                        ? "ring-2 ring-violet-400 bg-violet-50/30 border-violet-200"
                        : ""
                    }`}
                  >
                    <div>
                      <button
                        className="absolute -top-3 -right-3 w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition shadow-sm hover:bg-red-100 z-10"
                        onClick={() =>
                          updateProfile((p) => ({
                            ...p,
                            projects: p.projects.filter((_, j) => j !== i),
                          }))
                        }
                        title="删除此项目"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => changeProjectImage(i)}
                        className="aspect-[16/10] rounded-[1.25rem] overflow-hidden bg-theme-sheet mb-5 relative group/project-img block w-full text-left"
                        title="更换项目配图"
                      >
                        <img
                          src={
                            profile.projectImageData?.[i] ||
                            proj.imageData ||
                            (!isStoredImageKey(proj.image) ? proj.image : "") ||
                            DEFAULT_PROJECT_IMAGES[i % DEFAULT_PROJECT_IMAGES.length]
                          }
                          className="w-full h-full object-cover"
                          alt="项目配图"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/project-img:opacity-100 transition flex items-center justify-center">
                          <span className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                            更换项目图片
                          </span>
                        </div>
                      </button>
                      <div
                        contentEditable
                        suppressContentEditableWarning
                        className="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-3 outline-none focus-theme-accent-bg rounded"
                        onBlur={(e) => {
                          const html = e.currentTarget.innerHTML || "";
                          updateProfile((p) => {
                            const updated = [...p.projects];
                            updated[i] = { ...updated[i], date: html || "" };
                            return { ...p, projects: updated };
                          });
                        }}
                        dangerouslySetInnerHTML={{ __html: proj.date || "" }}
                      />
                      <h3
                        contentEditable
                        suppressContentEditableWarning
                        className="text-2xl font-serif font-bold mb-4 outline-none text-theme-main focus-theme-accent-bg rounded"
                        onBlur={(e) => {
                              const html = e.currentTarget.innerHTML || "";
                              updateProfile((p) => {
                            const updated = [...p.projects];
                            updated[i] = { ...updated[i], title: html || "" };
                                return { ...p, projects: updated };
                              });
                            }}
                        dangerouslySetInnerHTML={{ __html: proj.title || "" }}
                      />
                      {proj.metrics && (
                        <div className="flex flex-wrap gap-6 mb-5 border-b border-theme-divider pb-5 items-center">
                          {proj.metrics.map((m, mi) => (
                            <div key={mi} className="relative group/metric-item">
                              <button
                                className="absolute -top-2 -right-2 w-4 h-4 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/metric-item:opacity-100 transition shadow-sm hover:bg-red-100 text-[10px]"
                                onClick={() =>
                                  updateProfile((p) => {
                                    const projs = [...p.projects];
                                    const metrics = (projs[i].metrics || []).filter((_, mj) => mj !== mi);
                                    projs[i] = { ...projs[i], metrics };
                                    return { ...p, projects: projs };
                                  })
                                }
                                title="删除指标"
                              >
                                ✕
                              </button>
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                className="text-2xl font-serif font-bold text-theme-main outline-none focus-theme-accent-bg rounded"
                                onBlur={(e) => {
                                  const html = e.currentTarget.innerHTML || "";
                                  updateProfile((p) => {
                                    const projs = [...p.projects];
                                    const metrics = [...(projs[i].metrics || [])];
                                    metrics[mi] = { ...metrics[mi], value: html };
                                    projs[i] = { ...projs[i], metrics };
                                    return { ...p, projects: projs };
                                  });
                                }}
                                dangerouslySetInnerHTML={{ __html: m.value || "" }}
                              />
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                className="text-[11px] text-theme-sub font-medium mt-1 outline-none focus-theme-accent-bg rounded"
                                onBlur={(e) => {
                                  const html = e.currentTarget.innerHTML || "";
                                  updateProfile((p) => {
                                    const projs = [...p.projects];
                                    const metrics = [...(projs[i].metrics || [])];
                                    metrics[mi] = { ...metrics[mi], label: html };
                                    projs[i] = { ...projs[i], metrics };
                                    return { ...p, projects: projs };
                                  });
                                }}
                                dangerouslySetInnerHTML={{ __html: m.label || "" }}
                              />
                            </div>
                          ))}
                          <button
                            onClick={() =>
                              updateProfile((p) => {
                                const projs = [...p.projects];
                                projs[i] = {
                                  ...projs[i],
                                  metrics: [...(projs[i].metrics || []), { value: "100%", label: "新指标" }]
                                };
                                return { ...p, projects: projs };
                              })
                            }
                            className="px-3 py-1 rounded-lg border border-dashed border-theme-divider text-theme-sub text-xs hover:border-theme-accent hover:text-theme-accent transition opacity-0 group-hover/card:opacity-100"
                          >
                            + 添加指标
                          </button>
                        </div>
                      )}
                      <ul className="space-y-3 text-sm text-theme-sub leading-7 list-disc pl-5">
                        {(proj.descriptions || []).map((desc, di) => (
                          <li
                            key={di}
                            contentEditable
                            suppressContentEditableWarning
                            className="outline-none focus-theme-accent-bg rounded"
                            onBlur={(e) => {
                              const html = e.currentTarget.innerHTML || "";
                              const hasText = !!(e.currentTarget.textContent || "").trim();
                              updateProfile((p) => {
                                const projs = [...p.projects];
                                let descs = [...(projs[i].descriptions || [])];
                                if (!hasText) {
                                  descs = descs.filter((_, dj) => dj !== di);
                                } else {
                                  descs[di] = html;
                                }
                                projs[i] = { ...projs[i], descriptions: descs };
                                return { ...p, projects: projs };
                              });
                            }}
                            dangerouslySetInnerHTML={{ __html: desc }}
                          />
                        ))}
                      </ul>
                    </div>
                    <div>
                      <button
                        onClick={() =>
                          updateProfile((p) => {
                            const projs = [...p.projects];
                            projs[i] = {
                              ...projs[i],
                              descriptions: [...(projs[i].descriptions || []), "新项目描述"]
                            };
                            return { ...p, projects: projs };
                          })
                        }
                        className="text-xs text-theme-accent hover:opacity-85 font-medium mt-4 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        增加描述
                      </button>
                    </div>
                  </article>
                ))}
                <button
                  onClick={() =>
                    updateProfile((p) => ({
                      ...p,
                      projects: [
                        ...(p.projects || []),
                        {
                          date: "202X.XX - 202X.XX",
                          title: "项目名称",
                          descriptions: ["新增项目描述 / 主要成就"],
                          metrics: [{ value: "100%", label: "核心指标" }]
                        }
                      ]
                    }))
                  }
                  className="border-2 border-dashed border-theme-divider hover:border-theme-accent hover:bg-theme-accent-light rounded-[1.75rem] p-6 flex flex-col items-center justify-center gap-2 text-theme-sub hover:text-theme-accent transition min-h-[300px]"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium">添加项目卡片</span>
                </button>
              </div>
            </section>
          )}

          {/* ── Custom Sections ── */}
          {(profile.customSections || []).map((sec, sIdx) => (
            <section key={sec.id} className="px-8 py-16 border-t border-theme-divider group/section relative bg-theme-sheet">
              {/* Delete Section Button */}
              <button
                className="absolute top-12 right-6 w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/section:opacity-100 transition shadow-sm hover:bg-red-100 hover:text-red-600 z-10"
                onClick={() =>
                  updateProfile((p) => ({
                    ...p,
                    customSections: (p.customSections || []).filter((_, idx) => idx !== sIdx),
                  }))
                }
                title="删除此板块"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Tag */}
              <div
                contentEditable
                suppressContentEditableWarning
                className="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase mb-4 outline-none focus-theme-accent-bg rounded inline-block"
                onBlur={(e) => {
                  const html = e.currentTarget.innerHTML || "";
                  updateProfile((p) => {
                    const secs = [...(p.customSections || [])];
                    secs[sIdx] = { ...secs[sIdx], tag: html || "自定义标签" };
                    return { ...p, customSections: secs };
                  });
                }}
                dangerouslySetInnerHTML={{ __html: sec.tag || "" }}
              />

              {/* Title */}
              <h2
                contentEditable
                suppressContentEditableWarning
                className="text-4xl md:text-5xl font-serif font-bold mb-12 text-theme-main outline-none focus-theme-accent-bg rounded block w-full"
                onBlur={(e) => {
                  const html = e.currentTarget.innerHTML || "";
                  updateProfile((p) => {
                    const secs = [...(p.customSections || [])];
                    secs[sIdx] = { ...secs[sIdx], title: html || "自定义板块标题。" };
                    return { ...p, customSections: secs };
                  });
                }}
                dangerouslySetInnerHTML={{ __html: sec.title || "" }}
              />

              {/* Blocks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {sec.blocks.map((block, bIdx) => {
                  if (block.type === "card") {
                    return (
                      <article key={block.id} className="relative rounded-[1.75rem] border border-theme-divider bg-theme-card p-6 shadow-sm group/card flex flex-col justify-between min-h-[320px]">
                        <div>
                          {/* Delete Block Button */}
                          <button
                            className="absolute -top-3 -right-3 w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition shadow-sm hover:bg-red-100 z-10"
                            onClick={() =>
                              updateProfile((p) => {
                                const secs = [...(p.customSections || [])];
                                secs[sIdx] = {
                                  ...secs[sIdx],
                                  blocks: secs[sIdx].blocks.filter((_, idx) => idx !== bIdx),
                                };
                                return { ...p, customSections: secs };
                              })
                            }
                            title="删除此卡片"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => changeCustomBlockImage(sIdx, bIdx)}
                            className="aspect-[16/10] rounded-[1.25rem] overflow-hidden bg-theme-sheet mb-5 relative group/block-img block w-full text-left"
                            title="更换卡片图片"
                          >
                            <img
                              src={
                                block.imageData ||
                                (!isStoredImageKey(block.image) ? block.image : "") ||
                                DEFAULT_CARD_IMAGE
                              }
                              className="w-full h-full object-cover"
                              alt="配图"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/block-img:opacity-100 transition flex items-center justify-center">
                              <span className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                                更换卡片图片
                              </span>
                            </div>
                          </button>

                          {/* Date/Subtitle */}
                          <div
                            contentEditable
                            suppressContentEditableWarning
                            className="text-xs text-theme-accent font-semibold tracking-[0.18em] uppercase mb-3 outline-none focus-theme-accent-bg rounded"
                            onBlur={(e) => {
                              const html = e.currentTarget.innerHTML || "";
                              updateProfile((p) => {
                                const secs = [...(p.customSections || [])];
                                const blocks = [...secs[sIdx].blocks];
                                blocks[bIdx] = { ...blocks[bIdx], date: html };
                                secs[sIdx] = { ...secs[sIdx], blocks };
                                return { ...p, customSections: secs };
                              });
                            }}
                            dangerouslySetInnerHTML={{ __html: block.date || "" }}
                          />

                          {/* Block Title */}
                          <h3
                            contentEditable
                            suppressContentEditableWarning
                            className="text-2xl font-serif font-bold mb-4 text-theme-main outline-none focus-theme-accent-bg rounded"
                            onBlur={(e) => {
                              const html = e.currentTarget.innerHTML || "";
                              updateProfile((p) => {
                                const secs = [...(p.customSections || [])];
                                const blocks = [...secs[sIdx].blocks];
                                blocks[bIdx] = { ...blocks[bIdx], title: html };
                                secs[sIdx] = { ...secs[sIdx], blocks };
                                return { ...p, customSections: secs };
                              });
                            }}
                            dangerouslySetInnerHTML={{ __html: block.title || "" }}
                          />

                          {/* Descriptions List */}
                          <ul className="space-y-3 text-sm text-theme-sub leading-7 list-disc pl-5">
                            {(block.descriptions || []).map((desc, di) => (
                              <li
                                key={di}
                                contentEditable
                                suppressContentEditableWarning
                                className="outline-none focus-theme-accent-bg rounded"
                                onBlur={(e) => {
                                  const html = e.currentTarget.innerHTML || "";
                                  const hasText = !!(e.currentTarget.textContent || "").trim();
                                  updateProfile((p) => {
                                    const secs = [...(p.customSections || [])];
                                    const blocks = [...secs[sIdx].blocks];
                                    let descs = [...(blocks[bIdx].descriptions || [])];
                                    if (!hasText) {
                                      descs = descs.filter((_, dj) => dj !== di);
                                    } else {
                                      descs[di] = html;
                                    }
                                    blocks[bIdx] = { ...blocks[bIdx], descriptions: descs };
                                    secs[sIdx] = { ...secs[sIdx], blocks };
                                    return { ...p, customSections: secs };
                                  });
                                }}
                                dangerouslySetInnerHTML={{ __html: desc }}
                              />
                            ))}
                          </ul>
                        </div>

                        {/* Add Description Line Button */}
                        <div>
                          <button
                            onClick={() =>
                              updateProfile((p) => {
                                const secs = [...(p.customSections || [])];
                                const blocks = [...secs[sIdx].blocks];
                                blocks[bIdx] = {
                                  ...blocks[bIdx],
                                  descriptions: [...(blocks[bIdx].descriptions || []), "新经历描述"]
                                };
                                secs[sIdx] = { ...secs[sIdx], blocks };
                                return { ...p, customSections: secs };
                              })
                            }
                            className="text-xs text-theme-accent hover:opacity-85 font-medium mt-4 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            增加描述
                          </button>
                        </div>
                      </article>
                    );
                  } else {
                    // Image type block
                    return (
                      <div key={block.id} className="md:col-span-2 relative group/card">
                        {/* Delete Block Button */}
                        <button
                          className="absolute -top-3 -right-3 w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition shadow-sm hover:bg-red-100 hover:text-red-600 z-10"
                          onClick={() =>
                            updateProfile((p) => {
                              const secs = [...(p.customSections || [])];
                              secs[sIdx] = {
                                ...secs[sIdx],
                                blocks: secs[sIdx].blocks.filter((_, idx) => idx !== bIdx),
                              };
                              return { ...p, customSections: secs };
                            })
                          }
                          title="删除此大图"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <article className="rounded-[1.75rem] border border-theme-divider bg-theme-card p-2 shadow-sm">
                          <button
                            type="button"
                            onClick={() => changeCustomBlockImage(sIdx, bIdx)}
                            className="rounded-[1.25rem] overflow-hidden bg-theme-sheet relative aspect-[16/6] group/block-img block w-full text-left"
                            title="更换大图"
                          >
                            <img
                              src={
                                block.imageData ||
                                (!isStoredImageKey(block.image) ? block.image : "") ||
                                DEFAULT_WIDE_IMAGE
                              }
                              className="w-full h-full object-cover"
                              alt="自定义大图"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/block-img:opacity-100 transition flex items-center justify-center">
                              <span className="bg-white text-black px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                                更换大图
                              </span>
                            </div>
                          </button>
                        </article>
                      </div>
                    );
                  }
                })}
              </div>

              {/* Block Actions */}
              <div className="flex gap-4 opacity-50 hover:opacity-100 transition">
                <button
                  onClick={() =>
                    updateProfile((p) => {
                      const secs = [...(p.customSections || [])];
                      secs[sIdx] = {
                        ...secs[sIdx],
                        blocks: [
                          ...secs[sIdx].blocks,
                          {
                            id: "cb_" + Math.random().toString(36).substr(2, 9),
                            type: "card",
                            date: "副标题或时间",
                            title: "新卡片主标题",
                            descriptions: ["描述内容 1", "描述内容 2"],
                            image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800",
                          },
                        ],
                      };
                      return { ...p, customSections: secs };
                    })
                  }
                  className="px-4 py-2 rounded-full border border-theme-divider text-xs font-medium hover:border-theme-accent hover:text-theme-accent transition text-theme-sub bg-theme-card shadow-sm flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  添加图文卡片
                </button>
                <button
                  onClick={() =>
                    updateProfile((p) => {
                      const secs = [...(p.customSections || [])];
                      secs[sIdx] = {
                        ...secs[sIdx],
                        blocks: [
                          ...secs[sIdx].blocks,
                          {
                            id: "cb_" + Math.random().toString(36).substr(2, 9),
                            type: "image",
                            image: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&q=80&w=1200",
                          },
                        ],
                      };
                      return { ...p, customSections: secs };
                    })
                  }
                  className="px-4 py-2 rounded-full border border-theme-divider text-xs font-medium hover:border-theme-accent hover:text-theme-accent transition text-theme-sub bg-theme-card shadow-sm flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  添加大图展现
                </button>
              </div>
            </section>
          ))}

          {/* Add Global Custom Section Button */}
          <div className="px-8 pb-16 flex justify-center border-t border-theme-divider bg-theme-sheet pt-12">
            <button
              onClick={() =>
                updateProfile((p) => ({
                  ...p,
                  customSections: [
                    ...(p.customSections || []),
                    {
                      id: "cs_" + Math.random().toString(36).substr(2, 9),
                      tag: "自定义标签",
                      title: "自定义板块标题。",
                      blocks: [],
                    },
                  ],
                }))
              }
              className="py-4 px-8 border-2 border-dashed border-theme-divider hover:border-theme-accent hover:bg-theme-accent-light rounded-2xl text-theme-sub hover:text-theme-accent font-medium text-sm flex items-center justify-center gap-2 transition w-full max-w-xs"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              添加自定义板块
            </button>
          </div>

          {/* ── Contact ── */}
          <section id="contact" className="px-8 py-16 border-t border-theme-divider bg-theme-sheet">
            <div className="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
              <div className="space-y-5">
                <p className="text-xs text-theme-sub font-semibold tracking-[0.18em] uppercase">联系</p>
                <h2
                  contentEditable
                  suppressContentEditableWarning
                  className="text-4xl font-serif font-bold outline-none text-theme-main focus-theme-accent-bg rounded inline-block"
                  onBlur={(e) => {
                    const html = e.currentTarget.innerHTML || "";
                    updateProfile((p) => ({ ...p, contactTitle: html }));
                  }}
                  dangerouslySetInnerHTML={{ __html: profile.contactTitle || "一起创造点什么。" }}
                />
                <div className="space-y-2 text-sm text-theme-sub">
                  <div className="flex gap-1 items-center">
                    <span>邮箱：</span>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      className="outline-none text-theme-main focus-theme-accent-bg rounded px-1 min-w-[100px] inline-block"
                      onBlur={(e) => {
                        const html = e.currentTarget.innerHTML || "";
                        updateProfile((p) => ({ ...p, email: html }));
                      }}
                      dangerouslySetInnerHTML={{ __html: profile.email || "点击编辑邮箱" }}
                    />
                  </div>
                  <div className="flex gap-1 items-center">
                    <span>电话：</span>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      className="outline-none text-theme-main focus-theme-accent-bg rounded px-1 min-w-[100px] inline-block"
                      onBlur={(e) => {
                        const html = e.currentTarget.innerHTML || "";
                        updateProfile((p) => ({ ...p, phone: html }));
                      }}
                      dangerouslySetInnerHTML={{ __html: profile.phone || "点击编辑电话" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-24 right-6 flex flex-col gap-2 z-50">
        <button
          onClick={undo}
          className="w-11 h-11 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:text-blue-500 hover:shadow-lg transition"
          title="撤销 Ctrl+Z"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={redo}
          className="w-11 h-11 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:text-blue-500 hover:shadow-lg transition"
          title="重做 Ctrl+Shift+Z"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="w-11 h-11 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:text-blue-500 hover:shadow-lg transition mt-2"
          title="回到顶部"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      <PublishButton getProfile={getCleanProfile} draftId={draftId} />

      <JdModal
        isOpen={isJdModalOpen}
        onClose={() => setIsJdModalOpen(false)}
        onSubmit={handleJdRewrite}
        isRewriting={isRewriting}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}
