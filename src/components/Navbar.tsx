"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import AuthModal from "./auth/AuthModal";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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

  const getDisplayEmail = (email: string) => {
    if (!email) return "";
    return email.split("@")[0];
  };

  return (
    <>
      <nav className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center sticky top-4 z-50 glass-nav rounded-full mt-4 shadow-sm">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight font-serif">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 shadow-inner" />
          OfferGlow
        </Link>
        <div className="hidden md:flex gap-8 text-sm font-medium text-brand-muted">
          <a href="#process" className="hover:text-black transition">
            使用流程
          </a>
          <a href="#features" className="hover:text-black transition">
            功能亮点
          </a>
          <a href="#faq" className="hover:text-black transition">
            常见问题
          </a>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/dashboard"
            className="text-brand-muted hover:text-black transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            我的草稿
          </Link>
          
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-muted font-normal bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5">
                👤 {getDisplayEmail(user.email)}
              </span>
              <button
                onClick={handleLogout}
                className="text-brand-muted hover:text-red-500 transition text-xs font-semibold"
              >
                退出
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="bg-brand-dark text-white px-5 py-2.5 rounded-full hover:bg-gray-800 transition shadow-md"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </nav>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </>
  );
}
