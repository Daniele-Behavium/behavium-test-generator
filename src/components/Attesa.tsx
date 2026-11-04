"use client";
import { useEffect, useState } from "react";

export type Fase = {
  id: string;
  label: string;
  stato: "attesa" | "in_corso" | "ok" | "errore";
  dettaglio?: string;
  inizio?: number; // timestamp di quando la fase è partita
  peso: number; // quota della barra (le fasi sommano a 100)
  attesi: number; // secondi stimati
};

function useOrologio(attivo = true) {
  const [ora, setOra] = useState(() => Date.now());
  useEffect(() => {
    if (!attivo) return;
    const t = setInterval(() => setOra(Date.now()), 500);
    return () => clearInterval(t);
  }, [attivo]);
  return ora;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Indicatore per attese brevi senza fasi (analisi della JD). */
export function Loader({ messaggio, stima, inizio }: { messaggio: string; stima: string; inizio: number }) {
  const ora = useOrologio();
  return (
    <div className="card p-5" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-a-100 border-t-a-500" />
        <span className="text-sm font-medium">{messaggio}</span>
        <span className="ml-auto font-mono text-xs text-n-400">{mmss((ora - inizio) / 1000)}</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-n-50">
        <div className="h-full w-1/3 animate-[scorri_1.4s_ease-in-out_infinite] rounded-full bg-a-500" />
      </div>
      <p className="mt-2 text-xs text-n-400">{stima}</p>
    </div>
  );
}

/** Barra di avanzamento con percentuale, stimata da fasi completate e tempo trascorso in quelle in corso. */
export function Progresso({ fasi, inizio, finito }: { fasi: Fase[]; inizio: number; finito: boolean }) {
  const ora = useOrologio(!finito);
  let pct = 0;
  for (const f of fasi) {
    if (f.stato === "ok") pct += f.peso;
    else if (f.stato === "in_corso" && f.inizio) pct += f.peso * Math.min(0.9, (ora - f.inizio) / 1000 / f.attesi);
  }
  pct = finito ? 100 : Math.min(99, Math.round(pct));
  const errore = fasi.some((f) => f.stato === "errore");
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl font-medium text-n-900">{pct}%</span>
        <span className="font-mono text-xs text-n-400">tempo trascorso {mmss((ora - inizio) / 1000)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-n-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${errore ? "bg-err" : "bg-a-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
