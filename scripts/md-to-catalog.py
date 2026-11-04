"""Converte il markdown della scheda "Declaratorie e griglie" nel catalogo del generatore.

uso: python3 scripts/md-to-catalog.py tassonomia.md src/catalog/dimensioni.json

import json, re, sys, unicodedata

md, out = sys.argv[1], sys.argv[2]
lines = open(md, encoding="utf-8").read().split("\n")

# id stabili per AI Readiness (già usati in Strapi e nei test salvati)
ID_FISSI = {
    "AI Readiness": "ai-readiness",
    "Comprensione del compito": "air-comprensione-compito",
    "Contestualizzazione": "air-contestualizzazione",
    "Strutturazione dell'analisi": "air-strutturazione-analisi",
    "Controllo epistemico": "air-controllo-epistemico",
    "Definizione dell'output": "air-definizione-output",
}


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


dims, gruppo, dim, sub, usati = [], None, None, None, set()


def nuovo_id(nome, prefisso=""):
    base = ID_FISSI.get(nome) or (prefisso + slug(nome))
    i, cand = 2, base
    while cand in usati:
        cand = f"{base}-{i}"
        i += 1
    usati.add(cand)
    return cand


for ln in lines:
    ln = ln.strip()
    m = re.match(r"^## (\d)\. (.*)$", ln)
    if m:
        gruppo = {"numero": int(m.group(1)), "nome": m.group(2)}
        continue
    if not gruppo:
        continue
    m = re.match(r"^### (.*)$", ln)
    if m:
        nome = m.group(1).strip()
        dim = {"id": nuovo_id(nome), "nome": nome, "gruppo": gruppo["nome"],
               "tipoSkill": "ai" if gruppo["numero"] == 7 else "soft",
               "declaratoria": "", "sottoDimensioni": [], "provvisorio": True}
        dims.append(dim)
        sub = None
        continue
    m = re.match(r"^\*\*(.+?)\.\*\* (.*)$", ln)
    if m and dim:
        sub = {"id": nuovo_id(m.group(1)), "nome": m.group(1), "declaratoria": m.group(2).strip(),
               "griglia": {}, "provvisorio": True}
        dim["sottoDimensioni"].append(sub)
        continue
    m = re.match(r"^\| ([1-5]) \| (.*) \|$", ln)
    if m and sub:
        sub["griglia"][m.group(1)] = m.group(2).strip()
        continue
    if ln and dim and not dim["sottoDimensioni"] and not ln.startswith("|") and not dim["declaratoria"]:
        dim["declaratoria"] = ln

# controlli
for d in dims:
    assert d["declaratoria"], d["nome"]
    assert 2 <= len(d["sottoDimensioni"]) <= 6, d["nome"]
    for s in d["sottoDimensioni"]:
        assert sorted(s["griglia"]) == list("12345"), (d["nome"], s["nome"])

cat = {
    "versione": "bozza-1-2026-11-04",
    "note": "Bozza 1 della tassonomia Behavium (7 gruppi, basata su Spencer & Spencer e metodo BARS), in attesa di validazione da parte degli psicologi. Le declaratorie di AI Readiness sono quelle di Strapi; tutto il resto, griglie incluse, è da validare.",
    "dimensioni": dims,
}
json.dump(cat, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(len(dims), "dimensioni,", sum(len(d["sottoDimensioni"]) for d in dims), "sotto-dimensioni")
print(sorted({d["gruppo"] for d in dims}))
print([s["id"] for s in dims[0]["sottoDimensioni"]], [s["id"] for s in dims[-3]["sottoDimensioni"]])
