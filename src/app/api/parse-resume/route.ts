import { NextRequest, NextResponse } from "next/server";
import { aiStructureResume } from "@/lib/deepseek";
import { getDeepSeekConfig } from "@/lib/deepseek";

export async function POST(request: NextRequest) {
  try {
    const { text }: { text?: string } = await request.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Missing resume text" }, { status: 400 });
    }

    const { profile, aiStructured, error } = await aiStructureResume(text.trim());

    const { model } = getDeepSeekConfig();

    return NextResponse.json({
      profile,
      aiStructured,
      source: {
        fileType: "text",
        parser: aiStructured ? "deepseek" : "local-rules",
        modelUsed: aiStructured ? model : "local-rules",
      },
      debugError: error || undefined,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Parse failed" },
      { status: 500 }
    );
  }
}
