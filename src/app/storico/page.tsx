"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { RecordTest } from "@/lib/types";
import { Badge, api, euro } from "@/components/ui";

type Riga = Pick<RecordTest, "id" | "created_at" | "autore" | "stato" | "input" | "costo">;

export default function Storico() {
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [errore, setErrore] = useState("");
  useEffect(() => {
    api<Riga[]>("/api/tests").then(setRighe).catch((e) => setErrore(e.message));
  }, []);

  const totale = (righe ?? []).reduce((a, r) => a + Number(r.costo || 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="eyebrow">Archivio</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Test generati</h1>
        </div>
        {righe && <span className="font-mono text-xs text-n-400">{righe.length} test · costo totale {euro(totale)}</span>}
      </div>
      {errore && <p className="text-err">{errore}</p>}
      {!righe && !errore && <p className="text-sm text-n-400">Caricamento…</p>}
      {righe && righe.length === 0 && (
        <div className="card p-8 text-center text-sm text-n-400">
          Nessun test ancora. <Link className="text-a-700 underline" href="/">Generane uno</Link>.
        </div>
      )}
      {righe && righe.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-n-25 text-left text-xs text-n-400">
              <tr>
                <th className="px-4 py-2 font-medium">Ruolo</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Autore</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Data</th>
                <th className="px-4 py-2 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-n-50">
              {righe.map((r) => (
                <tr key={r.id} className="hover:bg-n-25">
                  <td className="px-4 py-2.5">
                    <Link href={`/test/${r.id}`} className="font-medium hover:text-a-700">
                      {r.input.jobTitle}
                    </Link>
                    <span className="block text-xs text-n-400">
                      {r.input.seniority} · {r.input.durata} min · {r.input.contesto}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{r.input.tipo === "inBasket" ? "In-basket" : "Situazionale"}</td>
                  <td className="hidden px-4 py-2.5 text-n-600 md:table-cell">{r.autore}</td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-n-400 md:table-cell">{new Date(r.created_at).toLocaleDateString("it-IT")}</td>
                  <td className="px-4 py-2.5">
                    <Badge tono={r.stato === "approvato" ? "ok" : r.stato === "scartato" ? "err" : "warn"}>{r.stato}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
