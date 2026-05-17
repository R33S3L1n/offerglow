"use client";

export default function CtaSection() {
  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const textarea = document.querySelector("textarea");
    if (textarea) setTimeout(() => textarea.focus(), 400);
  };

  return (
    <section className="max-w-7xl mx-auto px-6 pb-32">
      <div className="bg-[#111] text-white rounded-[3rem] p-20 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] bg-gradient-to-b from-blue-600/30 via-orange-500/10 to-transparent opacity-50 blur-3xl pointer-events-none" />
        <h2 className="text-5xl md:text-6xl font-serif font-bold mb-8 relative z-10">
          用十分钟，
          <br />
          <span className="italic text-gray-400">搭建让人过目不忘的分身。</span>
        </h2>
        <button
          onClick={handleClick}
          className="bg-white text-black px-12 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl relative z-10"
        >
          免费生成我的求职网页
        </button>
      </div>
    </section>
  );
}
