import { NextResponse } from "next/server";

export async function GET() {
  const deepseekKey1 = process.env.DEEPSEEK_API_KEY || "";
  const deepseekKey2 = process.env.deepseek || "";
  const effectiveKey = deepseekKey1 || deepseekKey2;

  return NextResponse.json({
    DEEPSEEK_API_KEY: deepseekKey1
      ? `已配置 (长度=${deepseekKey1.length}, 前4位=${deepseekKey1.slice(0, 4)})`
      : "❌ 未配置",
    deepseek: deepseekKey2
      ? `已配置 (长度=${deepseekKey2.length}, 前4位=${deepseekKey2.slice(0, 4)})`
      : "❌ 未配置",
    effectiveKey: effectiveKey
      ? `✅ 有效 (长度=${effectiveKey.length})`
      : "❌ 无任何 DeepSeek 密钥 → 会走本地规则解析",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `✅ 已配置`
      : "❌ 未配置",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `✅ 已配置`
      : "❌ 未配置",
    NODE_ENV: process.env.NODE_ENV,
  });
}
