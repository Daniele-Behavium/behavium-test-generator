// JSON Schema per l'output strutturato di Claude (strict: tutti i campi obbligatori, nessun campo extra).

type S = Record<string, unknown>;
const str = (description?: string): S => ({ type: "string", ...(description ? { description } : {}) });
const num = (description?: string): S => ({ type: "number", ...(description ? { description } : {}) });
const bool = (description?: string): S => ({ type: "boolean", ...(description ? { description } : {}) });
const arr = (items: S, description?: string): S => ({ type: "array", items, ...(description ? { description } : {}) });
const en = (values: string[], description?: string): S => ({ type: "string", enum: values, ...(description ? { description } : {}) });
const obj = (properties: Record<string, S>, description?: string): S => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
  ...(description ? { description } : {}),
});

const TRAPPOLE = ["T-NUM", "T-NORM", "T-FRAME", "T-AUTH", "T-GEN", "T-DATI", "nessuna"];
const CATEGORIE = ["strategicDeadline", "urgentOperational", "personalEmotional", "externalComplaint", "numericReport", "agendaOverlap", "other"];

export const schemaAnalisi = obj({
  seniority: en(["junior", "mid", "senior"]),
  motivazioneSeniority: str(),
  durata: num("Durata consigliata in minuti"),
  motivazioneDurata: str(),
  settoreJD: str("Settore dell'azienda della JD"),
  competenzeRilevate: arr(obj({ nome: str(), fonteJD: str("Citazione o parafrasi breve della JD") })),
  selezione: arr(
    obj({
      dimensioneId: str(),
      peso: num("Peso intero; la somma dei pesi deve fare 100"),
      motivazione: str(),
      sottoDimensioni: arr(obj({ id: str(), motivazione: str("Perché testarla per questo ruolo, con riferimento alla JD") })),
    })
  ),
  fuoriCatalogo: arr(obj({ richiesta: str(), nota: str() }), "Richieste (dal focus o dalla JD) non coperte da nessuna sotto-dimensione del catalogo"),
  esclusioniApplicate: arr(str()),
});

const pianoItem = obj({
  ref: str("E1, E2... per email; Q1, Q2... per domande"),
  blocco: str("Titolo del blocco (solo situazionale, altrimenti stringa vuota)"),
  sottoDimensioni: arr(str()),
  categoria: en(CATEGORIE, "Solo in-basket; per situazionale usa other"),
  critica: bool("Solo in-basket"),
  rispostaAScelta: bool("Solo situazionale"),
  conOutputAI: bool("Solo situazionale: la domanda include un output AI simulato da valutare"),
  trappola: en(TRAPPOLE),
  ideaTrappola: str("Descrizione precisa della trappola, vuota se nessuna"),
  mittente: str("Solo in-basket: nome e ruolo del mittente"),
  ritardo: num("Solo in-basket: minuti dall'inizio"),
  sintesi: str("Cosa succede in questa email o domanda, in 1-3 frasi"),
  motivazione: str("Perché questo elemento misura le sotto-dimensioni indicate"),
});

export const schemaScenario = obj({
  nome: str("Nome del test"),
  settoreScenario: str(),
  istruzioni: str("Istruzioni per il candidato in markdown: contesto aziendale fittizio, ruolo, vincoli, agenda"),
  introduzioneTecnica: str("Regole generali della prova in markdown"),
  personaggi: arr(obj({ nome: str(), ruolo: str(), relazione: str("superiore / pari / collaboratore / esterno") })),
  blocchi: arr(obj({ titolo: str() }), "Solo situazionale; vuoto per in-basket"),
  piano: arr(pianoItem),
});

export const schemaEmail = obj({
  items: arr(
    obj({
      ref: str(),
      mittente: str(),
      destinatario: str(),
      oggetto: str(),
      corpo: str("Testo completo dell'email, in markdown semplice"),
      ritardo: num(),
      critica: bool(),
      contieneTrappola: bool(),
      tipoTrappola: en(TRAPPOLE),
      descrizioneTrappola: str("Uso interno: cosa contiene la trappola e perché è sbagliato. Vuota se nessuna"),
      comportamentoAtteso: str("Uso interno: cosa dovrebbe fare il candidato, comportamenti osservabili"),
      categoria: en(CATEGORIE),
      sottoDimensioni: arr(str()),
      motivazione: str("Per gli psicologi: perché questa email misura le sotto-dimensioni indicate"),
    })
  ),
});

export const schemaDomande = obj({
  items: arr(
    obj({
      ref: str(),
      blocco: str(),
      testo: str("Testo della situazione e della domanda"),
      outputAISimulato: str("Output AI pre-scritto mostrato al candidato, vuoto se non previsto"),
      comportamentoAtteso: str("Uso interno: cosa ci si aspetta dal candidato"),
      rispostaAScelta: bool(),
      opzioni: arr(obj({ testo: str(), valutazione: en(["migliore", "accettabile", "da_evitare"]) }), "Vuoto se domanda aperta"),
      contieneTrappola: bool(),
      tipoTrappola: en(TRAPPOLE),
      descrizioneTrappola: str(),
      sottoDimensioni: arr(str()),
      motivazione: str("Per gli psicologi: perché questa domanda misura le sotto-dimensioni indicate"),
    })
  ),
});

export const schemaRegoleProposte = obj({
  regole: arr(
    obj({
      testo: str("Regola generale, imperativa, applicabile ai test futuri"),
      ambito: en(["tutti", "inBasket", "situational"]),
      feedbackIds: arr(str()),
    })
  ),
});
