import { NextRequest, NextResponse } from "next/server";
import { aiRewriteForJd } from "@/lib/deepseek";
import { normalizeProfile } from "@/lib/parser";
import type { MasterProfile } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const {
      masterProfile,
      jobDescription,
      companyName,
    }: {
      masterProfile?: Partial<MasterProfile>;
      jobDescription?: string;
      companyName?: string;
    } = await request.json();

    if (!masterProfile) {
      return NextResponse.json({ error: "Missing masterProfile" }, { status: 400 });
    }
    const jd = (jobDescription || "").trim();
    if (!jd) {
      return NextResponse.json({ error: "Missing jobDescription" }, { status: 400 });
    }

    const profile = normalizeProfile(masterProfile);
    const result = await aiRewriteForJd(profile, jd, (companyName || "").trim());

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rewrite failed" },
      { status: 500 }
    );
  }
}
