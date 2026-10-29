// Regole fisse del Framework di Authoring Scenari.
// Sono vincoli che Claude deve rispettare e che il codice verifica dopo ogni generazione.
// Per cambiarle si modifica solo questo file.

import type { InputTest, Scenario, TestGenerato, Problema, SelezioneDimensione, CategoriaEmail } from "./types";
import { dimensioneDi, getSottoDimensione, getDimensione } from "./catalog";

const nomeSub = (id: string) => getSottoDimensione(id)?.sub.nome ?? id;
const nomeDim = (id: string) => getDimensione(id)?.nome ?? id;

export const REGOLE = {
  inBasket: {
    emailMin: 8,
    emailMax: 14,
    minutiPerEmail: 12, // numero email suggerito = durata / minutiPerEmail, entro min e max
    categorieObbligatorie: [
      "strategicDeadline",
      "urgentOperational",
      "personalEmotional",
      "externalComplaint",
      "numericReport",
      "agendaOverlap",
    ] as CategoriaEmail[],
    criticheMin: 2,
    criticheMax: 4,
    trappoleMin: 1,
    ritardoMaxQuota: 0.75, // nessuna email arriva oltre il 75% della durata
  },
  situational: {
    domandeMin: 4,
    domandeMax: 30,
    // Tempo medio stimato per rispondere: la somma deve stare nella durata del test.
    minutiDomandaAScelta: 1.5,
    minutiDomandaAperta: 4,
    minutiExtraOutputAI: 1.5, // leggere e valutare un output AI simulato
    tolleranzaTempo: 1.1,
    blocchiMin: 1,
    blocchiMax: 4,
    aperteMinConsigliate: 2,
    trappoleMinConsigliate: 1,
    opzioniMin: 3,
    opzioniMax: 5,
  },
  sottoDimensioniMaxPerItem: 2,
  copertureConsigliate: 2, // quante volte ogni sotto-dimensione dovrebbe essere testata
};

export const DESCR_CATEGORIE: Record<CategoriaEmail, string> = {
  strategicDeadline: "Mail del superiore con richiesta strategica e scadenza (ancora principale, definisce l'obiettivo)",
  urgentOperational: "Mail di un collaboratore con problema operativo urgente",
  personalEmotional: "Mail di un collaboratore con richiesta personale o emotiva (dilemma persona vs processo)",
  externalComplaint: "Mail esterna (cliente, fornitore, partner) con richiesta o reclamo",
  numericReport: "Documento o mail con dati numerici o report",
  agendaOverlap: "Agenda o mail con impegni sovrapposti (materializza il vincolo temporale)",
  other: "Altro: contraddizione con un'altra mail, conflitto tra pari, rumore a bassa priorità, ecc.",
};

export const DESCR_TRAPPOLE = {
  "T-NUM": "Calcolo o dato numerico errato",
  "T-NORM": "Norma, legge o policy citata in modo errato o inesistente",
  "T-FRAME": "Dati corretti ma interpretazione sbilanciata",
  "T-AUTH": "Fonte autorevole che avalla un dato o una scelta sbagliata",
  "T-GEN": "Output plausibile ma generico, non aderente al contesto",
  "T-DATI": "Richiesta che porta a inserire dati personali o sensibili in uno strumento AI, o a decisioni automatiche su persone",
  nessuna: "Nessuna trappola",
};

export function numeroItemSuggerito(tipo: InputTest["tipo"], durata: number): number {
  if (tipo === "inBasket") {
    const r = REGOLE.inBasket;
    return Math.min(r.emailMax, Math.max(r.emailMin, Math.round(durata / r.minutiPerEmail)));
  }
  const r = REGOLE.situational;
  // stima con un mix di circa 1/3 aperte e 2/3 a scelta
  const medio = (r.minutiDomandaAperta + 2 * r.minutiDomandaAScelta) / 3;
  return Math.min(24, Math.max(r.domandeMin, Math.round(durata / medio)));
}

