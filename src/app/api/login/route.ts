import { NextResponse } from "next/server";
import { COOKIE_AUTH, COOKIE_NOME, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { password, nome } = await req.json();
  const pw = process.env.APP_PASSWORD;
  if (pw && password !== pw) return NextResponse.json({ errore: "Password errata" }, { status: 401 });
  if (!String(nome ?? "").trim()) return NextResponse.json({ errore: "Inserisci il tuo nome" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 90, path: "/" };
  res.cookies.set(COOKIE_AUTH, pw ? await hashPassword(pw) : "dev", opts);
  res.cookies.set(COOKIE_NOME, encodeURIComponent(String(nome).trim().slice(0, 60)), { ...opts, httpOnly: false });
  return res;
}
