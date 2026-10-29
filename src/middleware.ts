import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_AUTH, hashPassword } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next(); // nessuna password impostata (solo sviluppo)
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) return NextResponse.next();
  const cookie = req.cookies.get(COOKIE_AUTH)?.value;
  if (cookie && cookie === (await hashPassword(pw))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("da", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|woff2?)$).*)"],
};
