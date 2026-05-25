"use client";

import { useState, useCallback } from "react";
import type { ParseResult } from "@/lib/types";
import { saveDraft } from "@/lib/draftStorage";

export function useResumeGenerator() {
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      // Call backend to parse resume
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error("解析失败");

      const data: ParseResult & { debugError?: string } = await res.json();
      if (data.debugError) {
        console.warn("AI parse fallback:", data.debugError);
      }

      // Save profile as draft in localStorage
      const draftId = saveDraft(data.profile);

      // Redirect to editor
      window.location.href = `/editor?draft=${draftId}`;
    } catch (err) {
      alert("生成失败：" + (err instanceof Error ? err.message : "未知错误"));
      setLoading(false);
    }
  }, []);

  return { generate, loading };
}
