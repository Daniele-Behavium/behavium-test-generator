"use client";
import { useState } from "react";

export default function Login() {
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [invio, setInvio] = useState(false);

  async function entra(e: React.FormEvent) {
    e.preventDefault();
    setInvio(true);
    setErrore("");
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, password }) });
    if (r.ok) {
      const da = new URLSearchParams(location.search).get("da") || "/";
      location.href = da;
    } else {
      setErrore((await r.json()).errore || "Errore");
      setInvio(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <p className="eyebrow">Accesso riservato</p>
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">Generatore test Behavium</h1>
      <form onSubmit={entra} className="card space-y-4 p-6">
        <div>
          <label className="label">Il tuo nome</label>
          <input className="field" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Dani" autoFocus />
          <p className="hint">Serve per firmare feedback e regole.</p>
        </div>
        <div>
          <label className="label">Password</label>
          <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {errore && <p className="text-sm text-err">{errore}</p>}
        <button className="btn-primary w-full" disabled={invio}>
          Entra
        </button>
      </form>
    </div>
  );
}