/** Regole in formato testo per i prompt. */
export function regolePerPrompt(tipo: InputTest["tipo"], durata: number): string {
  const n = numeroItemSuggerito(tipo, durata);
  if (tipo === "inBasket") {
    const r = REGOLE.inBasket;
    return [
      `- Numero di email: ${n} (consentito ${r.emailMin}-${r.emailMax}).`,
      `- Almeno una email per ciascuna categoria obbligatoria: ${r.categorieObbligatorie.join(", ")}. Le restanti possono essere "other".`,
      `- Email critiche (se gestite male abbassano il profilo e compaiono nella sintesi delle decisioni critiche): tra ${r.criticheMin} e ${r.criticheMax}. Tipicamente la scadenza strategica del superiore e i casi delicati su persone o dati.`,
      `- Almeno ${r.trappoleMin} email con trappola oggettiva; ogni trappola ha tipo e descrizione.`,
      `- Ritardo di arrivo (minuti dall'inizio): la prima email a 0, nessuna oltre ${Math.floor(durata * r.ritardoMaxQuota)} minuti.`,
      `- Mappa delle figure: almeno 1 superiore diretto, 1 collega pari livello, 1 collaboratore, 1 figura esterna.`,
      `- Vincolo comunicativo nelle istruzioni: il partecipante non può chiamare nessuno né chiedere chiarimenti; decide solo con ciò che ha.`,
      `- Ogni email testa 1 o al massimo ${REGOLE.sottoDimensioniMaxPerItem} sotto-dimensioni tra quelle selezionate; ogni sotto-dimensione selezionata è testata da almeno 1 email (meglio ${REGOLE.copertureConsigliate}).`,
    ].join("\n");
  }
  const r = REGOLE.situational;
  return [
    `- Budget di tempo: ${durata} minuti. Stima ${r.minutiDomandaAScelta} min per domanda a scelta, ${r.minutiDomandaAperta} min per domanda aperta, +${r.minutiExtraOutputAI} min se c'è un output AI da valutare. Il tempo totale stimato NON deve superare ${Math.round(durata * r.tolleranzaTempo)} minuti (orientativamente ${n} domande con un mix di aperte e a scelta; meno domande se molte sono aperte).`,
    `- Domande organizzate in ${r.blocchiMin}-${r.blocchiMax} blocchi (consentite ${r.domandeMin}-${r.domandeMax} domande).`,
    `- Ogni domanda è una situazione lavorativa concreta. Può essere aperta (risposta scritta) o a scelta (3-5 alternative di comportamento, esattamente una "migliore").`,
    `- Consigliate almeno ${r.aperteMinConsigliate} domande aperte e almeno ${r.trappoleMinConsigliate} domanda con trappola. Le trappole sulle AI skill stanno di solito in un "output AI simulato" pre-scritto (mai AI reale) che il candidato deve valutare.`,
    `- Ogni domanda testa 1 o al massimo ${REGOLE.sottoDimensioniMaxPerItem} sotto-dimensioni tra quelle selezionate; ogni sotto-dimensione selezionata è testata da almeno 1 domanda (meglio ${REGOLE.copertureConsigliate}).`,
  ].join("\n");
}

function controllaCopertura(
  items: { ref: string; sottoDimensioni: string[] }[],
  selezione: SelezioneDimensione[],
  out: Problema[]
) {
  const selezionate = new Set(selezione.flatMap((d) => d.sottoDimensioni.map((s) => s.id)));
  const conteggio = new Map<string, number>();
  for (const it of items) {
    if (!it.sottoDimensioni?.length) out.push({ livello: "errore", ref: it.ref, messaggio: "Nessuna sotto-dimensione indicata." });
    if (it.sottoDimensioni?.length > REGOLE.sottoDimensioniMaxPerItem)
      out.push({ livello: "avviso", ref: it.ref, messaggio: `Testa ${it.sottoDimensioni.length} sotto-dimensioni: meglio al massimo ${REGOLE.sottoDimensioniMaxPerItem}.` });
    for (const s of it.sottoDimensioni ?? []) {
      if (!selezionate.has(s)) out.push({ livello: "errore", ref: it.ref, messaggio: `Sotto-dimensione "${nomeSub(s)}" non selezionata per questo test.` });
      conteggio.set(s, (conteggio.get(s) ?? 0) + 1);
    }
  }
  for (const s of selezionate) {
    const c = conteggio.get(s) ?? 0;
    if (c === 0) out.push({ livello: "errore", messaggio: `La sotto-dimensione "${nomeSub(s)}" non è testata da nessun elemento.` });
    else if (c < REGOLE.copertureConsigliate)
      out.push({ livello: "avviso", messaggio: `La sotto-dimensione "${nomeSub(s)}" è testata da un solo elemento.` });
  }
}

