import { NextRequest, NextResponse } from "next/server";
import { renderPageHtml } from "@/lib/renderer";
import type { MasterProfile } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { profile }: { profile?: MasterProfile } = await request.json();

    if (!profile) {
      return NextResponse.json({ error: "Missing profile" }, { status: 400 });
    }

    const html = renderPageHtml(profile);
    return NextResponse.json({ html });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
