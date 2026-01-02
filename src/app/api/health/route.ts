import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await prisma.part.count();
  return NextResponse.json({ ok: true });
}