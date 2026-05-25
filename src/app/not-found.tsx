import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h2 className="text-6xl font-serif font-bold text-gray-900 mb-4">404</h2>
        <h3 className="text-xl font-medium text-gray-800 mb-2">未找到此网页分身</h3>
        <p className="text-gray-500 mb-8 leading-relaxed">
          抱歉，该网页分身链接不存在，或者已被作者下线。
        </p>
        <Link
          href="/"
          className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800 transition"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
