export default function FeaturesSection() {
  return (
    <section id="features" className="max-w-7xl mx-auto px-6 py-32 border-b border-gray-200/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        <div>
          <p className="text-xs font-semibold text-brand-muted tracking-widest uppercase mb-4">
            Wysiwyg Editor
          </p>
          <h2 className="text-5xl font-serif font-bold mb-6">
            像拼乐高一样，
            <br />
            自由定制你的网页。
          </h2>
          <p className="text-lg text-brand-muted mb-8 leading-relaxed">
            无需任何代码知识。OfferGlow
            将你的经历解析为一个个独立的模块。你只需点击、修改、上传图片，剩下的质感交给我们的设计系统。
          </p>
          <ul className="space-y-4">
            <li className="flex items-center gap-3 text-brand-dark font-medium">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                ✓
              </span>
              上传个人头像与项目实拍图
            </li>
            <li className="flex items-center gap-3 text-brand-dark font-medium">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">
                ✓
              </span>
              自由拖拽模块位置，隐藏多余内容
            </li>
            <li className="flex items-center gap-3 text-brand-dark font-medium">
              <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs">
                ✓
              </span>
              点击文本即可直接修改，所见即所得
            </li>
          </ul>
        </div>

        <div className="relative bg-white rounded-[2rem] shadow-2xl p-4 border border-gray-100 min-h-[500px]">
          <div className="flex gap-2 mb-6 ml-2 mt-2">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="px-6">
            <h3 className="text-3xl font-serif font-bold mb-2">用户增长负责人</h3>
            <p className="text-gray-500 mb-6 text-sm">主导千万级产品运营，提升转化率15%</p>
            <div className="rounded-xl overflow-hidden bg-gray-100 h-40 mb-4">
              <img
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80"
                alt="Data"
                className="w-full h-full object-cover opacity-90"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
