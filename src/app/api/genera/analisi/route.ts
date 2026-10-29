import { gestisci } from "@/lib/api";
import { analizza } from "@/lib/generatore";

export const maxDuration = 300;

export const POST = gestisci(async (req: Request) => {
  const { input } = await req.json();
  if (!input?.jd?.trim() || !input?.jobTitle?.trim()) throw new Error("Job title e JD sono obbligatori");
  return analizza(input);
});
