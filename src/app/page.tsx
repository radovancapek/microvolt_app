"use client";

import { useState } from "react";

export default function HomePage() {
  const [partNumber, setPartNumber] = useState("");
  const [onHand, setOnHand] = useState(0);
  const [onOrder, setOnOrder] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    const res = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partNumber, onHand, onOrder }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Error");
      return;
    }
    setMsg(`Saved: ${data.partNumber}`);
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sklad monitor (MVP)</h1>

      <div className="space-y-2 rounded-lg border p-4">
        <label className="block text-sm">
          Part number
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            On hand
            <input
              type="number"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={onHand}
              onChange={(e) => setOnHand(Number(e.target.value))}
            />
          </label>

          <label className="block text-sm">
            On order
            <input
              type="number"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={onOrder}
              onChange={(e) => setOnOrder(Number(e.target.value))}
            />
          </label>
        </div>

        <button
          className="rounded-full bg-lime-400 px-4 py-2 text-sm font-medium text-black"
          onClick={submit}
        >
          Uložit
        </button>

        {msg && <p className="text-sm text-zinc-700">{msg}</p>}
      </div>
    </main>
  );
}