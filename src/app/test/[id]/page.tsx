"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import type { DomandaGenerata, EmailGenerata, Feedback, RecordTest, TestGenerato, TipoTrappola } from "@/lib/types";
import { getDimensione, getSottoDimensione } from "@/lib/catalog";
import { versoStrapi } from "@/lib/strapi-export";
import { domandaVuota, emailVuota, nuovoRef } from "@/lib/modifica-test";
import { etichettaValutazione } from "@/lib/valutazioni";
import { Md, SubChip, Badge, Segmented, api, euro } from "@/components/ui";
import { BottoneIcona, CATEGORIE as NOMI_CAT, EditorDomanda, EditorEmail, IconaCestino, IconaMatita, SceltaSottoDimensioni, TestoModificabile, TRAPPOLE } from "@/components/Editor";

/** Contesto condiviso dalle schede degli elementi. */
interface Ctx {
  testId: string;
  test: TestGenerato;
  subDisponibili: string[];
  personaggi: string[];
  salvaTest: (t: TestGenerato) => Promise<void>;
  ricarica: () => void;
}

/** Sostituisce (o elimina, con null) un elemento del test. */
function conElemento(t: TestGenerato, ref: string, nuovo: EmailGenerata | DomandaGenerata | null): TestGenerato {
  if (t.tipo === "inBasket") return { ...t, email: t.email.flatMap((e) => (e.ref !== ref ? [e] : nuovo ? [nuovo as EmailGenerata] : [])) };
  return { ...t, blocchi: t.blocchi.map((b) => ({ ...b, domande: b.domande.flatMap((d) => (d.ref !== ref ? [d] : nuovo ? [nuovo as DomandaGenerata] : [])) })) };
}

