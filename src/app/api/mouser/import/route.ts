import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type ImportItem = {
  partNumber: string;
  qty: number;
  description?: string;
};

function normalizePartNumber(input: string) {
  return input.trim().toUpperCase();
}

function clampInt(n: unknown) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.floor(x));
}

function normalizeDescription(input: unknown) {
  const s = String(input ?? "").trim();
  return s.length ? s : null;
}

function normalizeSalesOrderNo(input: unknown) {
  const s = String(input ?? "").trim();
  return s.length ? s : null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    fileName?: string;
    salesOrderNo?: string;
    items?: ImportItem[];
  };

  const fileName = String(body.fileName ?? "mouser-import");
  const salesOrderNo = normalizeSalesOrderNo(body.salesOrderNo);
  const rawItems = body.items ?? [];

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "items are required" }, { status: 400 });
  }

  // normalize + merge duplicates (qty sum; description pick best)
  const qtyByPn = new Map<string, number>();
  const descByPn = new Map<string, string | null>();

  for (const it of rawItems) {
    const pn = normalizePartNumber(String(it.partNumber ?? ""));
    const qty = clampInt(it.qty);
    if (!pn || qty <= 0) continue;

    qtyByPn.set(pn, (qtyByPn.get(pn) ?? 0) + qty);

    const desc = normalizeDescription(it.description);
    if (desc) {
      const prev = descByPn.get(pn);
      if (!prev || desc.length > prev.length) {
        descByPn.set(pn, desc);
      }
    }
  }

  const items = Array.from(qtyByPn.entries()).map(([partNumber, qty]) => ({
    partNumber,
    qty,
    description: descByPn.get(partNumber) ?? null,
  }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid rows (PN + qty > 0)" },
      { status: 400 }
    );
  }

  // duplicate guard (Sales Order No)
  if (salesOrderNo) {
    const existingBatch = await prisma.purchaseImportBatch.findUnique({
      where: { salesOrderNo },
      select: { id: true, createdAt: true, fileName: true },
    });

    if (existingBatch) {
      return NextResponse.json(
        {
          error: `Tato objednávka už byla importována (Sales Order No: ${salesOrderNo}, batchId: ${existingBatch.id}).`,
          existingBatch,
        },
        { status: 409 }
      );
    }
  }

  const partNumbers = items.map((i) => i.partNumber);

  const existingParts = await prisma.part.findMany({
    where: { partNumber: { in: partNumbers } },
    select: { id: true, partNumber: true, description: true },
  });

  const byPn = new Map(existingParts.map((p) => [p.partNumber, p]));

  let batchId: string;

  try {
    const batch = await prisma.purchaseImportBatch.create({
      data: {
        fileName,
        salesOrderNo,
        meta: {
          supplier: "Mouser",
          distinctItems: items.length,
        },
      },
      select: { id: true },
    });

    batchId = batch.id;
  } catch (e) {
    // handle unique race (two imports at same time)
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" &&
      salesOrderNo
    ) {
      const existingBatch = await prisma.purchaseImportBatch.findUnique({
        where: { salesOrderNo },
        select: { id: true, createdAt: true, fileName: true },
      });

      return NextResponse.json(
        {
          error: `Tato objednávka už byla importována (Sales Order No: ${salesOrderNo}).`,
          existingBatch,
        },
        { status: 409 }
      );
    }

    throw e;
  }

  let createdParts = 0;
  let updatedParts = 0;
  let descriptionFilled = 0;
  let errorLines = 0;

  for (const it of items) {
    const found = byPn.get(it.partNumber);

    try {
      if (!found) {
        const created = await prisma.part.create({
          data: {
            partNumber: it.partNumber,
            supplier: "Mouser",
            description: it.description,
            inventory: { create: { onOrder: it.qty } },
          },
          select: { id: true },
        });

        createdParts += 1;

        await prisma.purchaseImportLine.create({
          data: {
            batchId,
            partNumberRaw: it.partNumber,
            partId: created.id,
            qty: it.qty,
            status: "CREATED_PART",
          },
        });

        continue;
      }

      // increment onOrder
      await prisma.inventory.upsert({
        where: { partId: found.id },
        create: { partId: found.id, onOrder: it.qty },
        update: { onOrder: { increment: it.qty } },
      });

      updatedParts += 1;

      // fill description if missing in DB and provided by import
      if (!found.description && it.description) {
        await prisma.part.update({
          where: { id: found.id },
          data: { description: it.description },
        });
        descriptionFilled += 1;
      }

      await prisma.purchaseImportLine.create({
        data: {
          batchId,
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
          batchId,
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
    batchId,
    salesOrderNo,
    createdParts,
    updatedParts,
    descriptionFilled,
    errorLines,
  });
}