import "server-only";
import type { Analisi, InputTest, RecordTest, Regola, Scenario } from "./types";
import { catalogoPerPrompt, catalogo } from "./catalog";
import { DESCR_CATEGORIE, DESCR_TRAPPOLE, regolePerPrompt, numeroItemSuggerito } from "./regole";

const LINGUA = { it: "italiano", en: "inglese" };
const TIPO = { inBasket: "in-basket", situational: "situazionale" };

export const SYSTEM_BASE = `Sei l'autore senior di assessment comportamentali di Behavium, piattaforma HR-tech che valuta come le persone lavorano e decidono, anche quando usano l'AI.
Progetti test in-basket e situazionali secondo il Framework di Authoring Scenari di Behavium (Assessment Center: Thornton & Byham 1982; Arthur et al. 2003; BARS: Brannick, Levine & Morgeson 2007).

Principi non negoziabili:
- Il test non dichiara mai al candidato cosa misura. Le competenze emergono dal comportamento osservabile.
- Ogni elemento (email o domanda) esiste per misurare sotto-dimensioni precise del catalogo. Per decidere come misurarle guarda la griglia 1-5 della sotto-dimensione: l'elemento deve creare l'occasione per mostrare i comportamenti dei livelli alti e, se mancano, quelli dei livelli bassi. Esempio: se il livello 5 dice "verifica le fonti", serve qualcosa da verificare.
- Le trappole sono oggettive e verificabili (un numero sbagliato, una norma inesistente, una fonte autorevole che avalla un errore, una richiesta di inserire dati sensibili in uno strumento AI), mai trabocchetti linguistici. Devono essere plausibili e non segnalate.
- La difficoltà si calibra su seniority e durata, senza sommergere il candidato: uno scenario troppo difficile produce dati inutili.
- Nomi, aziende e dati sono fittizi ma realistici e coerenti tra loro in tutto il test.
- Scrivi in modo chiaro e professionale, senza enfasi. Non usare il trattino lungo (—).
- Usa solo gli id del catalogo fornito. Non inventare dimensioni o sotto-dimensioni.
- Nei testi in prosa (motivazioni, comportamento atteso) chiama le sotto-dimensioni con il loro nome (es. "Controllo epistemico"), mai con l'id tecnico.`;

export function bloccoRegoleApprese(regole: Regola[]): string {
  if (!regole.length) return "";
  return `\n\nREGOLE APPRESE DAI FEEDBACK DEL TEAM (hanno priorità sulle tue preferenze stilistiche, mai sulle regole fisse):\n${regole.map((r) => `- ${r.testo}`).join("\n")}`;
}

export function bloccoEsempi(esempi: RecordTest[]): string {
  if (!esempi.length) return "";
  const parti = esempi.map((e) => {
    const t = e.test;
    const items =
      t.tipo === "inBasket"
        ? t.email.slice(0, 4).map((m) => `  - ${m.ref} [${m.sottoDimensioni.join(", ")}] Da ${m.mittente}: "${m.oggetto}". Trappola: ${m.tipoTrappola}`)
        : t.blocchi.flatMap((b) => b.domande).slice(0, 4).map((d) => `  - ${d.ref} [${d.sottoDimensioni.join(", ")}] ${d.testo.slice(0, 160)}...`);
    return `* "${t.nome}" (ruolo: ${t.ruoloTarget}, settore scenario: ${t.settoreScenario})\n${items.join("\n")}`;
  });
  return `\n\nTEST APPROVATI DAL TEAM (riferimento di qualità e stile, non da copiare):\n${parti.join("\n")}`;
}

function bloccoInput(i: InputTest): string {
  return `JOB TITLE: ${i.jobTitle}
TIPO DI TEST: ${TIPO[i.tipo]}
CONTESTO D'USO: ${i.contesto === "recruiting" ? "recruiting (selezione: conta il potenziale)" : "workforce (sviluppo di persone già in azienda: conta la performance nel contesto reale)"}
LINGUA DEL TEST: ${LINGUA[i.lingua]}
FOCUS RICHIESTO: ${i.focus.trim() || "(nessuno)"}
DA NON TESTARE: ${i.esclusioni.trim() || "(nessuna esclusione)"}

JOB DESCRIPTION:
"""
${i.jd.trim()}
"""`;
}

export function promptAnalisi(i: InputTest): string {
  return `${bloccoInput(i)}

CATALOGO DIMENSIONI E SOTTO-DIMENSIONI (versione ${catalogo.versione}):
${catalogoPerPrompt()}

COMPITO: analizza la JD e scegli cosa misurare.
1. Individua le competenze richieste dalla JD, con la fonte testuale.
2. Seleziona dal catalogo 2-5 dimensioni e, per ciascuna, 1-3 sotto-dimensioni (in totale 4-10, meno se la durata sarà breve). Scegli quelle più rilevanti per il ruolo e osservabili in un ${TIPO[i.tipo]}.
3. Il FOCUS ha priorità: le sotto-dimensioni che lo coprono vanno selezionate e pesate di più. Se il focus chiede qualcosa che nessuna sotto-dimensione copre (ad esempio una lingua straniera o una competenza tecnica), NON forzarlo: mettilo in "fuoriCatalogo" con una nota.
4. Le ESCLUSIONI sono vincolanti: non selezionare sotto-dimensioni che le riguardano, anche se la JD le cita. Elencale in "esclusioniApplicate".
5. Pesi interi per dimensione, somma 100. In recruiting pesa di più le capacità cognitive e le AI skill; in workforce quelle relazionali, salvo che focus o JD indichino altro.
6. Proponi la seniority (junior/mid/senior) dalla JD (anni di esperienza, responsabilità, riporti).
7. Proponi la durata in minuti: in-basket tipicamente 60-120 (junior più breve), situazionale tipicamente 20-45. Motiva.
Motivazioni brevi e concrete, in italiano.`;
}

