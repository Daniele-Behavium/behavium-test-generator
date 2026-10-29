import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NOME } from "./auth";

export async function nomeUtente(): Promise<string> {
  const c = (await cookies()).get(COOKIE_NOME)?.value;
  return c ? decodeURIComponent(c) : "";
}

export function gestisci<T extends unknown[]>(fn: (...a: T) => Promise<unknown>) {
  return async (...a: T) => {
    try {
      const r = await fn(...a);
      return r instanceof Response ? r : NextResponse.json(r);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ errore: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  };
}
