"use client";

export default function Navbar() {
  return (
    <nav className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center sticky top-4 z-50 glass-nav rounded-full mt-4 shadow-sm">
      <div className="flex items-center gap-2 font-bold text-xl tracking-tight font-serif">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 shadow-inner" />
        OfferGlow
      </div>
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
      <div className="flex items-center gap-6 text-sm font-medium">
        <div className="flex items-center gap-1.5 text-brand-muted cursor-pointer hover:text-black transition bg-white/50 px-3 py-1.5 rounded-full border border-gray-200/50">
          <span className="text-black font-semibold">中</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-400">EN</span>
        </div>
        <span className="cursor-pointer text-lg hover:scale-110 transition-transform">
          🌙
        </span>
        <a href="#" className="hover:text-brand-muted transition">
          登录
        </a>
        <a
          href="#"
          className="bg-brand-dark text-white px-5 py-2.5 rounded-full hover:bg-gray-800 transition shadow-md"
        >
          免费注册
        </a>
      </div>
    </nav>
  );
}
