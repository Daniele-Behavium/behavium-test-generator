import { gestisci } from "@/lib/api";
import { generaItems } from "@/lib/generatore";

export const maxDuration = 300;

export const POST = gestisci(async (req: Request) => {
  const { input, analisi, scenario, refs, note } = await req.json();
  return generaItems(input, analisi, scenario, refs, note);
});
