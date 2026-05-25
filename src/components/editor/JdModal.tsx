"use client";

import { useState, useEffect } from "react";
import type { MasterProfile } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (companyName: string, jdText: string) => Promise<void>;
  isRewriting: boolean;
}

export default function JdModal({ isOpen, onClose, onSubmit, isRewriting }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [jdText, setJdText] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  // Animate loading steps when rewriting
  useEffect(() => {
    if (!isRewriting) {
      setLoadingStep(0);
      return;
    }
    const timer1 = setTimeout(() => setLoadingStep(1), 2000);
    const timer2 = setTimeout(() => setLoadingStep(2), 4500);
    const timer3 = setTimeout(() => setLoadingStep(3), 7000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isRewriting]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jdText.trim()) return;
    onSubmit(companyName.trim(), jdText.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[4px] z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-[2rem] max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] transition-all transform scale-100 duration-300 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {isRewriting ? (
          <div className="p-8 flex flex-col items-center justify-center min-h-[380px] text-center">
            {/* Spinning/pulsing AI core */}
            <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500 via-indigo-500 to-blue-500 animate-spin opacity-20 blur-md" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 animate-pulse" />
              <span className="relative text-white text-2xl">✨</span>
            </div>
            
            <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">
              AI 正在深度润色简历
            </h3>
            <p className="text-sm text-gray-400 mb-8 max-w-xs">
              正在调用 DeepSeek 大模型进行智能对齐，这通常需要 10-15 秒，请稍候...
            </p>

            {/* Steps indicator */}
            <div className="w-full max-w-xs space-y-3.5 text-left text-sm font-medium">
              <div className="flex items-center gap-3">
                {loadingStep >= 0 ? (
                  <span className="text-violet-600">⚡</span>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
                <span className={loadingStep >= 0 ? "text-gray-800" : "text-gray-400"}>
                  分析目标岗位的关键技能和核心画像
                </span>
              </div>
              <div className="flex items-center gap-3">
                {loadingStep >= 1 ? (
                  <span className="text-violet-600">⚡</span>
                ) : loadingStep === 0 && isRewriting ? (
                  <span className="w-4 h-4 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
                <span className={loadingStep >= 1 ? "text-gray-800" : "text-gray-400"}>
                  检索您简历中的契合经历与核心指标
                </span>
              </div>
              <div className="flex items-center gap-3">
                {loadingStep >= 2 ? (
                  <span className="text-violet-600">⚡</span>
                ) : loadingStep === 1 ? (
                  <span className="w-4 h-4 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
                <span className={loadingStep >= 2 ? "text-gray-800" : "text-gray-400"}>
                  重构自我介绍、工作成就与项目业绩
                </span>
              </div>
              <div className="flex items-center gap-3">
                {loadingStep >= 3 ? (
                  <span className="text-violet-600">⚡</span>
                ) : loadingStep === 2 ? (
                  <span className="w-4 h-4 border-2 border-gray-200 border-t-violet-600 rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                )}
                <span className={loadingStep >= 3 ? "text-gray-800" : "text-gray-400"}>
                  生成全局技能标签并评估匹配得分
                </span>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            {/* Header */}
            <div className="px-8 pt-8 pb-4 relative">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h2 className="text-2xl font-serif font-bold text-gray-900 flex items-center gap-2">
                <span>✨</span> 智能 JD 定制简历
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                粘贴目标岗位招聘要求（JD），AI 将智能优化经历表述与标签，大幅提升简历匹配度。
              </p>
            </div>

            {/* Body */}
            <div className="px-8 py-4 space-y-5 flex-1 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                  目标公司名称
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="例如：字节跳动、小红书 (选填)"
                  className="w-full bg-[#fafafa] border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                  目标岗位 JD / 招聘要求 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={8}
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  placeholder="在此粘贴你想申请的岗位职责、任职要求等内容..."
                  className="w-full bg-[#fafafa] border border-gray-100 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-violet-500 focus:bg-white transition resize-none placeholder:text-gray-300"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-800 transition"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!jdText.trim()}
                className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white rounded-full font-medium py-2.5 px-6 shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transition-all flex items-center gap-2 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>✨</span>
                开始 AI 定制
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
