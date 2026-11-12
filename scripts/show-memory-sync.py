"""Extract every page without editing the source PDF; runtime needs only the JSON."""
import hashlib
import json
from pathlib import Path

import pymupdf

root = Path(__file__).resolve().parent.parent
for source_name, target_name, bibliography in [
    ("Texto caixa preta.pdf", "texto-caixa-preta.json", {}),
    ("assets/dramaturgia/proximas-etapas-da-peca.pdf", "proximas-etapas-da-peca.json", {}),
    ("assets/referencias/labirinto-de-labirintos-marcus-garcia-2025.pdf", "labirinto-de-labirintos.json", {
        "title": "Labirinto de Labirintos: o trabalho técnico entre o aprisionamento e a possibilidade no teatro",
        "author": "Marcus Vinícius de Melo Garcia", "year": 2025,
        "institution": "Escola de Comunicações e Artes, Universidade de São Paulo",
        "degree": "Mestrado em Artes Cênicas", "version": "Versão corrigida",
        "advisor": "Cibele Forjaz Simões",
        "sourceUrl": "https://teses.usp.br/teses/disponiveis/27/27162/tde-27032025-140432/publico/MarcusViniciusdeMeloGarciacorrigidaPPGAC5434469.pdf",
        "rights": "Reprodução e divulgação para estudo e pesquisa, desde que citada a fonte (PDF, página 3).",
        "pageNumbering": "Números referem-se à posição da página no PDF, começando pela capa."
    }),
]:
    source = root / source_name
    with pymupdf.open(source) as pdf:
        pages = [{"number": i + 1, "text": page.get_text("text", sort=True).strip()}
                 for i, page in enumerate(pdf)]
        if not pages or any(not page["text"] for page in pages):
            raise RuntimeError("PDF com página sem texto: revisar extração/OCR antes de publicar o acervo")
        result = {"schemaVersion": 1, "source": source_name,
                  "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                  "textSha256": hashlib.sha256("\f".join(page["text"] for page in pages).encode()).hexdigest(),
                  "extractor": "PyMuPDF page.get_text(text, sort=True)",
                  "metadata": {**pdf.metadata, **bibliography}, "pageCount": len(pages), "pages": pages}
    target = root / "knowledge/sources" / target_name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"Extraídas {len(pages)} páginas: {target.relative_to(root)}")
