"use client";
// Modifica manuale di titolo, istruzioni ed elementi del test.
import { useRef, useState } from "react";
import type { CategoriaEmail, DomandaGenerata, EmailGenerata, OpzioneRisposta, TipoTrappola } from "@/lib/types";
import { getSottoDimensione } from "@/lib/catalog";
import { DESCR_TRAPPOLE } from "@/lib/regole";
import { Md } from "@/components/ui";
import { VALUTAZIONI, etichettaValutazione } from "@/lib/valutazioni";

export const CATEGORIE: Record<CategoriaEmail, string> = {
  strategicDeadline: "Scadenza strategica",
  urgentOperational: "Urgenza operativa",
  personalEmotional: "Personale/emotiva",
  externalComplaint: "Reclamo esterno",
  numericReport: "Dati/report",
  agendaOverlap: "Agenda sovrapposta",
  other: "Altro",
};
export const TRAPPOLE = Object.fromEntries(
  Object.entries(DESCR_TRAPPOLE).filter(([k]) => k !== "nessuna").map(([k, v]) => [k, `${k} · ${v}`])
) as Record<Exclude<TipoTrappola, "nessuna">, string>;

// ---------- icone ----------
export function IconaMatita() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" strokeLinejoin="round" />
    </svg>
  );
}
export function IconaCestino() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" strokeLinejoin="round" />
    </svg>
  );
}
export function BottoneIcona({ titolo, onClick, children, pericolo }: { titolo: string; onClick: () => void; children: React.ReactNode; pericolo?: boolean }) {
  return (
    <button type="button" title={titolo} aria-label={titolo} onClick={onClick} className={`rounded-[3px] p-1.5 text-n-400 transition-colors hover:bg-n-50 ${pericolo ? "hover:text-err" : "hover:text-n-900"}`}>
      {children}
    </button>
  );
}

// ---------- campi ----------
type AzioneMd = { titolo: string; etichetta: React.ReactNode; tipo: "avvolgi" | "riga" | "blocco"; segno: string };
const AZIONI_MD: AzioneMd[] = [
  { titolo: "Grassetto", etichetta: <b>B</b>, tipo: "avvolgi", segno: "**" },
  { titolo: "Corsivo", etichetta: <i className="font-serif">I</i>, tipo: "avvolgi", segno: "*" },
  { titolo: "Titoletto", etichetta: "H", tipo: "riga", segno: "## " },
  { titolo: "Elenco puntato", etichetta: "• Elenco", tipo: "riga", segno: "- " },
  { titolo: "Elenco numerato", etichetta: "1. Elenco", tipo: "riga", segno: "1. " },
  { titolo: "Tabella", etichetta: "Tabella", tipo: "blocco", segno: "| Colonna 1 | Colonna 2 | Colonna 3 |\n|---|---|---|\n| | | |\n| | | |" },
];

