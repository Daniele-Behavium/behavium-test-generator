"use client";
import { useCallback, useEffect, useState } from "react";
import type { Regola } from "@/lib/types";
import { Badge, api } from "@/components/ui";

const AMBITI = { tutti: "Tutti i test", inBasket: "Solo in-basket", situational: "Solo situazionali" } as const;

export default function Regole() {
  const [regole, setRegole] = useState<Regola[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [nuova, setNuova] = useState("");
  const [ambito, setAmbito] = useState<Regola["ambito"]>("tutti");

  const carica = useCallback(() => api<Regola[]>("/api/regole").then(setRegole).catch((e) => setMsg(e.message)), []);
  useEffect(() => {
    carica();
  }, [carica]);

  async function proponi() {
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ proposte: number; messaggio?: string }>("/api/regole/proponi", {});
      setMsg(r.messaggio ?? (r.proposte ? `${r.proposte} nuove regole proposte: approvale o scartale qui sotto.` : "I feedback nuovi non giustificano regole generali."));
      carica();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function aggiorna(id: string, patch: Partial<Regola>) {
    await api(`/api/regole/${id}`, patch, "PATCH");
    carica();
  }
  async function aggiungi() {
    if (!nuova.trim()) return;
    await api("/api/regole", { testo: nuova, ambito });
    setNuova("");
    carica();
  }

  const proposte = regole.filter((r) => r.stato === "proposta");
  const approvate = regole.filter((r) => r.stato === "approvata");
  const scartate = regole.filter((r) => r.stato === "scartata");

  return (
    <div className="max-w-3xl">
      <p className="eyebrow">Apprendimento</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Regole apprese</h1>
      <p className="mt-2 text-sm leading-relaxed text-n-600">
        Le regole approvate entrano in ogni nuova generazione. Nascono dai feedback lasciati sui test (o le scrivete a mano). Insieme ai test approvati, usati come esempi di
        riferimento, sono il modo in cui il generatore migliora nel tempo.
      </p>

      <div className="card mt-6 flex flex-wrap items-center gap-3 p-4">
        <button className="btn-primary" onClick={proponi} disabled={busy}>
          {busy ? "Analizzo i feedback…" : "Analizza i nuovi feedback e proponi regole"}
        </button>
        {msg && <span className="text-sm text-n-600">{msg}</span>}
      </div>

      {proposte.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow mb-2">Da approvare ({proposte.length})</p>
          <ul className="space-y-2">
            {proposte.map((r) => (
              <RigaRegola key={r.id} r={r} aggiorna={aggiorna} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <p className="eyebrow mb-2">Attive ({approvate.length})</p>
        {approvate.length === 0 && <p className="text-sm text-n-400">Nessuna regola attiva.</p>}
        <ul className="space-y-2">
          {approvate.map((r) => (
            <RigaRegola key={r.id} r={r} aggiorna={aggiorna} />
          ))}
        </ul>
        <div className="card mt-3 flex flex-col gap-2 p-3 sm:flex-row">
          <input className="field" placeholder="Aggiungi una regola a mano, es. Nei test per junior evita riferimenti a normative specifiche" value={nuova} onChange={(e) => setNuova(e.target.value)} />
          <select className="field sm:w-44" value={ambito} onChange={(e) => setAmbito(e.target.value as Regola["ambito"])}>
            {Object.entries(AMBITI).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn-dark" onClick={aggiungi}>
            Aggiungi
          </button>
        </div>
      </section>

      {scartate.length > 0 && (
        <details className="mt-8">
          <summary className="eyebrow cursor-pointer">Scartate ({scartate.length})</summary>
          <ul className="mt-2 space-y-2 opacity-70">
            {scartate.map((r) => (
              <RigaRegola key={r.id} r={r} aggiorna={aggiorna} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RigaRegola({ r, aggiorna }: { r: Regola; aggiorna: (id: string, p: Partial<Regola>) => void }) {
  const [edit, setEdit] = useState(false);
  const [testo, setTesto] = useState(r.testo);
  return (
    <li className="card p-4">
      {edit ? (
        <div className="flex gap-2">
          <input className="field" value={testo} onChange={(e) => setTesto(e.target.value)} />
          <button
            className="btn-dark btn-sm"
            onClick={() => {
              aggiorna(r.id, { testo });
              setEdit(false);
            }}
          >
            Salva
          </button>
        </div>
      ) : (
        <p className="text-sm text-n-900">{r.testo}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge>{AMBITI[r.ambito]}</Badge>
        <span className="font-mono text-[11px] text-n-400">
          {r.origine === "manuale" ? "manuale" : "da feedback"} · {r.autore}
        </span>
        <span className="ml-auto flex gap-1.5">
          {r.stato !== "approvata" && (
            <button className="btn-primary btn-sm" onClick={() => aggiorna(r.id, { stato: "approvata" })}>
              Approva
            </button>
          )}
          {r.stato !== "scartata" && (
            <button className="btn-ghost btn-sm" onClick={() => aggiorna(r.id, { stato: "scartata" })}>
              {r.stato === "approvata" ? "Disattiva" : "Scarta"}
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={() => setEdit(!edit)}>
            Modifica
          </button>
        </span>
      </div>
    </li>
  );
}
