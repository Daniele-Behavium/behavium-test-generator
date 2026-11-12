// Scala di valutazione delle opzioni nelle domande a scelta (situazionale).
// Ogni domanda a scelta ha 4 opzioni, una per livello: nessun livello si ripete.
// Il peso è quello che va in Strapi (campo "Peso" dell'opzione, da 0 a 1).

export const VALUTAZIONI = [
  { id: "migliore", nome: "Migliore", peso: 1 },
  { id: "accettabile", nome: "Accettabile", peso: 0.66 },
  { id: "discreta", nome: "Discreta", peso: 0.33 },
  { id: "da_evitare", nome: "Da evitare", peso: 0 },
] as const;

export type Valutazione = (typeof VALUTAZIONI)[number]["id"];
export const ID_VALUTAZIONI = VALUTAZIONI.map((v) => v.id) as Valutazione[];

const per = new Map<string, (typeof VALUTAZIONI)[number]>(VALUTAZIONI.map((v) => [v.id, v]));
export const nomeValutazione = (id: string) => per.get(id)?.nome ?? id;
export const pesoValutazione = (id: string) => per.get(id)?.peso ?? 0;
/** Peso scritto all'italiana, come lo chiede Strapi: 0,66 */
export const pesoTesto = (id: string) => String(pesoValutazione(id)).replace(".", ",");
/** "Accettabile (0,66)" */
export const etichettaValutazione = (id: string) => `${nomeValutazione(id)} (${pesoTesto(id)})`;
