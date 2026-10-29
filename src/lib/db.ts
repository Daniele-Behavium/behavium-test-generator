import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Feedback, RecordTest, Regola, TipoTest } from "./types";

// Se Supabase è configurato usa il database; altrimenti (solo sviluppo locale) un file JSON.

let sb: SupabaseClient | null = null;
function supabase(): SupabaseClient | null {
  if (sb) return sb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  sb = createClient(url, key, { auth: { persistSession: false } });
  return sb;
}

// ---------- fallback locale ----------
interface DevDb { tests: RecordTest[]; feedback: Feedback[]; regole: Regola[] }
const DEV_FILE = path.join(process.cwd(), ".dev-db.json");
async function leggiDev(): Promise<DevDb> {
  try {
    return JSON.parse(await fs.readFile(DEV_FILE, "utf8"));
  } catch {
    return { tests: [], feedback: [], regole: [] };
  }
}
async function scriviDev(db: DevDb) {
  await fs.writeFile(DEV_FILE, JSON.stringify(db, null, 2));
}
function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

// ---------- tests ----------
export async function salvaTest(t: Omit<RecordTest, "id" | "created_at">): Promise<string> {
  const s = supabase();
  if (s) return (ok(await s.from("tests").insert(t).select("id").single()) as { id: string }).id;
  const db = await leggiDev();
  const id = randomUUID();
  db.tests.unshift({ ...t, id, created_at: new Date().toISOString() });
  await scriviDev(db);
  return id;
}

export async function getTest(id: string): Promise<RecordTest | null> {
  const s = supabase();
  if (s) return (await s.from("tests").select("*").eq("id", id).maybeSingle()).data as RecordTest | null;
  return (await leggiDev()).tests.find((t) => t.id === id) ?? null;
}

export async function listaTest(): Promise<Pick<RecordTest, "id" | "created_at" | "autore" | "stato" | "input" | "costo">[]> {
  const s = supabase();
  if (s) return ok(await s.from("tests").select("id,created_at,autore,stato,input,costo").order("created_at", { ascending: false }).limit(200));
  return (await leggiDev()).tests;
}

export async function aggiornaTest(id: string, patch: Partial<Pick<RecordTest, "stato" | "test" | "problemi" | "costo">>) {
  const s = supabase();
  if (s) {
    ok(await s.from("tests").update(patch).eq("id", id));
    return;
  }
  const db = await leggiDev();
  const t = db.tests.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  await scriviDev(db);
}

/** Test approvati dello stesso tipo, da usare come esempi di riferimento. */
export async function testApprovati(tipo: TipoTest, n = 2): Promise<RecordTest[]> {
  const s = supabase();
  if (s)
    return ok(await s.from("tests").select("*").eq("stato", "approvato").eq("input->>tipo", tipo).order("created_at", { ascending: false }).limit(n));
  return (await leggiDev()).tests.filter((t) => t.stato === "approvato" && t.input.tipo === tipo).slice(0, n);
}

// ---------- feedback ----------
export async function aggiungiFeedback(f: Omit<Feedback, "id" | "created_at" | "elaborato">): Promise<Feedback> {
  const s = supabase();
  if (s) return ok(await s.from("feedback").insert({ ...f, elaborato: false }).select("*").single());
  const db = await leggiDev();
  const r: Feedback = { ...f, id: randomUUID(), created_at: new Date().toISOString(), elaborato: false };
  db.feedback.push(r);
  await scriviDev(db);
  return r;
}

export async function feedbackDelTest(testId: string): Promise<Feedback[]> {
  const s = supabase();
  if (s) return ok(await s.from("feedback").select("*").eq("test_id", testId).order("created_at"));
  return (await leggiDev()).feedback.filter((f) => f.test_id === testId);
}

export async function feedbackDaElaborare(): Promise<Feedback[]> {
  const s = supabase();
  if (s) return ok(await s.from("feedback").select("*").eq("elaborato", false).neq("commento", "").order("created_at").limit(100));
  return (await leggiDev()).feedback.filter((f) => !f.elaborato && f.commento);
}

export async function segnaElaborati(ids: string[]) {
  if (!ids.length) return;
  const s = supabase();
  if (s) {
    ok(await s.from("feedback").update({ elaborato: true }).in("id", ids));
    return;
  }
  const db = await leggiDev();
  for (const f of db.feedback) if (ids.includes(f.id)) f.elaborato = true;
  await scriviDev(db);
}

// ---------- regole ----------
export async function listaRegole(): Promise<Regola[]> {
  const s = supabase();
  if (s) return ok(await s.from("regole").select("*").order("created_at", { ascending: false }));
  return (await leggiDev()).regole;
}

export async function regoleApprovate(tipo: TipoTest): Promise<Regola[]> {
  return (await listaRegole()).filter((r) => r.stato === "approvata" && (r.ambito === "tutti" || r.ambito === tipo));
}

export async function aggiungiRegole(rs: Omit<Regola, "id" | "created_at">[]) {
  if (!rs.length) return;
  const s = supabase();
  if (s) {
    ok(await s.from("regole").insert(rs));
    return;
  }
  const db = await leggiDev();
  for (const r of rs) db.regole.unshift({ ...r, id: randomUUID(), created_at: new Date().toISOString() });
  await scriviDev(db);
}

export async function aggiornaRegola(id: string, patch: Partial<Pick<Regola, "testo" | "ambito" | "stato">>) {
  const s = supabase();
  if (s) {
    ok(await s.from("regole").update(patch).eq("id", id));
    return;
  }
  const db = await leggiDev();
  const r = db.regole.find((x) => x.id === id);
  if (r) Object.assign(r, patch);
  await scriviDev(db);
}