export function promptScenario(i: InputTest, a: Analisi, problemiPrecedenti?: string): string {
  const durata = i.durata ?? a.durata;
  const seniority = i.seniority ?? a.seniority;
  const subIds = a.selezione.flatMap((d) => d.sottoDimensioni.map((s) => s.id));
  const n = numeroItemSuggerito(i.tipo, durata);
  const settore =
    i.settoreScenario === "diverso"
      ? `Il settore dello scenario DEVE essere diverso da quello della JD (${a.settoreJD}), plausibile per il ruolo e la seniority. Motivo: evitare che il candidato usi schemi abituali del proprio settore.`
      : `Lo scenario è ambientato nello stesso settore della JD (${a.settoreJD}), con azienda e persone fittizie.`;

  const specifico =
    i.tipo === "inBasket"
      ? `STRUTTURA IN-BASKET (Minimum Viable In-basket):
- "istruzioni" (markdown, mostrate al candidato per tutta la prova): contesto aziendale fittizio (nome, settore, dimensione, struttura, cultura), ruolo del partecipante (nome, titolo, storia breve), vincolo temporale, vincolo comunicativo, agenda con impegni già fissati che creano pressione, e cosa deve consegnare (le risposte alle email e un breve piano d'azione finale).
- "introduzioneTecnica" (markdown, mostrata una volta prima dell'inizio): durata di ${durata} minuti, le email arrivano nel tempo, come rispondere, uso dell'assistente AI consentito con l'obbligo di anonimizzare i dati personali.
- "personaggi": tutte le figure che compaiono.
- "blocchi": lista vuota.
- "piano": una voce per email con ref E1..E${n}, ordinate per ritardo. Per ciascuna: categoria, critica sì/no, trappola, mittente, ritardo, sintesi e motivazione.
Categorie:
${Object.entries(DESCR_CATEGORIE).map(([k, v]) => `  - ${k}: ${v}`).join("\n")}
Leve di difficoltà (Framework 1.5): complessità relazionale non esplicita, sovrapposizione delle tensioni, un elemento critico nascosto in una delle ultime email che cambia il senso di qualcosa letto prima.`
      : `STRUTTURA SITUAZIONALE:
- "istruzioni" (markdown, mostrate al candidato): cosa deve fare, come rispondere alle domande aperte e a quelle a scelta, il ruolo generale del partecipante.
- "introduzioneTecnica" (markdown): durata di ${durata} minuti, regole della prova.
- "personaggi": figure ricorrenti, se servono (anche lista vuota).
- "blocchi": 1-4 blocchi tematici con titolo.
- "piano": circa ${n} domande con ref Q1..Q${n}. Per ciascuna: blocco, rispostaAScelta (aperta o a scelta), conOutputAI (se mostra un output AI simulato da valutare), trappola, sintesi e motivazione. Per le domande usa categoria "other", critica false, mittente "" e ritardo 0.
Scegli aperta o a scelta in base alla sotto-dimensione: le domande aperte misurano il processo (come formuli, verifichi, decidi); quelle a scelta misurano il giudizio in situazioni con alternative plausibili. Le trappole sulle AI skill vanno di solito in un output AI simulato.`;

  return `${bloccoInput(i)}

SENIORITY: ${seniority}
DURATA: ${durata} minuti

SOTTO-DIMENSIONI DA MISURARE (con declaratoria e griglia 1-5):
${catalogoPerPrompt(subIds)}

PESI: ${a.selezione.map((d) => `${d.dimensioneId}=${d.peso}`).join(", ")}

${settore}

${specifico}

TIPI DI TRAPPOLA:
${Object.entries(DESCR_TRAPPOLE).map(([k, v]) => `  - ${k}: ${v}`).join("\n")}

REGOLE FISSE (verificate automaticamente):
${regolePerPrompt(i.tipo, durata)}
${problemiPrecedenti ? `\nLA VERSIONE PRECEDENTE DEL PIANO AVEVA QUESTI ERRORI, CORREGGILI:\n${problemiPrecedenti}\n` : ""}
COMPITO: progetta lo scenario e il piano di tutti gli elementi. Non scrivere ancora i testi completi delle email o delle domande: solo sintesi e motivazione. Distribuisci le sotto-dimensioni in modo che tutte siano coperte e che quelle con peso maggiore abbiano più elementi. I testi per il candidato vanno in ${LINGUA[i.lingua]}; sintesi e motivazioni in italiano.`;
}

