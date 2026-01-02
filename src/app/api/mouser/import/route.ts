import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ImportItem = { partNumber: string; qty: number };

function normalizePartNumber(input: string) {
  return input.trim().toUpperCase();
}

function clampInt(n: unknown) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.floor(x));
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    fileName?: string;
    items?: ImportItem[];
  };

  const fileName = String(body.fileName ?? "mouser-import");
  const rawItems = body.items ?? [];

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "items are required" }, { status: 400 });
  }

  // normalize + merge duplicates
  const merged = new Map<string, number>();
  for (const it of rawItems) {
    const pn = normalizePartNumber(String(it.partNumber ?? ""));
    const qty = clampInt(it.qty);
    if (!pn || qty <= 0) continue;
    merged.set(pn, (merged.get(pn) ?? 0) + qty);
  }

  const items = Array.from(merged.entries()).map(([partNumber, qty]) => ({
    partNumber,
    qty,
  }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid rows (PN + qty > 0)" },
      { status: 400 }
    );
  }

  const partNumbers = items.map((i) => i.partNumber);

  const existing = await prisma.part.findMany({
    where: { partNumber: { in: partNumbers } },
    select: { id: true, partNumber: true },
  });

  const byPn = new Map(existing.map((p) => [p.partNumber, p]));

  const batch = await prisma.purchaseImportBatch.create({
    data: {
      fileName,
      meta: {
        supplier: "Mouser",
        distinctItems: items.length,
      },
    },
    select: { id: true },
  });

  let createdParts = 0;
  let updatedParts = 0;
  let errorLines = 0;

  for (const it of items) {
    const found = byPn.get(it.partNumber);

    try {
      if (!found) {
        const created = await prisma.part.create({
          data: {
            partNumber: it.partNumber,
            supplier: "Mouser",
            inventory: { create: { onOrder: it.qty } },
          },
          select: { id: true },
        });

        createdParts += 1;

        await prisma.purchaseImportLine.create({
          data: {
            batchId: batch.id,
            partNumberRaw: it.partNumber,
            partId: created.id,
            qty: it.qty,
            status: "CREATED_PART",
          },
        });

        continue;
      }

      await prisma.inventory.upsert({
        where: { partId: found.id },
        create: { partId: found.id, onOrder: it.qty },
        update: { onOrder: { increment: it.qty } },
      });

      updatedParts += 1;

      await prisma.purchaseImportLine.create({
        data: {
          batchId: batch.id,
          partNumberRaw: it.partNumber,
          partId: found.id,
          qty: it.qty,
          status: "UPDATED_ON_ORDER",
        },
      });
    } catch (e) {
      errorLines += 1;

      await prisma.purchaseImportLine.create({
        data: {
          batchId: batch.id,
          partNumberRaw: it.partNumber,
          partId: found?.id,
          qty: it.qty,
          status: "ERROR",
          error: e instanceof Error ? e.message : "Unknown error",
        },
      });
    }
  }

  return NextResponse.json({
    batchId: batch.id,
    createdParts,
    updatedParts,
    errorLines,
  });
}