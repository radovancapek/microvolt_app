import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BomItem = { partNumber: string; qty: number };

function normalizePartNumber(input: string) {
  return input.trim().toUpperCase();
}

function clampInt(n: unknown, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.floor(x));
}

function ceilToMultiple(value: number, multiple: number) {
  if (multiple <= 1) return value;
  return Math.ceil(value / multiple) * multiple;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { items?: BomItem[] };

  const rawItems = body.items ?? [];
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "items are required" }, { status: 400 });
  }

  // normalize + merge duplicates
  const map = new Map<string, number>();
  for (const it of rawItems) {
    const pn = normalizePartNumber(String(it.partNumber ?? ""));
    const qty = clampInt(it.qty, 0);
    if (!pn || qty <= 0) continue;
    map.set(pn, (map.get(pn) ?? 0) + qty);
  }

  const items = Array.from(map.entries()).map(([partNumber, qty]) => ({
    partNumber,
    qty,
  }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid items after normalization" },
      { status: 400 }
    );
  }

  const partNumbers = items.map((i) => i.partNumber);

  const parts = await prisma.part.findMany({
    where: { partNumber: { in: partNumbers } },
    include: {
      inventory: true,
      assignments: {
        where: { active: true },
        include: { feeder: true },
      },
    },
  });

  const byPn = new Map(parts.map((p) => [p.partNumber, p]));

  const result = items.map((it) => {
    const p = byPn.get(it.partNumber);

    const onHand = p?.inventory?.onHand ?? 0;
    const reserved = p?.inventory?.reserved ?? 0;
    const onOrder = p?.inventory?.onOrder ?? 0;

    const availableNow = Math.max(0, onHand - reserved);
    const availableFuture = Math.max(0, onHand - reserved + onOrder);

    const shortageNow = Math.max(0, it.qty - availableNow);
    const shortageFuture = Math.max(0, it.qty - availableFuture);

    const moq = p?.moq ?? 1;
    const orderMultiple = p?.orderMultiple ?? 1;

    const needToOrder = shortageFuture;
    const moqApplied = Math.max(needToOrder, moq);
    const orderQty =
      needToOrder <= 0 ? 0 : ceilToMultiple(moqApplied, orderMultiple);

    const feederNos = (p?.assignments ?? [])
      .map((a) => a.feeder.feederNo)
      .sort((a, b) => a.localeCompare(b, "cs"));

    const isAssigned = feederNos.length > 0;

    let status: "OK" | "WAITING" | "ORDER";
    if (shortageNow <= 0) status = "OK";
    else if (shortageFuture <= 0) status = "WAITING";
    else status = "ORDER";

    // New/unknown PN => treat as ORDER (your requirement)
    if (!p) status = "ORDER";

    return {
      partNumber: it.partNumber,
      qtyRequired: it.qty,

      knownPart: Boolean(p),
      feederNos,

      onHand,
      reserved,
      onOrder,
      availableNow,
      availableFuture,

      shortageNow,
      shortageFuture,

      moq,
      orderMultiple,
      orderQty,

      status,
      assigned: isAssigned,
    };
  });

  return NextResponse.json({ items: result });
}