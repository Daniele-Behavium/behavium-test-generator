"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Analisi, DomandaGenerata, EmailGenerata, InputTest, Problema, Scenario, SelezioneDimensione, Seniority } from "@/lib/types";
import { catalogo } from "@/lib/catalog";
import { assembla } from "@/lib/assembla";
import { validaTest } from "@/lib/regole";
import { Segmented, Badge, api, euro } from "@/components/ui";

const VUOTO: InputTest = {
  jobTitle: "",
  jd: "",
  focus: "",
  esclusioni: "",
  tipo: "inBasket",
  contesto: "recruiting",
  lingua: "it",
  settoreScenario: "diverso",
};
const BOZZA = "bh-tg-bozza";

type Item = EmailGenerata | DomandaGenerata;
type Fase = { id: string; label: string; stato: "attesa" | "in_corso" | "ok" | "errore"; dettaglio?: string };

export default function NuovoTest() {
  const router = useRouter();
  const [input, setInput] = useState<InputTest>(VUOTO);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [analisi, setAnalisi] = useState<Analisi | null>(null);
  const [selezione, setSelezione] = useState<SelezioneDimensione[]>([]);
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState("");
  const [fasi, setFasi] = useState<Fase[]>([]);
  const [costo, setCosto] = useState(0);
  const [modello, setModello] = useState("");

  useEffect(() => {
    try {
      const b = localStorage.getItem(BOZZA);
      if (b) setInput({ ...VUOTO, ...JSON.parse(b) });
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(BOZZA, JSON.stringify(input));
    } catch {}
  }, [input]);

  const set = <K extends keyof InputTest>(k: K, v: InputTest[K]) => setInput((p) => ({ ...p, [k]: v }));

  async function analizza() {
    setErrore("");
    if (!input.jobTitle.trim() || !input.jd.trim()) return setErrore("Job title e JD sono obbligatori.");
    setCaricamento(true);
    try {
      const r = await api<{ analisi: Analisi; costo: number; modello: string }>("/api/genera/analisi", { input: { ...input, seniority: undefined, durata: undefined } });
      setAnalisi(r.analisi);
      setSelezione(r.analisi.selezione);
      setInput((p) => ({ ...p, seniority: r.analisi.seniority, durata: r.analisi.durata }));
      setCosto(r.costo);
      setModello(r.modello);
      setStep(2);
    } catch (e) {
      setErrore(String((e as Error).message));
    } finally {
      setCaricamento(false);
    }
  }

  async function genera() {
    if (!analisi) return;
    setErrore("");
    const totPesi = selezione.reduce((a, d) => a + d.peso, 0);
    if (!selezione.length) return setErrore("Seleziona almeno una dimensione.");
    if (selezione.some((d) => !d.sottoDimensioni.length)) return setErrore("Ogni dimensione selezionata deve avere almeno una sotto-dimensione.");
    if (totPesi <= 0) return setErrore("I pesi devono essere maggiori di zero.");
    const an: Analisi = { ...analisi, selezione, seniority: input.seniority!, durata: input.durata! };
    setStep(3);
    let tot = costo;
    const aggiorna = (id: string, patch: Partial<Fase>) => setFasi((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    setFasi([{ id: "piano", label: "Scenario e piano degli elementi", stato: "in_corso" }]);
    try {
      // 1. Piano
      const p = await api<{ scenario: Scenario; problemi: Problema[]; costo: number }>("/api/genera/piano", { input, analisi: an });
      tot += p.costo;
      const errPiano = p.problemi.filter((x) => x.livello === "errore");
      aggiorna("piano", { stato: "ok", dettaglio: `${p.scenario.piano.length} elementi · ${p.scenario.settoreScenario}${errPiano.length ? ` · ${errPiano.length} problemi residui` : ""}` });

      // 2. Elementi a lotti, in parallelo
      const refs = p.scenario.piano.map((x) => x.ref);
      const dim = input.tipo === "inBasket" ? 3 : 5;
      const lotti: string[][] = [];
      for (let i = 0; i < refs.length; i += dim) lotti.push(refs.slice(i, i + dim));
      setFasi((fs) => [
        ...fs,
        ...lotti.map((l, i) => ({ id: `lotto${i}`, label: `${input.tipo === "inBasket" ? "Email" : "Domande"} ${l[0]}-${l[l.length - 1]}`, stato: "attesa" as const })),
        { id: "controllo", label: "Controllo regole e correzioni", stato: "attesa" },
        { id: "salva", label: "Salvataggio", stato: "attesa" },
      ]);
      const items: Item[] = [];
      const eseguiLotto = async (l: string[], i: number) => {
        aggiorna(`lotto${i}`, { stato: "in_corso" });
        for (let t = 0; t < 2; t++) {
          try {
            const r = await api<{ items: Item[]; costo: number }>("/api/genera/items", { input, analisi: an, scenario: p.scenario, refs: l });
            tot += r.costo;
            items.push(...r.items);
            const mancanti = l.filter((ref) => !r.items.some((x) => x.ref === ref));
            if (mancanti.length && t === 0) {
              l = mancanti;
              continue;
            }
            aggiorna(`lotto${i}`, { stato: "ok" });
            return;
          } catch (e) {
            if (t === 1) {
              aggiorna(`lotto${i}`, { stato: "errore", dettaglio: (e as Error).message });
              throw e;
            }
          }
        }
      };
      const coda = lotti.map((l, i) => () => eseguiLotto(l, i));
      await Promise.all(Array.from({ length: Math.min(3, coda.length) }, async () => {
        while (coda.length) await coda.shift()!();
      }));

      // 3. Controllo + una tornata di correzione sugli elementi con errori
      aggiorna("controllo", { stato: "in_corso" });
      let test = assembla(input, an, p.scenario, items);
      let problemi = validaTest(test);
      const daCorreggere = Array.from(new Set(problemi.filter((x) => x.livello === "errore" && x.ref).map((x) => x.ref!)));
      if (daCorreggere.length) {
        const note = problemi.filter((x) => x.ref && daCorreggere.includes(x.ref)).map((x) => `- ${x.ref}: ${x.messaggio}`).join("\n");
        const r = await api<{ items: Item[]; costo: number }>("/api/genera/items", { input, analisi: an, scenario: p.scenario, refs: daCorreggere, note: `Correggi questi errori:\n${note}` });
        tot += r.costo;
        for (const nuovo of r.items) {
          const i = items.findIndex((x) => x.ref === nuovo.ref);
          if (i >= 0) items[i] = nuovo;
        }
        test = assembla(input, an, p.scenario, items);
        problemi = validaTest(test);
      }
      const nErr = problemi.filter((x) => x.livello === "errore").length;
      aggiorna("controllo", { stato: "ok", dettaglio: nErr ? `${nErr} errori da rivedere` : `nessun errore · ${problemi.length} avvisi` });

      // 4. Salvataggio
      aggiorna("salva", { stato: "in_corso" });
      const s = await api<{ id: string }>("/api/tests", { input, analisi: an, scenario: p.scenario, items, modello, costo: tot });
      aggiorna("salva", { stato: "ok" });
      setCosto(tot);
      try {
        localStorage.removeItem(BOZZA);
      } catch {}
      router.push(`/test/${s.id}`);
    } catch (e) {
      setErrore(String((e as Error).message));
      setFasi((fs) => fs.map((f) => (f.stato === "in_corso" ? { ...f, stato: "errore" } : f)));
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Nuovo test · passo {step} di 3</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {step === 1 ? "Descrivi il ruolo" : step === 2 ? "Controlla cosa misurare" : "Generazione in corso"}
          </h1>
        </div>
        {costo > 0 && <span className="font-mono text-xs text-n-400">costo finora {euro(costo)}</span>}
      </div>

      {errore && <div className="mb-6 rounded-[4px] border border-err/30 bg-err-50 px-4 py-3 text-sm text-err">{errore}</div>}

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card space-y-5 p-6">
            <div>
              <label className="label">Job title *</label>
              <input className="field" value={input.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="Es. HR Generalist" />
            </div>
            <div>
              <label className="label">Job description *</label>
              <textarea className="field min-h-64 font-[inherit]" value={input.jd} onChange={(e) => set("jd", e.target.value)} placeholder="Incolla qui la JD completa" />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="label">Su cosa focalizzarsi</label>
                <textarea className="field min-h-24" value={input.focus} onChange={(e) => set("focus", e.target.value)} placeholder="Es. mi interessa che si testi la gestione delle priorità" />
                <p className="hint">Le sotto-dimensioni collegate avranno più peso.</p>
              </div>
              <div>
                <label className="label">Cosa NON testare</label>
                <textarea className="field min-h-24" value={input.esclusioni} onChange={(e) => set("esclusioni", e.target.value)} placeholder="Es. non testare la lingua inglese anche se è nella JD" />
                <p className="hint">Vincolante, anche se la JD lo cita.</p>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            <div className="card space-y-5 p-5">
              <div>
                <label className="label">Tipo di test</label>
                <Segmented value={input.tipo} onChange={(v) => set("tipo", v)} options={[{ value: "inBasket", label: "In-basket" }, { value: "situational", label: "Situazionale" }]} />
              </div>
              <div>
                <label className="label">Contesto d&apos;uso</label>
                <Segmented value={input.contesto} onChange={(v) => set("contesto", v)} options={[{ value: "recruiting", label: "Recruiting" }, { value: "workforce", label: "Workforce" }]} />
              </div>
              <div>
                <label className="label">Lingua del test</label>
                <Segmented value={input.lingua} onChange={(v) => set("lingua", v)} options={[{ value: "it", label: "Italiano" }, { value: "en", label: "English" }]} />
              </div>
              <div>
                <label className="label">Settore dello scenario</label>
                <Segmented value={input.settoreScenario} onChange={(v) => set("settoreScenario", v)} options={[{ value: "diverso", label: "Diverso dalla JD" }, { value: "stesso", label: "Stesso della JD" }]} />
                <p className="hint">Il framework consiglia un settore diverso, per non misurare l&apos;abitudine al proprio settore.</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-n-400">Seniority e durata le propone l&apos;AI leggendo la JD; le correggi al passo successivo.</p>
            <button className="btn-primary w-full" onClick={analizza} disabled={caricamento}>
              {caricamento ? "Analisi della JD in corso…" : "Analizza la JD"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && analisi && (
        <Revisione
          input={input}
          setInput={setInput}
          analisi={analisi}
          selezione={selezione}
          setSelezione={setSelezione}
          indietro={() => setStep(1)}
          genera={genera}
        />
      )}

      {step === 3 && (
        <div className="card max-w-xl p-6">
          <ul className="space-y-3">
            {fasi.map((f) => (
              <li key={f.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 grid h-2.5 w-2.5 shrink-0 place-items-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-[2px] ${f.stato === "ok" ? "bg-a-500" : f.stato === "in_corso" ? "animate-pulse bg-info" : f.stato === "errore" ? "bg-err" : "bg-n-100"}`}
                  />
                </span>
                <span>
                  <span className={f.stato === "attesa" ? "text-n-300" : "text-n-900"}>{f.label}</span>
                  {f.dettaglio && <span className="block font-mono text-xs text-n-400">{f.dettaglio}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-n-400">Ci vogliono alcuni minuti. Puoi lasciare la pagina aperta e fare altro.</p>
          {errore && (
            <button className="btn-ghost mt-4" onClick={() => setStep(2)}>
              Torna alla revisione
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Revisione({
  input,
  setInput,
  analisi,
  selezione,
  setSelezione,
  indietro,
  genera,
}: {
  input: InputTest;
  setInput: React.Dispatch<React.SetStateAction<InputTest>>;
  analisi: Analisi;
  selezione: SelezioneDimensione[];
  setSelezione: React.Dispatch<React.SetStateAction<SelezioneDimensione[]>>;
  indietro: () => void;
  genera: () => void;
}) {
  const totPesi = useMemo(() => selezione.reduce((a, d) => a + (Number(d.peso) || 0), 0), [selezione]);
  const nSub = selezione.reduce((a, d) => a + d.sottoDimensioni.length, 0);
  const motivazioniAI = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of analisi.selezione) {
      m.set(d.dimensioneId, d.motivazione);
      for (const s of d.sottoDimensioni) m.set(s.id, s.motivazione);
    }
    return m;
  }, [analisi]);

  const toggleDim = (id: string) =>
    setSelezione((sel) => (sel.some((d) => d.dimensioneId === id) ? sel.filter((d) => d.dimensioneId !== id) : [...sel, { dimensioneId: id, peso: 10, motivazione: "Aggiunta manualmente", sottoDimensioni: [] }]));
  const toggleSub = (dimId: string, subId: string) =>
    setSelezione((sel) =>
      sel.map((d) =>
        d.dimensioneId !== dimId
          ? d
          : {
              ...d,
              sottoDimensioni: d.sottoDimensioni.some((s) => s.id === subId)
                ? d.sottoDimensioni.filter((s) => s.id !== subId)
                : [...d.sottoDimensioni, { id: subId, motivazione: motivazioniAI.get(subId) ?? "Aggiunta manualmente" }],
            }
      )
    );
  const setPeso = (id: string, peso: number) => setSelezione((sel) => sel.map((d) => (d.dimensioneId === id ? { ...d, peso } : d)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {(analisi.fuoriCatalogo.length > 0 || analisi.esclusioniApplicate.length > 0) && (
          <div className="space-y-2">
            {analisi.fuoriCatalogo.map((f, i) => (
              <div key={i} className="rounded-[4px] border border-warn/30 bg-warn-50 px-4 py-3 text-sm text-n-800">
                <span className="font-medium text-warn">Non coperto dal catalogo:</span> {f.richiesta}. <span className="text-n-600">{f.nota}</span>
              </div>
            ))}
            {analisi.esclusioniApplicate.length > 0 && (
              <div className="rounded-[4px] border border-n-100 bg-white px-4 py-3 text-sm text-n-600">
                <span className="font-medium text-n-900">Esclusioni applicate:</span> {analisi.esclusioniApplicate.join("; ")}
              </div>
            )}
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between border-b border-n-50 px-5 py-3">
            <p className="text-sm font-medium">Dimensioni e sotto-dimensioni</p>
            <span className={`font-mono text-xs ${totPesi === 100 ? "text-n-400" : "text-warn"}`}>
              {nSub} sotto-dim · pesi {totPesi}/100
            </span>
          </div>
          <ul className="divide-y divide-n-50">
            {catalogo.dimensioni.map((d) => {
              const sel = selezione.find((x) => x.dimensioneId === d.id);
              return (
                <li key={d.id} className={`px-5 py-4 ${sel ? "" : "opacity-70"}`}>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="h-4 w-4 accent-a-500" checked={!!sel} onChange={() => toggleDim(d.id)} />
                    <span className="font-medium">{d.nome}</span>
                    <Badge tono={d.tipoSkill === "ai" ? "ok" : "info"}>{d.tipoSkill === "ai" ? "AI skill" : "Soft skill"}</Badge>
                    {sel && (
                      <label className="ml-auto flex items-center gap-2 text-xs text-n-400">
                        peso
                        <input type="number" min={0} max={100} className="field w-20 py-1 text-right font-mono" value={sel.peso} onChange={(e) => setPeso(d.id, Number(e.target.value))} />
                      </label>
                    )}
                  </div>
                  {sel && motivazioniAI.get(d.id) && <p className="mt-1 ml-7 text-xs text-n-400">{motivazioniAI.get(d.id)}</p>}
                  {sel && (
                    <ul className="mt-3 ml-7 space-y-2">
                      {d.sottoDimensioni.map((s) => {
                        const on = sel.sottoDimensioni.some((x) => x.id === s.id);
                        return (
                          <li key={s.id}>
                            <label className="flex cursor-pointer items-start gap-2.5">
                              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-a-500" checked={on} onChange={() => toggleSub(d.id, s.id)} />
                              <span className="text-sm">
                                <span className={on ? "font-medium text-n-900" : "text-n-600"}>{s.nome}</span>
                                {on && motivazioniAI.get(s.id) && <span className="block text-xs text-a-700">{motivazioniAI.get(s.id)}</span>}
                                {!on && <span className="block text-xs text-n-300">{s.declaratoria}</span>}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="space-y-5">
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">Seniority</label>
            <select className="field" value={input.seniority} onChange={(e) => setInput((p) => ({ ...p, seniority: e.target.value as Seniority }))}>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
            <p className="hint">{analisi.motivazioneSeniority}</p>
          </div>
          <div>
            <label className="label">Durata (minuti)</label>
            <input type="number" className="field font-mono" value={input.durata} onChange={(e) => setInput((p) => ({ ...p, durata: Number(e.target.value) }))} />
            <p className="hint">{analisi.motivazioneDurata}</p>
          </div>
        </div>
        <div className="card p-5">
          <p className="eyebrow mb-2">Competenze rilevate nella JD</p>
          <ul className="space-y-2">
            {analisi.competenzeRilevate.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{c.nome}</span>
                <span className="block text-xs text-n-400 italic">“{c.fonteJD}”</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={indietro}>
            Indietro
          </button>
          <button className="btn-primary flex-1" onClick={genera}>
            Genera il test
          </button>
        </div>
      </div>
    </div>
  );
}
