// Conversione del test generato nel formato da importare in Strapi.
// ATTENZIONE: i nomi dei campi sono ricavati dagli screenshot del pannello Strapi e vanno
// allineati agli schema.json reali quando il repository sarà disponibile (step 2).
// Sotto-dimensione e motivazione di ogni elemento NON vengono esportate: servono solo alla revisione.

import type { TestGenerato } from "./types";

export function versoStrapi(t: TestGenerato) {
  return {
    name: t.nome,
    type: t.tipo,
    entityStatus: "draft",
    usageContext: t.contesto,
    targetRole: t.ruoloTarget,
    seniority: t.seniority,
    durationMinutes: t.durata,
    instructions: t.istruzioni,
    technicalIntroduction: t.introduzioneTecnica,
    scoringCriteria: t.dimensioni.map((d) => ({
      dimension: d.dimensioneId,
      weight: d.peso,
      subDimensions: d.sottoDimensioni.map((s) => s.id),
    })),
    ...(t.tipo === "inBasket"
      ? {
          emails: t.email.map((e) => ({
            sender: e.mittente,
            recipient: e.destinatario,
            subject: e.oggetto,
            body: e.corpo,
            delayMinutes: e.ritardo,
            flagCritical: e.critica,
            flagTrap: e.contieneTrappola,
            trapDescription: e.descrizioneTrappola,
            expectedBehavior: e.comportamentoAtteso,
            category: e.categoria,
            dimensions: e.dimensioni,
          })),
        }
      : {
          blocks: t.blocchi.map((b) => ({
            title: b.titolo,
            questions: b.domande.map((d) => ({
              text: d.testo,
              simulatedAiOutput: d.outputAISimulato,
              expectedBehavior: d.comportamentoAtteso,
              isMultipleChoice: d.rispostaAScelta,
              responseOptions: d.opzioni.map((o) => ({ text: o.testo, evaluation: o.valutazione })),
              dimensions: d.dimensioni,
            })),
          })),
        }),
  };
}
