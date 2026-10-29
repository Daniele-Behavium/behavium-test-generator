import type { Analisi, DomandaGenerata, EmailGenerata, InputTest, Scenario, TestGenerato } from "./types";

// ---------- Assemblaggio ----------
export function assembla(input: InputTest, analisi: Analisi, scenario: Scenario, items: (EmailGenerata | DomandaGenerata)[]): TestGenerato {
  const ordine = new Map(scenario.piano.map((p, i) => [p.ref, i]));
  const ordinati = [...items].sort((a, b) => (ordine.get(a.ref) ?? 0) - (ordine.get(b.ref) ?? 0));
  return {
    nome: scenario.nome,
    tipo: input.tipo,
    contesto: input.contesto,
    ruoloTarget: input.jobTitle,
    seniority: input.seniority ?? analisi.seniority,
    durata: input.durata ?? analisi.durata,
    lingua: input.lingua,
    settoreScenario: scenario.settoreScenario,
    istruzioni: scenario.istruzioni,
    introduzioneTecnica: scenario.introduzioneTecnica,
    personaggi: scenario.personaggi,
    dimensioni: analisi.selezione,
    email: input.tipo === "inBasket" ? (ordinati as EmailGenerata[]) : [],
    blocchi: input.tipo === "situational" ? raggruppaBlocchi(scenario, ordinati as DomandaGenerata[]) : [],
  };
}

function raggruppaBlocchi(scenario: Scenario, domande: DomandaGenerata[]) {
  const titoli = scenario.blocchi.length ? scenario.blocchi.map((b) => b.titolo) : ["Blocco 1"];
  const blocchi = titoli.map((titolo) => ({ titolo, domande: [] as DomandaGenerata[] }));
  for (const d of domande) {
    const b = blocchi.find((x) => x.titolo === d.blocco) ?? blocchi[0];
    b.domande.push({ ...d, blocco: b.titolo });
  }
  return blocchi.filter((b) => b.domande.length);
}
