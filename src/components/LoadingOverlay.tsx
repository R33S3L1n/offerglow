"use client";

interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  body?: string;
}

export default function LoadingOverlay({
  visible,
  title = "正在生成网页分身…",
  body = "系统正在解析你的简历内容，并填充到个人网页模板里。",
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-md mx-4">
        <p className="text-xs font-semibold text-gray-400 tracking-[0.2em] uppercase mb-3">
          OfferGlow
        </p>
        <h3 className="text-2xl font-serif font-bold mb-3">{title}</h3>
        <p className="text-gray-500 leading-relaxed">{body}</p>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mt-5">
          <div className="h-full w-1/2 bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}