/** Applica un'azione di formattazione al testo selezionato. Restituisce il nuovo testo e la nuova selezione. */
function applica(a: AzioneMd, testo: string, inizio: number, fine: number): [string, number, number] {
  const sel = testo.slice(inizio, fine);
  if (a.tipo === "avvolgi") {
    const dentro = sel || "testo";
    return [testo.slice(0, inizio) + a.segno + dentro + a.segno + testo.slice(fine), inizio + a.segno.length, inizio + a.segno.length + dentro.length];
  }
  if (a.tipo === "blocco") {
    const prima = inizio > 0 && testo[inizio - 1] !== "\n" ? "\n\n" : inizio > 0 && testo[inizio - 2] !== "\n" ? "\n" : "";
    const ins = prima + a.segno + "\n";
    return [testo.slice(0, inizio) + ins + testo.slice(fine), inizio + prima.length, inizio + ins.length];
  }
  // riga: prefisso su ogni riga selezionata (o la riga del cursore); se c'è già lo toglie
  const da = testo.lastIndexOf("\n", inizio - 1) + 1;
  const aIdx = testo.indexOf("\n", fine);
  const a2 = aIdx === -1 ? testo.length : aIdx;
  const righe = testo.slice(da, a2).split("\n");
  const togli = righe.every((r) => r.startsWith(a.segno) || (a.segno === "1. " && /^\d+\. /.test(r)));
  const nuove = righe.map((r, i) => (togli ? r.replace(a.segno === "1. " ? /^\d+\. / : a.segno, "") : (a.segno === "1. " ? `${i + 1}. ` : a.segno) + r.replace(/^(- |\d+\. |#+ )/, "")));
  let blocco = nuove.join("\n");
  // in markdown un elenco va separato con una riga vuota dal testo che lo segue o precede, altrimenti lo "assorbe"
  const elenco = !togli && a.segno !== "## ";
  const dopo = testo.slice(a2);
  const primaRiga = testo.slice(0, da).split("\n").slice(-2, -1)[0] ?? "";
  const pre = elenco && da > 0 && primaRiga.trim() && !/^(- |\d+\. )/.test(primaRiga) ? "\n" : "";
  if (elenco && dopo.length > 1 && dopo[1] !== "\n" && !/^\n(- |\d+\. )/.test(dopo)) blocco += "\n";
  return [testo.slice(0, da) + pre + blocco + dopo, da + pre.length, da + pre.length + blocco.length];
}

/** Campo di testo in markdown con barra di formattazione e anteprima affiancata. */
function AreaTesto({ valore, onChange, righeMin = 3, placeholder }: { valore: string; onChange: (v: string) => void; righeMin?: number; placeholder?: string }) {
  const rif = useRef<HTMLTextAreaElement>(null);
  const [anteprima, setAnteprima] = useState(false);
  const righe = Math.min(30, Math.max(righeMin, valore.split("\n").length + Math.floor(valore.length / (anteprima ? 55 : 110))));

  function esegui(a: AzioneMd) {
    const ta = rif.current;
    if (!ta) return;
    const [nuovo, s1, s2] = applica(a, valore, ta.selectionStart, ta.selectionEnd);
    onChange(nuovo);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s1, s2);
    });
  }
  function tasti(e: React.KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const a = e.key === "b" ? AZIONI_MD[0] : e.key === "i" ? AZIONI_MD[1] : null;
    if (a) {
      e.preventDefault();
      esegui(a);
    }
  }

  return (
    <div className="overflow-hidden rounded-[4px] border border-n-100 bg-white focus-within:border-n-300">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-n-50 bg-n-25 px-1.5 py-1">
        {AZIONI_MD.map((a) => (
          <button key={a.titolo} type="button" title={a.titolo} onMouseDown={(e) => e.preventDefault()} onClick={() => esegui(a)} className="min-w-7 rounded-[3px] px-2 py-0.5 text-xs text-n-600 hover:bg-n-50 hover:text-n-900">
            {a.etichetta}
          </button>
        ))}
        <button type="button" onClick={() => setAnteprima(!anteprima)} className={`ml-auto rounded-[3px] px-2 py-0.5 text-xs ${anteprima ? "bg-n-900 text-white" : "text-n-600 hover:bg-n-50"}`}>
          Anteprima
        </button>
      </div>
      <div className={anteprima ? "grid md:grid-cols-2" : ""}>
        <textarea
          ref={rif}
          className="block w-full resize-y border-0 bg-transparent px-3 py-2 font-mono text-[15px] leading-relaxed outline-none"
          rows={righe}
          value={valore}
          placeholder={placeholder}
          onKeyDown={tasti}
          onChange={(e) => onChange(e.target.value)}
        />
        {anteprima && (
          <div className="max-h-[720px] overflow-y-auto border-t border-n-50 px-4 py-2 md:border-l md:border-t-0">
            {valore.trim() ? <Md>{valore}</Md> : <p className="text-sm text-n-300">Niente da mostrare</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ nome, aiuto, children }: { nome: string; aiuto?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="label">{nome}</span>
      {children}
      {aiuto && <span className="hint">{aiuto}</span>}
    </div>
  );
}

function Azioni({ onSalva, onAnnulla, busy, errore }: { onSalva: () => void; onAnnulla: () => void; busy: boolean; errore?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <button className="btn-primary btn-sm" disabled={busy} onClick={onSalva}>
        {busy ? "Salvo…" : "Salva"}
      </button>
      <button className="btn-ghost btn-sm" disabled={busy} onClick={onAnnulla}>
        Annulla
      </button>
      {errore && <span className="text-xs text-err">{errore}</span>}
    </div>
  );
}

export function SceltaSottoDimensioni({ disponibili, valore, onChange }: { disponibili: string[]; valore: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {disponibili.map((s) => {
        const attivo = valore.includes(s);
        return (
          <button
            type="button"
            key={s}
            onClick={() => onChange(attivo ? valore.filter((x) => x !== s) : [...valore, s])}
            className={`chip cursor-pointer ring-1 transition-colors ${attivo ? "bg-n-900 text-white ring-n-900" : "bg-white text-n-600 ring-n-100 hover:ring-n-300"}`}
            title={getSottoDimensione(s)?.sub.declaratoria}
          >
            {getSottoDimensione(s)?.sub.nome ?? s}
          </button>
        );
      })}
    </div>
  );
}

function CampiTrappola({ contiene, tipo, descrizione, onChange }: { contiene: boolean; tipo: TipoTrappola; descrizione: string; onChange: (p: { contieneTrappola?: boolean; tipoTrappola?: TipoTrappola; descrizioneTrappola?: string }) => void }) {
  return (
    <div className="space-y-2 rounded-[4px] border border-n-100 p-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={contiene} onChange={(e) => onChange({ contieneTrappola: e.target.checked, tipoTrappola: e.target.checked && tipo === "nessuna" ? "T-GEN" : tipo })} />
        Contiene una trappola
      </label>
      {contiene && (
        <>
          <select className="field" value={tipo} onChange={(e) => onChange({ tipoTrappola: e.target.value as TipoTrappola })}>
            {Object.entries(TRAPPOLE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Campo nome="Descrizione della trappola (uso interno)">
            <AreaTesto valore={descrizione} onChange={(v) => onChange({ descrizioneTrappola: v })} righeMin={2} />
          </Campo>
        </>
      )}
    </div>
  );
}

interface PropsEditor<T> {
  valore: T;
  subDisponibili: string[];
  onSalva: (v: T) => Promise<void>;
  onAnnulla: () => void;
}

function useSalvataggio<T>(onSalva: (v: T) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState("");
  async function salva(v: T, controllo?: string) {
    if (controllo) return setErrore(controllo);
    setBusy(true);
    setErrore("");
    try {
      await onSalva(v);
    } catch (e) {
      setErrore((e as Error).message);
      setBusy(false);
    }
  }
  return { busy, errore, salva };
}

// ---------- email ----------
export function EditorEmail({ valore, subDisponibili, personaggi, onSalva, onAnnulla }: PropsEditor<EmailGenerata> & { personaggi: string[] }) {
  const [e, setE] = useState(valore);
  const set = (p: Partial<EmailGenerata>) => setE((x) => ({ ...x, ...p }));
  const { busy, errore, salva } = useSalvataggio(onSalva);
  const controllo = !e.oggetto.trim() ? "Manca l'oggetto" : !e.corpo.trim() ? "Manca il corpo" : !e.sottoDimensioni.length ? "Scegli almeno una sotto-dimensione" : undefined;

  return (
    <div className="space-y-3 px-5 py-4">
      <datalist id="personaggi">
        {personaggi.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="Mittente">
          <input className="field" list="personaggi" value={e.mittente} onChange={(x) => set({ mittente: x.target.value })} />
        </Campo>
        <Campo nome="Destinatario">
          <input className="field" list="personaggi" value={e.destinatario} onChange={(x) => set({ destinatario: x.target.value })} />
        </Campo>
      </div>
      <Campo nome="Oggetto">
        <input className="field" value={e.oggetto} onChange={(x) => set({ oggetto: x.target.value })} />
      </Campo>
      <Campo nome="Corpo">
        <AreaTesto valore={e.corpo} onChange={(v) => set({ corpo: v })} righeMin={8} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo nome="Arrivo (minuti dall'inizio)">
          <input className="field" type="number" min={0} value={e.ritardo} onChange={(x) => set({ ritardo: Number(x.target.value) })} />
        </Campo>
        <Campo nome="Categoria">
          <select className="field" value={e.categoria} onChange={(x) => set({ categoria: x.target.value as CategoriaEmail })}>
            {Object.entries(CATEGORIE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Campo>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={e.critica} onChange={(x) => set({ critica: x.target.checked })} />
          Email critica
        </label>
      </div>
      <Campo nome="Sotto-dimensioni testate">
        <SceltaSottoDimensioni disponibili={subDisponibili} valore={e.sottoDimensioni} onChange={(v) => set({ sottoDimensioni: v })} />
      </Campo>
      <CampiTrappola contiene={e.contieneTrappola} tipo={e.tipoTrappola} descrizione={e.descrizioneTrappola} onChange={set} />
      <Campo nome="Comportamento atteso (uso interno)">
        <AreaTesto valore={e.comportamentoAtteso} onChange={(v) => set({ comportamentoAtteso: v })} />
      </Campo>
      <Campo nome="Motivazione per gli psicologi (uso interno)">
        <AreaTesto valore={e.motivazione} onChange={(v) => set({ motivazione: v })} righeMin={2} />
      </Campo>
      <Azioni busy={busy} errore={errore} onAnnulla={onAnnulla} onSalva={() => salva(e, controllo)} />
    </div>
  );
}

// ---------- domanda ----------
export function EditorDomanda({ valore, subDisponibili, onSalva, onAnnulla }: PropsEditor<DomandaGenerata>) {
  const [d, setD] = useState(valore);
  const set = (p: Partial<DomandaGenerata>) => setD((x) => ({ ...x, ...p }));
  const setOpz = (i: number, p: Partial<OpzioneRisposta>) => set({ opzioni: d.opzioni.map((o, j) => (j === i ? { ...o, ...p } : o)) });
  const { busy, errore, salva } = useSalvataggio(onSalva);
  const piene = d.opzioni.filter((o) => o.testo.trim());
  const controllo = !d.testo.trim()
    ? "Manca il testo della domanda"
    : !d.sottoDimensioni.length
      ? "Scegli almeno una sotto-dimensione"
      : d.rispostaAScelta && piene.length < 2
        ? "Servono almeno 2 opzioni"
        : d.rispostaAScelta && new Set(piene.map((o) => o.valutazione)).size !== piene.length
          ? "Ogni opzione deve avere una valutazione diversa"
          : d.rispostaAScelta && !piene.some((o) => o.valutazione === "migliore")
            ? "Manca l'opzione \"Migliore\""
            : undefined;

  return (
    <div className="space-y-3 px-5 py-4">
      <Campo nome="Testo della domanda">
        <AreaTesto valore={d.testo} onChange={(v) => set({ testo: v })} righeMin={6} />
      </Campo>
      <Campo nome="Output AI simulato" aiuto="Lascia vuoto se la domanda non mostra un output dell'AI.">
        <AreaTesto valore={d.outputAISimulato} onChange={(v) => set({ outputAISimulato: v })} righeMin={2} />
      </Campo>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={d.rispostaAScelta} onChange={() => set({ rispostaAScelta: true, opzioni: d.opzioni.length ? d.opzioni : [{ testo: "", valutazione: "migliore" }, { testo: "", valutazione: "da_evitare" }] })} />
          Risposta a scelta
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={!d.rispostaAScelta} onChange={() => set({ rispostaAScelta: false })} />
          Risposta aperta
        </label>
      </div>
      {d.rispostaAScelta && (
        <div className="space-y-2">
          <span className="label">Opzioni di risposta</span>
          {d.opzioni.map((o, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="pt-2 font-mono text-xs text-n-400">{String.fromCharCode(65 + i)}</span>
              <textarea className="field flex-1 text-sm" rows={3} value={o.testo} onChange={(x) => setOpz(i, { testo: x.target.value })} />
              <select className="field w-48 shrink-0" value={o.valutazione} onChange={(x) => setOpz(i, { valutazione: x.target.value as OpzioneRisposta["valutazione"] })}>
                {VALUTAZIONI.map((v) => (
                  <option key={v.id} value={v.id} disabled={v.id !== o.valutazione && d.opzioni.some((x) => x.valutazione === v.id)}>
                    {etichettaValutazione(v.id)}
                  </option>
                ))}
              </select>
              <BottoneIcona titolo="Elimina opzione" pericolo onClick={() => set({ opzioni: d.opzioni.filter((_, j) => j !== i) })}>
                <IconaCestino />
              </BottoneIcona>
            </div>
          ))}
          {d.opzioni.length < VALUTAZIONI.length && (
            <button type="button" className="text-xs font-medium text-a-700 hover:underline" onClick={() => set({ opzioni: [...d.opzioni, { testo: "", valutazione: VALUTAZIONI.find((v) => !d.opzioni.some((x) => x.valutazione === v.id))!.id }] })}>
              + Aggiungi opzione
            </button>
          )}
        </div>
      )}
      <Campo nome="Sotto-dimensioni testate">
        <SceltaSottoDimensioni disponibili={subDisponibili} valore={d.sottoDimensioni} onChange={(v) => set({ sottoDimensioni: v })} />
      </Campo>
      <CampiTrappola contiene={d.contieneTrappola} tipo={d.tipoTrappola} descrizione={d.descrizioneTrappola} onChange={set} />
      <Campo nome="Comportamento atteso (uso interno)">
        <AreaTesto valore={d.comportamentoAtteso} onChange={(v) => set({ comportamentoAtteso: v })} />
      </Campo>
      <Campo nome="Motivazione per gli psicologi (uso interno)">
        <AreaTesto valore={d.motivazione} onChange={(v) => set({ motivazione: v })} righeMin={2} />
      </Campo>
      <Azioni busy={busy} errore={errore} onAnnulla={onAnnulla} onSalva={() => salva(d, controllo)} />
    </div>
  );
}

// ---------- testo libero (titolo, istruzioni) ----------
export function TestoModificabile({ valore, onSalva, riga, children }: { valore: string; onSalva: (v: string) => Promise<void>; riga?: boolean; children: React.ReactNode }) {
  const [modifica, setModifica] = useState(false);
  const [v, setV] = useState(valore);
  const { busy, errore, salva } = useSalvataggio(async (x: string) => {
    await onSalva(x);
    setModifica(false);
  });
  if (!modifica)
    return (
      <div className="group relative">
        {children}
        <span className={`absolute right-0 top-0 ${riga ? "" : "opacity-60 group-hover:opacity-100"}`}>
          <BottoneIcona
            titolo="Modifica"
            onClick={() => {
              setV(valore);
              setModifica(true);
            }}
          >
            <IconaMatita />
          </BottoneIcona>
        </span>
      </div>
    );
  return (
    <div>
      {riga ? <input className="field text-lg font-semibold" value={v} autoFocus onChange={(e) => setV(e.target.value)} /> : <AreaTesto valore={v} onChange={setV} righeMin={10} />}
      <Azioni busy={busy} errore={errore} onAnnulla={() => setModifica(false)} onSalva={() => salva(v, v.trim() ? undefined : "Il testo non può essere vuoto")} />
    </div>
  );
}