export function promptItems(i: InputTest, a: Analisi, sc: Scenario, refs: string[], note?: string): string {
  const durata = i.durata ?? a.durata;
  const seniority = i.seniority ?? a.seniority;
  const subIds = Array.from(new Set(sc.piano.filter((p) => refs.includes(p.ref)).flatMap((p) => p.sottoDimensioni)));
  const pianoCompleto = sc.piano
    .map((p) =>
      i.tipo === "inBasket"
        ? `${p.ref} | T+${p.ritardo}min | ${p.mittente} | ${p.categoria}${p.critica ? " | CRITICA" : ""} | trappola ${p.trappola}${p.ideaTrappola ? `: ${p.ideaTrappola}` : ""} | [${p.sottoDimensioni.join(", ")}] | ${p.sintesi}`
        : `${p.ref} | blocco "${p.blocco}" | ${p.rispostaAScelta ? "a scelta" : "aperta"}${p.conOutputAI ? " + output AI" : ""} | trappola ${p.trappola}${p.ideaTrappola ? `: ${p.ideaTrappola}` : ""} | [${p.sottoDimensioni.join(", ")}] | ${p.sintesi}`
    )
    .join("\n");

  const specifico =
    i.tipo === "inBasket"
      ? `Per ogni email:
- corpo realistico e specifico (tipicamente 80-250 parole), con dati concreti coerenti con lo scenario e le altre email; tono coerente con il mittente e la cultura aziendale.
- la trappola, se prevista, è inserita in modo naturale e non segnalata.
- "destinatario" è il personaggio del candidato.
- "comportamentoAtteso" (uso interno): i comportamenti osservabili attesi, collegati ai livelli alti della griglia, ed eventuali comportamenti che indicano un livello basso.
- "descrizioneTrappola" (uso interno): cosa è sbagliato e cosa dovrebbe notare il candidato. Vuota se nessuna trappola.
- rispetta ref, mittente, ritardo, categoria, critica, trappola e sotto-dimensioni del piano.`
      : `Per ogni domanda:
- "testo": una situazione lavorativa concreta e la domanda, coerente con lo scenario. Livello adatto a ${seniority}.
- "outputAISimulato": se il piano prevede output AI, scrivi l'output completo e realistico che uno strumento AI avrebbe prodotto, con la trappola inserita in modo naturale; altrimenti stringa vuota.
- domande a scelta: 4 alternative di comportamento plausibili e di lunghezza simile, esattamente una "migliore", almeno una "da_evitare". Domande aperte: "opzioni" vuoto.
- "comportamentoAtteso" (uso interno): comportamenti osservabili attesi, collegati ai livelli alti della griglia.
- "descrizioneTrappola" (uso interno): cosa è sbagliato e cosa dovrebbe notare il candidato. Vuota se nessuna trappola.
- rispetta ref, blocco, tipo, trappola e sotto-dimensioni del piano.`;

  return `${bloccoInput(i)}

SENIORITY: ${seniority} · DURATA: ${durata} minuti
SETTORE DELLO SCENARIO: ${sc.settoreScenario}

ISTRUZIONI GIÀ SCRITTE PER IL CANDIDATO:
"""
${sc.istruzioni}
"""

PERSONAGGI:
${sc.personaggi.map((p) => `- ${p.nome}, ${p.ruolo} (${p.relazione})`).join("\n")}

PIANO COMPLETO (per coerenza tra gli elementi):
${pianoCompleto}

SOTTO-DIMENSIONI COINVOLTE:
${catalogoPerPrompt(subIds)}

${specifico}
${note ? `\nINDICAZIONI AGGIUNTIVE PER QUESTA GENERAZIONE (da rispettare):\n${note}\n` : ""}
COMPITO: scrivi in forma completa SOLO questi elementi: ${refs.join(", ")}. Testi per il candidato in ${LINGUA[i.lingua]}; campi interni (comportamento atteso, descrizione trappola, motivazione) in italiano.`;
}

export function promptRegole(feedback: { id: string; esito: string; commento: string; contesto: string }[], esistenti: string[]): string {
  return `Il team Behavium (founder e psicologi) ha lasciato questi feedback su test generati automaticamente.

FEEDBACK:
${feedback.map((f) => `[${f.id}] (${f.esito}) ${f.commento}\n   Contesto: ${f.contesto}`).join("\n")}

REGOLE GIÀ ESISTENTI (non duplicarle):
${esistenti.length ? esistenti.map((r) => `- ${r}`).join("\n") : "(nessuna)"}

COMPITO: ricava regole generali che migliorino i test futuri.
- Una regola è un'istruzione breve e imperativa per l'autore dei test, valida oltre il singolo caso (es. "Per ruoli junior, le trappole normative devono riguardare policy aziendali, non leggi").
- Non trasformare in regola un commento che riguarda solo un dettaglio di quel test.
- Indica l'ambito (tutti, inBasket, situational) e gli id dei feedback da cui deriva.
- Se nessun feedback giustifica una regola nuova, restituisci una lista vuota.`;
}