function controllaPesi(selezione: SelezioneDimensione[], out: Problema[]) {
  const tot = selezione.reduce((a, d) => a + (Number(d.peso) || 0), 0);
  if (Math.round(tot) !== 100) out.push({ livello: "avviso", messaggio: `I pesi delle dimensioni sommano a ${tot}, non a 100 (Strapi li normalizza comunque).` });
  for (const d of selezione) {
    if (!d.sottoDimensioni.length) out.push({ livello: "errore", messaggio: `La dimensione "${nomeDim(d.dimensioneId)}" non ha sotto-dimensioni selezionate.` });
    for (const s of d.sottoDimensioni)
      if (dimensioneDi(s.id) !== d.dimensioneId)
        out.push({ livello: "errore", messaggio: `La sotto-dimensione "${s.id}" non appartiene alla dimensione "${d.dimensioneId}".` });
  }
}

export function tempoStimato(piano: { rispostaAScelta?: boolean; conOutputAI?: boolean }[]): number {
  const r = REGOLE.situational;
  return piano.reduce(
    (t, d) => t + (d.rispostaAScelta ? r.minutiDomandaAScelta : r.minutiDomandaAperta) + (d.conOutputAI ? r.minutiExtraOutputAI : 0),
    0
  );
}

/** Controllo del piano (prima di generare i contenuti). */
export function validaPiano(tipo: InputTest["tipo"], durata: number, scenario: Scenario, selezione: SelezioneDimensione[]): Problema[] {
  const out: Problema[] = [];
  const p = scenario.piano ?? [];
  controllaCopertura(p, selezione, out);
  const refs = new Set<string>();
  for (const it of p) {
    if (refs.has(it.ref)) out.push({ livello: "errore", ref: it.ref, messaggio: "Riferimento duplicato." });
    refs.add(it.ref);
    if (it.trappola !== "nessuna" && !it.ideaTrappola?.trim())
      out.push({ livello: "errore", ref: it.ref, messaggio: "Trappola senza descrizione." });
  }
  if (tipo === "inBasket") {
    const r = REGOLE.inBasket;
    if (p.length < r.emailMin || p.length > r.emailMax)
      out.push({ livello: "errore", messaggio: `Il piano ha ${p.length} email: servono tra ${r.emailMin} e ${r.emailMax}.` });
    for (const c of r.categorieObbligatorie)
      if (!p.some((it) => it.categoria === c)) out.push({ livello: "errore", messaggio: `Manca una email di categoria obbligatoria "${c}".` });
    const critiche = p.filter((it) => it.critica).length;
    if (critiche < r.criticheMin || critiche > r.criticheMax)
      out.push({ livello: "errore", messaggio: `Email critiche: ${critiche}. Servono tra ${r.criticheMin} e ${r.criticheMax}.` });
    const trap = p.filter((it) => it.trappola !== "nessuna").length;
    if (trap < r.trappoleMin) out.push({ livello: "errore", messaggio: `Servono almeno ${r.trappoleMin} trappole.` });
    const maxRit = Math.floor(durata * r.ritardoMaxQuota);
    for (const it of p)
      if ((it.ritardo ?? 0) > maxRit || (it.ritardo ?? 0) < 0)
        out.push({ livello: "errore", ref: it.ref, messaggio: `Ritardo ${it.ritardo} min fuori intervallo (0-${maxRit}).` });
    if (!p.some((it) => (it.ritardo ?? 0) === 0)) out.push({ livello: "errore", messaggio: "Almeno una email deve arrivare all'inizio (ritardo 0)." });
  } else {
    const r = REGOLE.situational;
    if (p.length < r.domandeMin || p.length > r.domandeMax)
      out.push({ livello: "errore", messaggio: `Il piano ha ${p.length} domande: servono tra ${r.domandeMin} e ${r.domandeMax}.` });
    const tempo = tempoStimato(p);
    if (tempo > durata * r.tolleranzaTempo)
      out.push({ livello: "errore", messaggio: `Tempo stimato ${Math.round(tempo)} minuti, oltre la durata di ${durata}: riduci le domande o sostituisci alcune aperte con domande a scelta.` });
    const nb = scenario.blocchi?.length ?? 0;
    if (nb < r.blocchiMin || nb > r.blocchiMax) out.push({ livello: "errore", messaggio: `Blocchi: ${nb}. Servono tra ${r.blocchiMin} e ${r.blocchiMax}.` });
    const titoli = new Set((scenario.blocchi ?? []).map((b) => b.titolo));
    for (const it of p) if (!titoli.has(it.blocco ?? "")) out.push({ livello: "errore", ref: it.ref, messaggio: `Blocco "${it.blocco}" inesistente.` });
    if (p.filter((it) => !it.rispostaAScelta).length < r.aperteMinConsigliate)
      out.push({ livello: "avviso", messaggio: `Meno di ${r.aperteMinConsigliate} domande aperte.` });
    if (p.filter((it) => it.trappola !== "nessuna").length < r.trappoleMinConsigliate)
      out.push({ livello: "avviso", messaggio: "Nessuna domanda con trappola." });
  }
  return out;
}

