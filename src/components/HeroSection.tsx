"use client";

import ResumeInput from "./ResumeInput";

export default function HeroSection() {
  return (
    <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center">
      <h1 className="text-6xl md:text-[5.5rem] font-serif font-bold leading-[1.05] tracking-tight mb-6 text-balance">
        扔掉死板的 PDF，
        <br />
        <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-500 to-orange-500">
          生成极具质感的求职主页。
        </span>
      </h1>
      <p className="text-xl text-brand-muted mb-10 leading-relaxed max-w-3xl mx-auto">
        OfferGlow
        将干瘪的简历文字，一键转化为支持图文混排、模块化编辑的专属个人网页。用一个自带高光的分身链接，代替被淹没的 A4
        纸。
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-sm font-semibold text-gray-500 mb-10">
        <span className="bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 flex items-center gap-2 text-black">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> 粘贴文本
        </span>
        <span className="text-gray-300">→</span>
        <span className="bg-white/60 px-4 py-2 rounded-full border border-gray-100/50">
          一键生成网页
        </span>
        <span className="text-gray-300">→</span>
        <span className="bg-white/60 px-4 py-2 rounded-full border border-gray-100/50">
          自由配图排版
        </span>
        <span className="text-gray-300">→</span>
        <span className="bg-white/60 px-4 py-2 rounded-full border border-gray-100/50">
          发布专属链接
        </span>
      </div>

      <ResumeInput />
    </section>
  );
}