export default function PaginaTest({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rec, setRec] = useState<RecordTest | null>(null);
  const [fb, setFb] = useState<Feedback[]>([]);
  const [errore, setErrore] = useState("");
  const [tab, setTab] = useState<"elementi" | "istruzioni" | "copertura">("elementi");
  const [word, setWord] = useState(false);

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
  async function salvaTest(nuovo: TestGenerato) {
    await api(`/api/tests/${id}`, { test: nuovo }, "PATCH");
    await carica();
  }
  function scaricaBlob(nome: string, blob: Blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
  }
  const scarica = (nome: string, dati: unknown) => scaricaBlob(nome, new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" }));
  async function scaricaWord() {
    setWord(true);
    try {
      const { testInWord } = await import("@/lib/esporta-docx");
      scaricaBlob(`${slug}.docx`, await testInWord(t));
    } catch (e) {
      setErrore("Errore nella creazione del file Word: " + (e as Error).message);
    } finally {
      setWord(false);
    }
  }
  const slug = t.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  const ctx: Ctx = {
    testId: id,
    test: t,
    subDisponibili: t.dimensioni.flatMap((d) => d.sottoDimensioni.map((s) => s.id)),
    personaggi: t.personaggi.map((p) => p.nome),
    salvaTest,
    ricarica: carica,
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {t.tipo === "inBasket" ? "In-basket" : "Situazionale"} · {rec.autore || "anonimo"} · {new Date(rec.created_at).toLocaleString("it-IT")}
          </p>
          <TestoModificabile riga valore={t.nome} onSalva={(nome) => salvaTest({ ...t, nome })}>
            <h1 className="mt-1 pr-8 text-2xl font-semibold tracking-tight">{t.nome}</h1>
          </TestoModificabile>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tono="dark">{t.ruoloTarget}</Badge>
            <Badge>{t.seniority}</Badge>
            <Badge>{t.durata} min</Badge>
            <Badge>{t.contesto}</Badge>
            <Badge>{t.lingua.toUpperCase()}</Badge>
            <Badge>scenario: {t.settoreScenario}</Badge>
            <Badge tono="dark">{euro(Number(rec.costo) + Number(rec.costo_modifiche ?? 0))}</Badge>
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
          <button className="btn-dark btn-sm" disabled={word} onClick={scaricaWord} title="Documento Word con i campi da caricare a mano in Strapi">
            {word ? "Preparo…" : "Scarica Word"}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => scarica(`${slug}.strapi.json`, versoStrapi(t))} title="Formato per l'import in Strapi, senza sotto-dimensioni e motivazioni">
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
                        <CardItem key={d.ref} ctx={ctx} item={d} tipo="situational" feedback={fb.filter((f) => f.item_ref === d.ref)} />
                      ))}
                      <AggiungiElemento ctx={ctx} blocco={b.titolo} />
                    </div>
                  ))
                : (
                  <>
                    {t.email.map((e) => <CardItem key={e.ref} ctx={ctx} item={e} tipo="inBasket" feedback={fb.filter((f) => f.item_ref === e.ref)} />)}
                    <AggiungiElemento ctx={ctx} />
                  </>
                )}
            </div>
          )}

          {tab === "istruzioni" && (
            <div className="space-y-4">
              <div className="card p-5">
                <TestoModificabile valore={t.istruzioni} onSalva={(istruzioni) => salvaTest({ ...t, istruzioni })}>
                  <p className="eyebrow mb-2">Istruzioni del test (mostrate al candidato per tutta la prova)</p>
                  <Md>{t.istruzioni}</Md>
                </TestoModificabile>
              </div>
              <div className="card p-5">
                <TestoModificabile valore={t.introduzioneTecnica} onSalva={(introduzioneTecnica) => salvaTest({ ...t, introduzioneTecnica })}>
                  <p className="eyebrow mb-2">Introduzione tecnica (mostrata una volta, prima dell&apos;inizio)</p>
                  <Md>{t.introduzioneTecnica}</Md>
                </TestoModificabile>
              </div>
              {t.personaggi.length > 0 && (
                <div className="card p-5">
                  <p className="eyebrow mb-2">Personaggi</p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {t.personaggi.map((p) => (
                      <li key={p.nome} className="text-sm">
                        <span className="font-medium">{p.nome}</span> <span className="text-n-400">· {p.ruolo}</span>
                        <span className="block font-mono text-[13px] text-n-300">{p.relazione}</span>
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
            <p className="eyebrow mb-2">Costo del test</p>
            <p className="font-mono text-2xl font-medium text-n-900">{euro(Number(rec.costo) + Number(rec.costo_modifiche ?? 0))}</p>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-0.5 font-mono text-xs text-n-600">
              <dt>generazione</dt>
              <dd className="text-right">{euro(rec.costo)}</dd>
              <dt>modifiche AI</dt>
              <dd className="text-right">{euro(rec.costo_modifiche ?? 0)}</dd>
            </dl>
            <p className="hint">Costo reale addebitato da OpenRouter, in dollari. Le modifiche a mano non costano nulla.</p>
          </div>
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
          <div className="font-mono text-[13px] leading-5 text-n-400">
            <p>modello: {rec.modello}</p>
            <p>catalogo: {rec.catalogo_versione}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CardItem({ ctx, item, tipo, feedback }: { ctx: Ctx; item: EmailGenerata | DomandaGenerata; tipo: "inBasket" | "situational"; feedback: Feedback[] }) {
  const e = tipo === "inBasket" ? (item as EmailGenerata) : null;
  const d = tipo === "situational" ? (item as DomandaGenerata) : null;
  const [interno, setInterno] = useState(false);
  const [modifica, setModifica] = useState(false);
  const [elimina, setElimina] = useState(false);
  const [errore, setErrore] = useState("");

  async function salva(nuovo: EmailGenerata | DomandaGenerata) {
    await ctx.salvaTest(conElemento(ctx.test, item.ref, nuovo));
    setModifica(false);
  }
  async function confermaElimina() {
    try {
      await ctx.salvaTest(conElemento(ctx.test, item.ref, null));
    } catch (x) {
      setErrore((x as Error).message);
    }
  }

  if (modifica)
    return (
      <article className="card overflow-hidden ring-2 ring-a-500/40">
        <div className="border-b border-n-50 bg-n-25 px-5 py-3 text-sm">
          <span className="font-mono text-xs font-medium text-n-900">{item.ref}</span> <span className="text-n-400">in modifica</span>
        </div>
        {e ? (
          <EditorEmail valore={e} subDisponibili={ctx.subDisponibili} personaggi={ctx.personaggi} onSalva={salva} onAnnulla={() => setModifica(false)} />
        ) : (
          <EditorDomanda valore={d!} subDisponibili={ctx.subDisponibili} onSalva={salva} onAnnulla={() => setModifica(false)} />
        )}
      </article>
    );

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
          <span className="flex">
            <BottoneIcona titolo={`Modifica ${item.ref}`} onClick={() => setModifica(true)}>
              <IconaMatita />
            </BottoneIcona>
            <BottoneIcona titolo={`Elimina ${item.ref}`} pericolo onClick={() => setElimina(true)}>
              <IconaCestino />
            </BottoneIcona>
          </span>
        </div>
        {elimina && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[4px] border border-err/30 bg-err-50 px-3 py-2 text-sm">
            <span className="text-n-800">Eliminare {item.ref}? Non si può annullare.</span>
            <button className="btn-sm btn rounded-[4px] bg-err text-white" onClick={confermaElimina}>
              Elimina
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setElimina(false)}>
              Annulla
            </button>
            {errore && <span className="text-xs text-err">{errore}</span>}
          </div>
        )}
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
                    {interno && <Badge tono={o.valutazione === "migliore" ? "ok" : o.valutazione === "da_evitare" ? "err" : o.valutazione === "discreta" ? "warn" : "neutro"}>{etichettaValutazione(o.valutazione)}</Badge>}
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

      <FeedbackItem testId={ctx.testId} itemRef={item.ref} feedback={feedback} ricarica={ctx.ricarica} />
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
          <span className="font-mono text-[13px] text-n-400">{f.autore}</span> {f.commento && <span className="text-n-800">{f.commento}</span>}
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
          <button className="btn-dark btn-sm" disabled={!!busy} onClick={rigenera} title="L'AI riscrive questo elemento tenendo conto dei feedback. Senza commenti lo migliora in generale.">
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
              <th key={it.ref} className="px-1.5 py-2 text-center font-mono text-[13px] font-normal text-n-400">
                {it.ref}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-mono text-[13px] font-normal text-n-400">tot</th>
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

/** Aggiunta di un'email o di una domanda: scritta dall'AI su indicazione, oppure a mano. */
function AggiungiElemento({ ctx, blocco }: { ctx: Ctx; blocco?: string }) {
  const t = ctx.test;
  const inBasket = t.tipo === "inBasket";
  const nome = inBasket ? "email" : "domanda";
  const [aperto, setAperto] = useState(false);
  const [modo, setModo] = useState<"ai" | "mano">("ai");
  const ultimoRitardo = Math.max(0, ...t.email.map((e) => e.ritardo));
  const [idea, setIdea] = useState("");
  const [subs, setSubs] = useState<string[]>([]);
  const [trappola, setTrappola] = useState<TipoTrappola>("nessuna");
  const [ritardo, setRitardo] = useState(Math.min(ultimoRitardo + 5, Math.round(t.durata * 0.75)));
  const [critica, setCritica] = useState(false);
  const [aScelta, setAScelta] = useState(true);
  const [outputAI, setOutputAI] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState("");

  if (!aperto)
    return (
      <button className="w-full rounded-[4px] border border-dashed border-n-200 py-3 text-sm text-n-600 transition-colors hover:border-a-500 hover:text-a-700" onClick={() => setAperto(true)}>
        + Aggiungi {nome}
        {blocco ? ` al blocco "${blocco}"` : ""}
      </button>
    );

  const ref = nuovoRef(t);
  async function generaConAI() {
    if (!subs.length) return setErrore("Scegli almeno una sotto-dimensione");
    setBusy(true);
    setErrore("");
    try {
      await api(`/api/tests/${ctx.testId}/aggiungi`, inBasket ? { idea, sottoDimensioni: subs, trappola, ritardo, critica } : { idea, sottoDimensioni: subs, trappola, blocco, rispostaAScelta: aScelta, conOutputAI: outputAI });
      setAperto(false);
      setIdea("");
      setSubs([]);
      ctx.ricarica();
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function salvaManuale(nuovo: EmailGenerata | DomandaGenerata) {
    const agg: TestGenerato = inBasket
      ? { ...t, email: [...t.email, nuovo as EmailGenerata] }
      : { ...t, blocchi: t.blocchi.map((b) => (b.titolo === blocco ? { ...b, domande: [...b.domande, nuovo as DomandaGenerata] } : b)) };
    await ctx.salvaTest(agg);
    setAperto(false);
  }
  const candidato = t.email[0]?.destinatario ?? "";

  return (
    <div className="card overflow-hidden ring-2 ring-a-500/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-n-50 bg-n-25 px-5 py-3">
        <span className="text-sm">
          <span className="font-mono text-xs font-medium text-n-900">{ref}</span> <span className="text-n-600">nuova {nome}</span>
        </span>
        <Segmented
          value={modo}
          onChange={setModo}
          options={[
            { value: "ai", label: "Scrive l'AI" },
            { value: "mano", label: "Scrivo io" },
          ]}
        />
      </div>
      {modo === "mano" ? (
        inBasket ? (
          <EditorEmail valore={emailVuota(ref, ritardo, candidato)} subDisponibili={ctx.subDisponibili} personaggi={ctx.personaggi} onSalva={salvaManuale} onAnnulla={() => setAperto(false)} />
        ) : (
          <EditorDomanda valore={domandaVuota(ref, blocco!)} subDisponibili={ctx.subDisponibili} onSalva={salvaManuale} onAnnulla={() => setAperto(false)} />
        )
      ) : (
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="label">Cosa deve contenere</span>
            <textarea
              className="field"
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={inBasket ? "Es. un fornitore chiede di anticipare una consegna con un prezzo più alto, il budget è già al limite" : "Es. l'AI propone una graduatoria dei candidati usando dati sanitari"}
            />
            <span className="hint">Facoltativo. Se lo lasci vuoto l&apos;AI sceglie una situazione coerente con lo scenario.</span>
          </label>
          <div>
            <span className="label">Sotto-dimensioni da testare</span>
            <SceltaSottoDimensioni disponibili={ctx.subDisponibili} valore={subs} onChange={setSubs} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">Trappola</span>
              <select className="field" value={trappola} onChange={(e) => setTrappola(e.target.value as TipoTrappola)}>
                <option value="nessuna">Nessuna</option>
                {Object.entries(TRAPPOLE).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {inBasket ? (
              <>
                <label className="block">
                  <span className="label">Arrivo (minuti dall&apos;inizio)</span>
                  <input className="field" type="number" min={0} value={ritardo} onChange={(e) => setRitardo(Number(e.target.value))} />
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={critica} onChange={(e) => setCritica(e.target.checked)} />
                  Email critica
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="label">Tipo di risposta</span>
                  <select className="field" value={aScelta ? "s" : "a"} onChange={(e) => setAScelta(e.target.value === "s")}>
                    <option value="s">A scelta</option>
                    <option value="a">Aperta</option>
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={outputAI} onChange={(e) => setOutputAI(e.target.checked)} />
                  Con output AI da valutare
                </label>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button className="btn-primary btn-sm" disabled={busy} onClick={generaConAI}>
              {busy ? "Scrivo… (circa 1 minuto)" : `Genera ${nome}`}
            </button>
            <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setAperto(false)}>
              Annulla
            </button>
            <span className="hint mt-0">Costo stimato circa $0,10, sommato alle modifiche AI.</span>
            {errore && <span className="text-xs text-err">{errore}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
