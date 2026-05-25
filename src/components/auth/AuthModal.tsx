"use client";

import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setPassword("");
      setMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured() || !supabase) {
      setMessage({
        type: "error",
        text: "Supabase 未配置。请在 .env.local 中配置 Supabase URL 和 Key。",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;
        
        // Supabase sometimes requires email verification, check if session is created immediately
        if (data.session) {
          setMessage({ type: "success", text: "注册成功并已登录！" });
          setTimeout(() => {
            onSuccess?.();
            onClose();
          }, 1500);
        } else {
          setMessage({
            type: "success",
            text: "注册成功！请检查您的邮箱进行确认（如果开启了邮箱验证）。",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage({ type: "success", text: "登录成功！" });
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "发生错误，请稍后再试。",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Decorative Top Banner */}
        <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 h-2 w-full" />

        <div className="p-8">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Heading */}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">
              {isSignUp ? "创建您的 OfferGlow 账号" : "登录您的 OfferGlow 账号"}
            </h3>
            <p className="text-xs text-gray-400">
              {isSignUp ? "同步简历草稿至云端，在任何设备继续编辑" : "登录后自动同步云端草稿与已发布页面"}
            </p>
          </div>

          {/* Message Notification */}
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium mb-5 leading-5 ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-red-50 text-red-700 border border-red-100"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">邮箱地址</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-50 border border-gray-100 text-gray-900 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">输入密码</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-100 text-gray-900 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium py-3.5 px-6 rounded-full hover:opacity-95 shadow-md hover:shadow-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSignUp ? (
                "注册并开始使用"
              ) : (
                "立即登录"
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="text-center mt-6">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-violet-600 hover:text-indigo-600 font-medium transition"
            >
              {isSignUp ? "已有账号？立即登录" : "还没有账号？免费注册"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
