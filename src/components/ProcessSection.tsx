export default function ProcessSection() {
  const steps = [
    {
      num: "01",
      color: "blue",
      title: "粘贴原始经历",
      desc: "不必纠结格式。将你已有的简历纯文本直接粘贴进来，系统会自动识别经历、技能、教育等核心区块。",
      visual: (
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="w-1/3 h-6 bg-blue-100 rounded animate-pulse" />
          <div className="w-full h-3 bg-gray-100 rounded" />
          <div className="w-4/5 h-3 bg-gray-100 rounded" />
        </div>
      ),
    },
    {
      num: "02",
      color: "purple",
      title: "一键生成结构化网页",
      desc: "系统瞬间为你构建出一个具备顶级杂志排版美学、留白呼吸感的网页框架，告别密密麻麻的文本堆砌。",
      visual: (
        <div className="bg-[#faf9f6] p-6 rounded-[2rem] border border-gray-100 shadow-inner flex gap-4">
          <div className="w-1/4 bg-purple-100/50 rounded-xl h-24" />
          <div className="w-3/4 flex flex-col gap-3 justify-center">
            <div className="w-1/2 h-4 bg-purple-200 rounded" />
            <div className="w-full h-2 bg-gray-200 rounded" />
            <div className="w-5/6 h-2 bg-gray-200 rounded" />
          </div>
        </div>
      ),
    },
    {
      num: "03",
      color: "orange",
      title: "自由编辑与配图",
      desc: "进入可视化编辑器。上传最能代表你的头像、项目实录图片；调整模块的先后顺序；随时修改文字描述。",
      visual: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-gray-100 rounded-[1.5rem] shadow-sm flex items-center justify-center gap-3">
            <span className="text-2xl">🖼️</span>
            <span className="text-sm font-bold text-gray-600">加入丰富视觉</span>
          </div>
          <div className="p-4 bg-white border border-gray-100 rounded-[1.5rem] shadow-sm flex items-center justify-center gap-3">
            <span className="text-2xl">🖱️</span>
            <span className="text-sm font-bold text-gray-600">点击拖拽排版</span>
          </div>
        </div>
      ),
    },
    {
      num: "04",
      color: "pink",
      title: "获得专属分享链接",
      desc: "点击发布，获得你的永久网页链接。完美适配手机和电脑端，轻松发送给 HR 或直接挂在社交媒体主页。",
      visual: (
        <div
          className="h-32 rounded-[2rem] flex items-center justify-center font-bold text-pink-600 bg-cover bg-center shadow-md relative overflow-hidden"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800&q=80')",
          }}
        >
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />
          <div className="relative z-10 flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-lg border border-pink-100">
            <span className="text-gray-400">🔗</span> offerglow.com/in/yourname
            <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
              复制
            </span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section id="process" className="max-w-7xl mx-auto px-6 py-32">
      <p className="text-xs font-semibold text-brand-muted tracking-widest uppercase mb-4">
        Journey
      </p>
      <h2 className="text-5xl font-serif font-bold mb-20">极简四步，生成专属链接</h2>

      <div className="space-y-12">
        {steps.map((step) => (
          <div
            key={step.num}
            className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center group"
          >
            <div
              className={`md:col-span-1 text-5xl font-serif italic text-gray-200 group-hover:text-${step.color}-500 transition-colors`}
            >
              {step.num}
            </div>
            <div className="md:col-span-4 h-full pr-8">
              <h4 className="text-2xl font-bold mb-3">{step.title}</h4>
              <p className="text-brand-muted text-sm leading-relaxed">{step.desc}</p>
            </div>
            <div className="md:col-span-7">{step.visual}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
