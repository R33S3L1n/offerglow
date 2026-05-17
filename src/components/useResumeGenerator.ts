"use client";

import { useState, useCallback } from "react";
import type { ParseResult } from "@/lib/types";

export function useResumeGenerator() {
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // 1. Open preview window (must be synchronous to avoid popup blocking)
    const preview = window.open("", "_blank");
    if (!preview) {
      alert("请允许浏览器打开新窗口后重试。");
      return;
    }
    showLoading(preview);
    setLoading(true);

    try {
      // 2. Call backend to parse resume
      const parseRes = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!parseRes.ok) throw new Error("解析失败");

      const data: ParseResult & { debugError?: string } = await parseRes.json();
      if (data.debugError) {
        console.warn("AI parse fallback:", data.debugError);
      }

      // 3. Call backend to generate HTML from profile
      const pageRes = await fetch("/api/generate-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: data.profile }),
      });
      if (!pageRes.ok) throw new Error("页面生成失败");

      const { html } = await pageRes.json();

      // 4. Render in preview window
      preview.document.open();
      preview.document.write(html);
      preview.document.close();
    } catch (err) {
      preview.close();
      alert("生成失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading };
}

function showLoading(preview: Window) {
  preview.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>OfferGlow</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fafafa; font-family: -apple-system, 'PingFang SC', sans-serif; }
  .card { text-align: center; padding: 48px 40px; background: white; border-radius: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.08); max-width: 380px; width: 90%; }
  .logo { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #111; margin-bottom: 32px; }
  .dot { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #f97316); }
  .spinner { width: 44px; height: 44px; border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.75s linear infinite; margin: 0 auto 24px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h3 { font-size: 20px; font-weight: 600; color: #111; margin-bottom: 10px; }
  p { font-size: 14px; color: #9ca3af; line-height: 1.6; }
</style></head>
<body>
  <div class="card">
    <div class="logo"><div class="dot"></div> OfferGlow</div>
    <div class="spinner"></div>
    <h3>AI 正在解析你的简历</h3>
    <p>正在生成你的专属网页分身，<br>请稍候片刻…</p>
  </div>
</body></html>`);
  preview.document.close();
}
