"use client";

import { useState, useCallback } from "react";
import { useResumeGenerator } from "./useResumeGenerator";

export default function ResumeInput() {
  const [text, setText] = useState("");
  const { generate, loading } = useResumeGenerator();

  const handleGenerate = useCallback(() => {
    generate(text);
  }, [text, generate]);

  const charCount = text.trim().length;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-[2rem] p-3 input-shadow transition-all hover:shadow-2xl hover:shadow-blue-900/5 relative group">
      <div className="relative bg-[#faf9f6] rounded-[1.5rem] overflow-hidden border border-gray-100/50 focus-within:bg-white focus-within:border-blue-200 transition-colors duration-300">
        <textarea
          className="w-full h-[220px] bg-transparent p-8 text-gray-800 placeholder-gray-400 focus:outline-none resize-none text-lg leading-relaxed"
          placeholder="请在此粘贴你的纯文本简历内容..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#faf9f6] via-[#faf9f6] to-transparent group-focus-within:from-white group-focus-within:via-white flex justify-between items-end">
          <div className="flex items-center gap-2 pl-4 pb-2 hidden md:flex">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs text-gray-400 font-medium tracking-wide">
              {charCount
                ? `已输入 ${charCount} 个字符`
                : "支持直接复制 PDF、Word 或招聘软件上的文字"}
            </span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !charCount}
            className="ml-auto bg-brand-dark text-white px-8 py-3.5 rounded-full font-bold hover:bg-gray-800 transition shadow-xl shadow-black/10 flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-xl">✨</span>
            {loading ? "正在生成..." : "一键生成网页分身"}
            <svg
              className="w-4 h-4 text-white/70 group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
