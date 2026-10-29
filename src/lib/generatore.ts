import "server-only";
import type { Analisi, DomandaGenerata, EmailGenerata, InputTest, Problema, Scenario, PianoItem } from "./types";
import { chiamaAI } from "./openrouter";
import { schemaAnalisi, schemaScenario, schemaEmail, schemaDomande } from "./schemi";
import { SYSTEM_BASE, bloccoEsempi, bloccoRegoleApprese, promptAnalisi, promptItems, promptScenario } from "./prompts";
import { validaPiano } from "./regole";
import { getSottoDimensione, dimensioneDi } from "./catalog";
import { regoleApprovate, testApprovati } from "./db";

async function systemCompleto(tipo: InputTest["tipo"], conEsempi: boolean) {
  const [regole, esempi] = await Promise.all([regoleApprovate(tipo), conEsempi ? testApprovati(tipo, 2) : Promise.resolve([])]);
  return SYSTEM_BASE + bloccoRegoleApprese(regole) + bloccoEsempi(esempi);
}

// ---------- Fase 1 ----------
export async function analizza(input: InputTest) {
  const r = await chiamaAI<Analisi>({
    system: await systemCompleto(input.tipo, false),
    user: promptAnalisi(input),
    schemaName: "analisi",
    schema: schemaAnalisi,
    maxTokens: 6000,
    temperature: 0.3,
  });
  const a = r.dati;
  // Pulizia: tieni solo id validi e coerenti con il catalogo.
  a.selezione = a.selezione
    .map((d) => ({ ...d, sottoDimensioni: d.sottoDimensioni.filter((s) => dimensioneDi(s.id) === d.dimensioneId) }))
    .filter((d) => d.sottoDimensioni.length > 0);
  a.durata = Math.round(a.durata);
  return { analisi: a, costo: r.costo, modello: r.modello };
}

// ---------- Fase 2 ----------
export async function pianifica(input: InputTest, analisi: Analisi) {
  const system = await systemCompleto(input.tipo, true);
  const durata = input.durata ?? analisi.durata;
  let costo = 0;
  let errori = "";
  let scenario: Scenario | null = null;
  let problemi: Problema[] = [];
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    const r = await chiamaAI<Scenario>({
      system,
      user: promptScenario(input, analisi, errori || undefined),
      schemaName: "scenario",
      schema: schemaScenario,
      maxTokens: 12000,
    });
    costo += r.costo;
    scenario = normalizzaPiano(input, r.dati);
    problemi = validaPiano(input.tipo, durata, scenario, analisi.selezione);
    const err = problemi.filter((p) => p.livello === "errore");
    if (!err.length) break;
    errori = err.map((p) => `- ${p.ref ? p.ref + ": " : ""}${p.messaggio}`).join("\n");
  }
  return { scenario: scenario!, problemi, costo };
}

function normalizzaPiano(input: InputTest, s: Scenario): Scenario {
  const piano: PianoItem[] = s.piano.map((p) =>
    input.tipo === "inBasket"
      ? { ...p, blocco: undefined, rispostaAScelta: undefined, conOutputAI: undefined, ritardo: Math.round(p.ritardo ?? 0) }
      : { ...p, categoria: undefined, critica: undefined, mittente: undefined, ritardo: undefined }
  );
  if (input.tipo === "inBasket") piano.sort((x, y) => (x.ritardo ?? 0) - (y.ritardo ?? 0));
  return { ...s, blocchi: input.tipo === "inBasket" ? [] : s.blocchi, piano };
}

// ---------- Fase 3 ----------
export async function generaItems(input: InputTest, analisi: Analisi, scenario: Scenario, refs: string[], note?: string) {
  const system = await systemCompleto(input.tipo, false);
  const r = await chiamaAI<{ items: (EmailGenerata | DomandaGenerata)[] }>({
    system,
    user: promptItems(input, analisi, scenario, refs, note),
    schemaName: input.tipo === "inBasket" ? "email" : "domande",
    schema: input.tipo === "inBasket" ? schemaEmail : schemaDomande,
    maxTokens: 16000,
  });
  const items = r.dati.items
    .filter((it) => refs.includes(it.ref))
    .map((it) => {
      const subs = it.sottoDimensioni.filter((s) => getSottoDimensione(s));
      const dims = Array.from(new Set(subs.map((s) => dimensioneDi(s)!)));
      if (input.tipo === "inBasket") return { ...(it as EmailGenerata), ritardo: Math.round((it as EmailGenerata).ritardo), sottoDimensioni: subs, dimensioni: dims };
      const d = it as DomandaGenerata;
      return { ...d, opzioni: d.rispostaAScelta ? d.opzioni : [], sottoDimensioni: subs, dimensioni: dims };
    });
  return { items, costo: r.costo };
}

