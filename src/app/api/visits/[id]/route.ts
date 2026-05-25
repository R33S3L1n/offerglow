import { NextRequest, NextResponse } from "next/server";
import { getVisitCount } from "@/lib/kv";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const count = await getVisitCount(params.id);
  return NextResponse.json({ count });
}