/** Controllo del test completo. */
export function validaTest(test: TestGenerato): Problema[] {
  const out: Problema[] = [];
  controllaPesi(test.dimensioni, out);
  if (!test.istruzioni?.trim()) out.push({ livello: "errore", messaggio: "Istruzioni del test vuote." });
  if (test.tipo === "inBasket") {
    controllaCopertura(test.email, test.dimensioni, out);
    for (const e of test.email) {
      for (const [campo, v] of [["mittente", e.mittente], ["oggetto", e.oggetto], ["corpo", e.corpo], ["comportamentoAtteso", e.comportamentoAtteso]] as const)
        if (!v?.trim()) out.push({ livello: "errore", ref: e.ref, messaggio: `Campo "${campo}" vuoto.` });
      if (e.contieneTrappola && !e.descrizioneTrappola?.trim())
        out.push({ livello: "errore", ref: e.ref, messaggio: "Trappola senza descrizione." });
      if (!e.dimensioni?.length) out.push({ livello: "errore", ref: e.ref, messaggio: "Nessuna dimensione collegata." });
    }
  } else {
    const domande = test.blocchi.flatMap((b) => b.domande);
    controllaCopertura(domande, test.dimensioni, out);
    const r = REGOLE.situational;
    for (const d of domande) {
      if (!d.testo?.trim()) out.push({ livello: "errore", ref: d.ref, messaggio: "Testo vuoto." });
      if (!d.comportamentoAtteso?.trim()) out.push({ livello: "errore", ref: d.ref, messaggio: "Comportamento atteso vuoto." });
      if (d.contieneTrappola && !d.descrizioneTrappola?.trim())
        out.push({ livello: "errore", ref: d.ref, messaggio: "Trappola senza descrizione." });
      if (d.rispostaAScelta) {
        if (d.opzioni.length < r.opzioniMin || d.opzioni.length > r.opzioniMax)
          out.push({ livello: "errore", ref: d.ref, messaggio: `Servono tra ${r.opzioniMin} e ${r.opzioniMax} alternative.` });
        const migliori = d.opzioni.filter((o) => o.valutazione === "migliore").length;
        if (migliori !== 1) out.push({ livello: "errore", ref: d.ref, messaggio: `Le alternative "migliori" sono ${migliori}: deve essercene esattamente una.` });
      }
    }
  }
  return out;
}
