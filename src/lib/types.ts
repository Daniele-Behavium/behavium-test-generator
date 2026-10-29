// Tipi condivisi tra client e server.

export type TipoTest = "inBasket" | "situational";
export type ContestoUso = "recruiting" | "workforce";
export type Seniority = "junior" | "mid" | "senior";
export type Lingua = "it" | "en";
export type SettoreScenario = "diverso" | "stesso";

// ---------- Catalogo ----------
export interface SottoDimensione {
  id: string;
  nome: string;
  declaratoria: string;
  griglia: Record<"1" | "2" | "3" | "4" | "5", string>;
  provvisorio?: boolean;
}
export interface Dimensione {
  id: string;
  nome: string;
  tipoSkill: "soft" | "ai";
  declaratoria: string;
  sottoDimensioni: SottoDimensione[];
  provvisorio?: boolean;
}
export interface Catalogo {
  versione: string;
  note?: string;
  dimensioni: Dimensione[];
}

// ---------- Input del form ----------
export interface InputTest {
  jobTitle: string;
  jd: string;
  focus: string;
  esclusioni: string;
  tipo: TipoTest;
  contesto: ContestoUso;
  seniority?: Seniority;
  durata?: number;
  lingua: Lingua;
  settoreScenario: SettoreScenario;
}

// ---------- Fase 1: analisi ----------
export interface SelezioneSottoDim {
  id: string;
  motivazione: string;
}
export interface SelezioneDimensione {
  dimensioneId: string;
  peso: number;
  motivazione: string;
  sottoDimensioni: SelezioneSottoDim[];
}
export interface Analisi {
  seniority: Seniority;
  motivazioneSeniority: string;
  durata: number;
  motivazioneDurata: string;
  settoreJD: string;
  competenzeRilevate: { nome: string; fonteJD: string }[];
  selezione: SelezioneDimensione[];
  fuoriCatalogo: { richiesta: string; nota: string }[];
  esclusioniApplicate: string[];
}

// ---------- Fase 2: piano ----------
export type CategoriaEmail =
  | "strategicDeadline"
  | "urgentOperational"
  | "personalEmotional"
  | "externalComplaint"
  | "numericReport"
  | "agendaOverlap"
  | "other";

export type TipoTrappola = "T-NUM" | "T-NORM" | "T-FRAME" | "T-AUTH" | "T-GEN" | "T-DATI" | "nessuna";

export interface PianoItem {
  ref: string; // es. "E1" o "Q1"
  blocco?: string; // solo situazionale
  sottoDimensioni: string[];
  categoria?: CategoriaEmail; // solo in-basket
  critica?: boolean; // solo in-basket
  rispostaAScelta?: boolean; // solo situazionale
  conOutputAI?: boolean; // solo situazionale
  trappola: TipoTrappola;
  ideaTrappola: string;
  mittente?: string;
  ritardo?: number;
  sintesi: string;
  motivazione: string;
}

export interface Scenario {
  nome: string;
  settoreScenario: string;
  istruzioni: string; // markdown: contesto, ruolo, vincoli, agenda
  introduzioneTecnica: string;
  personaggi: { nome: string; ruolo: string; relazione: string }[];
  blocchi: { titolo: string }[]; // solo situazionale
  piano: PianoItem[];
}

// ---------- Fase 3: item ----------
export interface EmailGenerata {
  ref: string;
  mittente: string;
  destinatario: string;
  oggetto: string;
  corpo: string;
  ritardo: number;
  critica: boolean;
  contieneTrappola: boolean;
  tipoTrappola: TipoTrappola;
  descrizioneTrappola: string;
  comportamentoAtteso: string;
  categoria: CategoriaEmail;
  dimensioni: string[];
  sottoDimensioni: string[];
  motivazione: string;
}

export interface OpzioneRisposta {
  testo: string;
  valutazione: "migliore" | "accettabile" | "da_evitare";
}

export interface DomandaGenerata {
  ref: string;
  blocco: string;
  testo: string;
  outputAISimulato: string;
  comportamentoAtteso: string;
  rispostaAScelta: boolean;
  opzioni: OpzioneRisposta[];
  contieneTrappola: boolean;
  tipoTrappola: TipoTrappola;
  descrizioneTrappola: string;
  dimensioni: string[];
  sottoDimensioni: string[];
  motivazione: string;
}

export interface TestGenerato {
  nome: string;
  tipo: TipoTest;
  contesto: ContestoUso;
  ruoloTarget: string;
  seniority: Seniority;
  durata: number;
  lingua: Lingua;
  settoreScenario: string;
  istruzioni: string;
  introduzioneTecnica: string;
  personaggi: Scenario["personaggi"];
  dimensioni: SelezioneDimensione[];
  email: EmailGenerata[];
  blocchi: { titolo: string; domande: DomandaGenerata[] }[];
}

export interface Problema {
  livello: "errore" | "avviso";
  ref?: string;
  messaggio: string;
}

export interface RecordTest {
  id: string;
  created_at: string;
  autore: string;
  stato: "bozza" | "approvato" | "scartato";
  input: InputTest;
  analisi: Analisi;
  test: TestGenerato;
  problemi: Problema[];
  modello: string;
  costo: number;
  catalogo_versione: string;
}

export interface Feedback {
  id: string;
  created_at: string;
  test_id: string;
  item_ref: string | null;
  esito: "ok" | "da_rivedere";
  commento: string;
  autore: string;
  elaborato: boolean;
}

export interface Regola {
  id: string;
  created_at: string;
  testo: string;
  ambito: "tutti" | "inBasket" | "situational";
  stato: "proposta" | "approvata" | "scartata";
  origine: string; // "manuale" o elenco id feedback
  autore: string;
}
