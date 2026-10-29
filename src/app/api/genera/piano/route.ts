import { gestisci } from "@/lib/api";
import { pianifica } from "@/lib/generatore";

export const maxDuration = 300;

export const POST = gestisci(async (req: Request) => {
  const { input, analisi, errori } = await req.json();
  return pianifica(input, analisi, errori);
});
