"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import type { DomandaGenerata, EmailGenerata, Feedback, RecordTest } from "@/lib/types";
import { getDimensione, getSottoDimensione } from "@/lib/catalog";
import { versoStrapi } from "@/lib/strapi-export";
import { Md, SubChip, Badge, api, euro } from "@/components/ui";

const NOMI_CAT: Record<string, string> = {
  strategicDeadline: "Scadenza strategica",
  urgentOperational: "Urgenza operativa",
  personalEmotional: "Personale/emotiva",
  externalComplaint: "Reclamo esterno",
  numericReport: "Dati/report",
  agendaOverlap: "Agenda sovrapposta",
  other: "Altro",
};

export default function PaginaTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rec, setRec] = useState<RecordTest | null>(null);
  const [fb, setFb] = useState<Feedback[]>([]);
  const [errore, setErrore] = useState("");
  const [tab, setTab] = useState<"elementi" | "istruzioni" | "copertura">("elementi");

  const carica = useCallback(async () => {
    try {
      const [t, f] = await Promise.all([api<RecordTest>(`/api/tests/${id}`), api<Feedback[]>(`/api/tests/${id}/feedback`)]);
      setRec(t);
      setFb(f);
    } catch (e) {
      setErrore((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    carica();
  }, [carica]);

  const items: (EmailGenerata | DomandaGenerata)[] = useMemo(
    () => (!rec ? [] : rec.test.tipo === "inBasket" ? rec.test.email : rec.test.blocchi.flatMap((b) => b.domande)),
    [rec]
  );

  if (errore) return <p className="text-err">{errore}</p>;
  if (!rec) return <p className="text-sm text-n-400">Caricamento…</p>;
  const t = rec.test;
  const errori = rec.problemi.filter((p) => p.livello === "errore");
  const avvisi = rec.problemi.filter((p) => p.livello === "avviso");

  async function setStato(stato: RecordTest["stato"]) {
    await api(`/api/tests/${id}`, { stato }, "PATCH");
    carica();
  }
  function scarica(nome: string, dati: unknown) {
    const blob = new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
  }
  const slug = t.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {t.tipo === "inBasket" ? "In-basket" : "Situazionale"} · {rec.autore || "anonimo"} · {new Date(rec.created_at).toLocaleString("it-IT")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.nome}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tono="dark">{t.ruoloTarget}</Badge>
            <Badge>{t.seniority}</Badge>
            <Badge>{t.durata} min</Badge>
            <Badge>{t.contesto}</Badge>
            <Badge>{t.lingua.toUpperCase()}</Badge>
            <Badge>scenario: {t.settoreScenario}</Badge>
            <Badge tono={rec.stato === "approvato" ? "ok" : rec.stato === "scartato" ? "err" : "warn"}>{rec.stato}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {rec.stato !== "approvato" && (
            <button className="btn-primary btn-sm" onClick={() => setStato("approvato")} title="I test approvati diventano esempi di riferimento per le generazioni future">
              Approva
            </button>
          )}
          {rec.stato !== "scartato" && (
            <button className="btn-ghost btn-sm" onClick={() => setStato("scartato")}>
              Scarta
            </button>
          )}
          {rec.stato !== "bozza" && (
            <button className="btn-ghost btn-sm" onClick={() => setStato("bozza")}>
              Riporta in bozza
            </button>
          )}
          <button className="btn-dark btn-sm" onClick={() => scarica(`${slug}.strapi.json`, versoStrapi(t))} title="Formato per l'import in Strapi, senza sotto-dimensioni e motivazioni">
            JSON per Strapi
          </button>
          <button className="btn-ghost btn-sm" onClick={() => scarica(`${slug}.completo.json`, rec)}>
            JSON completo
          </button>
        </div>
      </div>

      {(errori.length > 0 || avvisi.length > 0) && (
        <div className="mb-6 grid gap-2 md:grid-cols-2">
          {errori.length > 0 && (
            <div className="rounded-[4px] border border-err/30 bg-err-50 px-4 py-3 text-sm">
              <p className="mb-1 font-medium text-err">{errori.length} errori rispetto alle regole del framework</p>
              <ul className="space-y-0.5 text-n-800">
                {errori.map((p, i) => (
                  <li key={i}>
                    {p.ref && <span className="font-mono text-xs">{p.ref} </span>}
                    {p.messaggio}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {avvisi.length > 0 && (
            <div className="rounded-[4px] border border-warn/30 bg-warn-50 px-4 py-3 text-sm">
              <p className="mb-1 font-medium text-warn">{avvisi.length} avvisi</p>
              <ul className="space-y-0.5 text-n-800">
                {avvisi.map((p, i) => (
                  <li key={i}>
                    {p.ref && <span className="font-mono text-xs">{p.ref} </span>}
                    {p.messaggio}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4 flex gap-1 border-b border-n-100">
            {(
              [
                ["elementi", `${t.tipo === "inBasket" ? "Email" : "Domande"} (${items.length})`],
                ["istruzioni", "Istruzioni e scenario"],
                ["copertura", "Copertura sotto-dimensioni"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-a-500 font-medium text-n-900" : "border-transparent text-n-400 hover:text-n-800"}`}>
                {l}
              </button>
            ))}
          </div>

          {tab === "elementi" && (
            <div className="space-y-4">
              {t.tipo === "situational"
                ? t.blocchi.map((b) => (
                    <div key={b.titolo} className="space-y-4">
                      <p className="eyebrow pt-2">Blocco · {b.titolo}</p>
                      {b.domande.map((d) => (
                        <CardItem key={d.ref} testId={id} item={d} tipo="situational" feedback={fb.filter((f) => f.item_ref === d.ref)} ricarica={carica} />
                      ))}
                    </div>
                  ))
                : t.email.map((e) => <CardItem key={e.ref} testId={id} item={e} tipo="inBasket" feedback={fb.filter((f) => f.item_ref === e.ref)} ricarica={carica} />)}
            </div>
          )}

          {tab === "istruzioni" && (
            <div className="space-y-4">
              <div className="card p-5">
                <p className="eyebrow mb-2">Istruzioni del test (mostrate al candidato per tutta la prova)</p>
                <Md>{t.istruzioni}</Md>
              </div>
              <div className="card p-5">
                <p className="eyebrow mb-2">Introduzione tecnica (mostrata una volta, prima dell&apos;inizio)</p>
                <Md>{t.introduzioneTecnica}</Md>
              </div>
              {t.personaggi.length > 0 && (
                <div className="card p-5">
                  <p className="eyebrow mb-2">Personaggi</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {t.personaggi.map((p) => (
                      <li key={p.nome} className="text-sm">
                        <span className="font-medium">{p.nome}</span> <span className="text-n-400">· {p.ruolo}</span>
                        <span className="block font-mono text-[11px] text-n-300">{p.relazione}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {tab === "copertura" && <Copertura rec={rec} items={items} />}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <p className="eyebrow mb-3">Dimensioni e pesi</p>
            <ul className="space-y-3">
              {t.dimensioni.map((d) => (
                <li key={d.dimensioneId}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{getDimensione(d.dimensioneId)?.nome ?? d.dimensioneId}</span>
                    <span className="font-mono text-xs text-n-400">{d.peso}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.sottoDimensioni.map((s) => (
                      <SubChip key={s.id} id={s.id} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <FeedbackGlobale testId={id} feedback={fb.filter((f) => !f.item_ref)} ricarica={carica} />
          <div className="font-mono text-[11px] leading-5 text-n-400">
            <p>modello: {rec.modello}</p>
            <p>costo generazione: {euro(rec.costo)}</p>
            <p>catalogo: {rec.catalogo_versione}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CardItem({
  testId,
  item,
  tipo,
  feedback,
  ricarica,
}: {
  testId: string;
  item: EmailGenerata | DomandaGenerata;
  tipo: "inBasket" | "situational";
  feedback: Feedback[];
  ricarica: () => void;
}) {
  const e = tipo === "inBasket" ? (item as EmailGenerata) : null;
  const d = tipo === "situational" ? (item as DomandaGenerata) : null;
  const [interno, setInterno] = useState(false);

  return (
    <article className="card overflow-hidden">
      {/* Cosa testa: in evidenza per gli psicologi */}
      <div className="border-b border-n-50 bg-n-25 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-xs font-medium text-n-900">{item.ref}</span>
          <span className="text-xs text-n-400">testa</span>
          {item.sottoDimensioni.map((s) => (
            <SubChip key={s} id={s} />
          ))}
          <span className="ml-auto flex flex-wrap gap-1">
            {e && <Badge>{NOMI_CAT[e.categoria]}</Badge>}
            {e && <Badge>T+{e.ritardo} min</Badge>}
            {e?.critica && <Badge tono="err">critica</Badge>}
            {d && <Badge>{d.rispostaAScelta ? "a scelta" : "aperta"}</Badge>}
            {d?.outputAISimulato && <Badge tono="info">output AI</Badge>}
            {item.contieneTrappola && <Badge tono="warn">trappola {item.tipoTrappola}</Badge>}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-n-600">{item.motivazione}</p>
      </div>

      <div className="px-5 py-4">
        {e && (
          <>
            <div className="mb-3 grid grid-cols-[64px_1fr] gap-y-0.5 text-sm">
              <span className="text-n-400">Da</span>
              <span>{e.mittente}</span>
              <span className="text-n-400">A</span>
              <span>{e.destinatario}</span>
              <span className="text-n-400">Oggetto</span>
              <span className="font-medium">{e.oggetto}</span>
            </div>
            <Md>{e.corpo}</Md>
          </>
        )}
        {d && (
          <>
            <Md>{d.testo}</Md>
            {d.outputAISimulato && (
              <div className="mt-3 rounded-[4px] border border-info/20 bg-info-50 p-4">
                <p className="eyebrow mb-1 text-info">Output AI simulato</p>
                <Md>{d.outputAISimulato}</Md>
              </div>
            )}
            {d.rispostaAScelta && (
              <ol className="mt-3 space-y-1.5">
                {d.opzioni.map((o, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="font-mono text-xs text-n-400">{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{o.testo}</span>
                    {interno && <Badge tono={o.valutazione === "migliore" ? "ok" : o.valutazione === "da_evitare" ? "err" : "neutro"}>{o.valutazione.replace("_", " ")}</Badge>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        <button className="mt-4 text-xs font-medium text-a-700 hover:underline" onClick={() => setInterno(!interno)}>
          {interno ? "Nascondi" : "Mostra"} chiavi di valutazione (uso interno)
        </button>
        {interno && (
          <div className="mt-2 space-y-3 rounded-[4px] border border-dashed border-n-200 p-4 text-sm">
            <div>
              <p className="eyebrow mb-1">Comportamento atteso</p>
              <Md>{item.comportamentoAtteso}</Md>
            </div>
            {item.contieneTrappola && (
              <div>
                <p className="eyebrow mb-1">Trappola · {item.tipoTrappola}</p>
                <Md>{item.descrizioneTrappola}</Md>
              </div>
            )}
          </div>
        )}
      </div>

      <FeedbackItem testId={testId} itemRef={item.ref} feedback={feedback} ricarica={ricarica} />
    </article>
  );
}

function ListaFeedback({ feedback }: { feedback: Feedback[] }) {
  if (!feedback.length) return null;
  return (
    <ul className="mb-3 space-y-1.5">
      {feedback.map((f) => (
        <li key={f.id} className="text-sm">
          <Badge tono={f.esito === "ok" ? "ok" : "warn"}>{f.esito === "ok" ? "ok" : "da rivedere"}</Badge>{" "}
          <span className="font-mono text-[11px] text-n-400">{f.autore}</span> {f.commento && <span className="text-n-800">{f.commento}</span>}
        </li>
      ))}
    </ul>
  );
}

function FeedbackItem({ testId, itemRef, feedback, ricarica }: { testId: string; itemRef: string; feedback: Feedback[]; ricarica: () => void }) {
  const [commento, setCommento] = useState("");
  const [busy, setBusy] = useState<"" | "invio" | "rigenera">("");
  const [err, setErr] = useState("");

  async function invia(esito: "ok" | "da_rivedere") {
    setBusy("invio");
    setErr("");
    try {
      await api(`/api/tests/${testId}/feedback`, { item_ref: itemRef, esito, commento });
      setCommento("");
      ricarica();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function rigenera() {
    const note = [...feedback.filter((f) => f.esito === "da_rivedere" && f.commento).map((f) => f.commento), commento].filter(Boolean).join("\n");
    setBusy("rigenera");
    setErr("");
    try {
      if (commento.trim()) await api(`/api/tests/${testId}/feedback`, { item_ref: itemRef, esito: "da_rivedere", commento });
      await api(`/api/tests/${testId}/rigenera`, { ref: itemRef, note });
      setCommento("");
      ricarica();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="border-t border-n-50 bg-white px-5 py-3">
      <ListaFeedback feedback={feedback} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="field py-1.5" placeholder={`Feedback su ${itemRef} (es. la trappola è troppo evidente)`} value={commento} onChange={(e) => setCommento(e.target.value)} />
        <div className="flex shrink-0 gap-1.5">
          <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => invia("ok")}>
            Ok
          </button>
          <button className="btn-ghost btn-sm" disabled={!!busy} onClick={() => invia("da_rivedere")}>
            Da rivedere
          </button>
          <button className="btn-dark btn-sm" disabled={!!busy || (!commento.trim() && !feedback.some((f) => f.esito === "da_rivedere"))} onClick={rigenera} title="Riscrive questo elemento tenendo conto dei feedback">
            {busy === "rigenera" ? "Riscrivo…" : "Rigenera"}
          </button>
        </div>
      </div>
      {err && <p className="mt-1 text-xs text-err">{err}</p>}
    </div>
  );
}

function FeedbackGlobale({ testId, feedback, ricarica }: { testId: string; feedback: Feedback[]; ricarica: () => void }) {
  const [commento, setCommento] = useState("");
  const [busy, setBusy] = useState(false);
  async function invia(esito: "ok" | "da_rivedere") {
    setBusy(true);
    await api(`/api/tests/${testId}/feedback`, { item_ref: null, esito, commento }).catch(() => {});
    setCommento("");
    setBusy(false);
    ricarica();
  }
  return (
    <div className="card p-5">
      <p className="eyebrow mb-2">Feedback sul test intero</p>
      <ListaFeedback feedback={feedback} />
      <textarea className="field min-h-20" placeholder="Es. scenario troppo lungo per un junior" value={commento} onChange={(e) => setCommento(e.target.value)} />
      <div className="mt-2 flex gap-1.5">
        <button className="btn-ghost btn-sm" disabled={busy} onClick={() => invia("ok")}>
          Ok
        </button>
        <button className="btn-ghost btn-sm" disabled={busy} onClick={() => invia("da_rivedere")}>
          Da rivedere
        </button>
      </div>
      <p className="hint">I commenti diventano proposte di regole nella pagina Regole apprese.</p>
    </div>
  );
}

function Copertura({ rec, items }: { rec: RecordTest; items: (EmailGenerata | DomandaGenerata)[] }) {
  const subs = rec.test.dimensioni.flatMap((d) => d.sottoDimensioni.map((s) => s.id));
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-n-100">
            <th className="px-4 py-2 text-left font-medium">Sotto-dimensione</th>
            {items.map((it) => (
              <th key={it.ref} className="px-1.5 py-2 text-center font-mono text-[11px] font-normal text-n-400">
                {it.ref}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-mono text-[11px] font-normal text-n-400">tot</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => {
            const n = items.filter((it) => it.sottoDimensioni.includes(s)).length;
            return (
              <tr key={s} className="border-b border-n-50">
                <td className="px-4 py-2">
                  <span className="block">{getSottoDimensione(s)?.sub.nome ?? s}</span>
                  <span className="text-xs text-n-400">{getSottoDimensione(s)?.dim.nome}</span>
                </td>
                {items.map((it) => (
                  <td key={it.ref} className="px-1.5 text-center">
                    {it.sottoDimensioni.includes(s) ? <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-a-500" /> : <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-n-50" />}
                  </td>
                ))}
                <td className={`px-3 text-right font-mono text-xs ${n === 0 ? "text-err" : n === 1 ? "text-warn" : "text-n-600"}`}>{n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
