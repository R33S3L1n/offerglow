import { NextRequest, NextResponse } from "next/server";
import { savePublishedPage } from "@/lib/kv";
import { renderPageHtml } from "@/lib/renderer";
import { normalizeProfile } from "@/lib/parser";
import type { MasterProfile } from "@/lib/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function POST(request: NextRequest) {
  try {
    const { profile, userId }: { profile?: Partial<MasterProfile>; userId?: string } = await request.json();
    if (!profile) {
      return NextResponse.json({ error: "Missing profile" }, { status: 400 });
    }

    const normalized = normalizeProfile(profile);
    const html = renderPageHtml(normalized);
    const pageId = generateId();
    await savePublishedPage(pageId, html, normalized.name || "未命名页面", userId);

    return NextResponse.json({ url: `/p/${pageId}`, pageId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 }
    );
  }
}
