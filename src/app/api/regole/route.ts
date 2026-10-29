import { gestisci, nomeUtente } from "@/lib/api";
import { aggiungiRegole, listaRegole } from "@/lib/db";

export const GET = gestisci(async () => listaRegole());

export const POST = gestisci(async (req: Request) => {
  const { testo, ambito } = await req.json();
  if (!String(testo ?? "").trim()) throw new Error("Testo vuoto");
  await aggiungiRegole([{ testo: String(testo).trim(), ambito: ambito || "tutti", stato: "approvata", origine: "manuale", autore: await nomeUtente() }]);
  return { ok: true };
});
