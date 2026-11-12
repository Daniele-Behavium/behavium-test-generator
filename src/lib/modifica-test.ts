// Funzioni per modificare un test già generato (usate da client e server).
import type { DomandaGenerata, EmailGenerata, Scenario, TestGenerato } from "./types";
import { dimensioneDi, getSottoDimensione } from "./catalog";
import { sistemaTabelle } from "./markdown";

/** Prossimo ref libero: E9 dopo E8, Q16 dopo Q15. */
export function nuovoRef(t: TestGenerato): string {
  const refs = t.tipo === "inBasket" ? t.email.map((e) => e.ref) : t.blocchi.flatMap((b) => b.domande.map((d) => d.ref));
  const prefisso = t.tipo === "inBasket" ? "E" : "Q";
  const max = Math.max(0, ...refs.map((r) => Number(r.replace(/\D/g, "")) || 0));
  return `${prefisso}${max + 1}`;
}

export function emailVuota(ref: string, ritardo: number, destinatario: string): EmailGenerata {
  return {
    ref,
    mittente: "",
    destinatario,
    oggetto: "",
    corpo: "",
    ritardo,
    critica: false,
    contieneTrappola: false,
    tipoTrappola: "nessuna",
    descrizioneTrappola: "",
    comportamentoAtteso: "",
    categoria: "other",
    dimensioni: [],
    sottoDimensioni: [],
    motivazione: "Elemento aggiunto a mano dal team.",
  };
}

export function domandaVuota(ref: string, blocco: string): DomandaGenerata {
  return {
    ref,
    blocco,
    testo: "",
    outputAISimulato: "",
    comportamentoAtteso: "",
    rispostaAScelta: true,
    opzioni: [
      { testo: "", valutazione: "migliore" },
      { testo: "", valutazione: "accettabile" },
      { testo: "", valutazione: "discreta" },
      { testo: "", valutazione: "da_evitare" },
    ],
    contieneTrappola: false,
    tipoTrappola: "nessuna",
    descrizioneTrappola: "",
    dimensioni: [],
    sottoDimensioni: [],
    motivazione: "Elemento aggiunto a mano dal team.",
  };
}

/** Rende coerente un test dopo una modifica: dimensioni ricavate dalle sotto-dimensioni, email in ordine di arrivo. */
export function normalizzaTest(t: TestGenerato): TestGenerato {
  const fix = <T extends EmailGenerata | DomandaGenerata>(it: T): T => {
    const subs = it.sottoDimensioni.filter((s) => getSottoDimensione(s));
    const tipoTrappola = it.contieneTrappola ? (it.tipoTrappola === "nessuna" ? "T-GEN" : it.tipoTrappola) : "nessuna";
    const testi =
      "corpo" in it
        ? { corpo: sistemaTabelle((it as EmailGenerata).corpo) }
        : { testo: sistemaTabelle((it as DomandaGenerata).testo), outputAISimulato: sistemaTabelle((it as DomandaGenerata).outputAISimulato) };
    return { ...it, ...testi, sottoDimensioni: subs, dimensioni: Array.from(new Set(subs.map((s) => dimensioneDi(s)!))), tipoTrappola, descrizioneTrappola: it.contieneTrappola ? it.descrizioneTrappola : "" };
  };
  return {
    ...t,
    nome: t.nome.trim(),
    istruzioni: sistemaTabelle(t.istruzioni),
    introduzioneTecnica: sistemaTabelle(t.introduzioneTecnica),
    email: t.email.map((e) => fix({ ...e, ritardo: Math.max(0, Math.round(Number(e.ritardo) || 0)) })).sort((a, b) => a.ritardo - b.ritardo),
    blocchi: t.blocchi.map((b) => ({
      ...b,
      domande: b.domande.map((d) => fix({ ...d, blocco: b.titolo, opzioni: d.rispostaAScelta ? d.opzioni.filter((o) => o.testo.trim()) : [] })),
    })),
  };
}

/** Ricostruisce lo scenario (piano incluso) a partire dal test salvato, per far riscrivere o aggiungere elementi all'AI. */
export function scenarioDaTest(t: TestGenerato): Scenario {
  const piano =
    t.tipo === "inBasket"
      ? t.email.map((e) => ({
          ref: e.ref,
          sottoDimensioni: e.sottoDimensioni,
          categoria: e.categoria,
          critica: e.critica,
          trappola: e.tipoTrappola,
          ideaTrappola: e.descrizioneTrappola,
          mittente: e.mittente,
          ritardo: e.ritardo,
          sintesi: `${e.oggetto}. ${e.corpo.slice(0, 200)}`,
          motivazione: e.motivazione,
        }))
      : t.blocchi.flatMap((b) =>
          b.domande.map((d) => ({
            ref: d.ref,
            blocco: b.titolo,
            sottoDimensioni: d.sottoDimensioni,
            rispostaAScelta: d.rispostaAScelta,
            conOutputAI: !!d.outputAISimulato,
            trappola: d.tipoTrappola,
            ideaTrappola: d.descrizioneTrappola,
            sintesi: d.testo.slice(0, 220),
            motivazione: d.motivazione,
          }))
        );
  return {
    nome: t.nome,
    settoreScenario: t.settoreScenario,
    istruzioni: t.istruzioni,
    introduzioneTecnica: t.introduzioneTecnica,
    personaggi: t.personaggi,
    blocchi: t.blocchi.map((b) => ({ titolo: b.titolo })),
    piano,
  };
}
