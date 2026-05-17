export default function WhySection() {
  return (
    <section className="bg-brand-dark text-white py-24 rounded-t-[3rem]">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-serif font-bold mb-16 text-center">
          为什么传统简历正在失效？
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          <div className="border-l border-white/10 pl-6">
            <h3 className="text-2xl font-serif font-bold mb-4 italic text-orange-400">
              PDF 承载力太弱
            </h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              干瘪的 A4
              纸放不下你的生活侧影、项目实拍图和真实特质。在这个信息爆炸的时代，纯文字很难勾起面试官的阅读欲。
            </p>
          </div>
          <div className="border-l border-white/10 pl-6">
            <h3 className="text-2xl font-serif font-bold mb-4 italic text-blue-400">
              建站工具门槛太高
            </h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              想做一个好看的个人网站，却被 Webflow 或 WordPress
              复杂的学习成本劝退。你只需要一个能快速出效果的专属主页。
            </p>
          </div>
          <div className="border-l border-white/10 pl-6">
            <h3 className="text-2xl font-serif font-bold mb-4 italic text-purple-400">
              千篇一律没记忆点
            </h3>
            <p className="text-gray-400 leading-relaxed text-sm">
              HR
              每天看几百份黑白文档，大家长得都一样。你需要向对方展示一个立体的「人」，而不仅仅是一个打工的代码。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
