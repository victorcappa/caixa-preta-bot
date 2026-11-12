"""Extract every page without editing the source PDF; runtime needs only the JSON."""
import hashlib
import json
from pathlib import Path

import pymupdf

root = Path(__file__).resolve().parent.parent
source = root / "Texto caixa preta.pdf"
with pymupdf.open(source) as pdf:
    pages = [{"number": i + 1, "text": page.get_text("text", sort=True).strip()}
             for i, page in enumerate(pdf)]
    if not pages or any(not page["text"] for page in pages):
        raise RuntimeError("PDF com página sem texto: revisar extração/OCR antes de publicar o acervo")
    result = {"schemaVersion": 1, "source": source.name,
              "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "textSha256": hashlib.sha256("\f".join(page["text"] for page in pages).encode()).hexdigest(),
              "extractor": "PyMuPDF page.get_text(text, sort=True)",
              "metadata": pdf.metadata, "pageCount": len(pages), "pages": pages}
target = root / "knowledge/sources/texto-caixa-preta.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(f"Extraídas {len(pages)} páginas: {target.relative_to(root)}")
