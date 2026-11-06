"""Generate the phone-sized actor cue script. Requires reportlab, pypdf, pymupdf.

Run from any directory: python output/pdf/pre-bot/gerar_pdf.py
Source: roteiro.json beside this script. No application state or network access.
"""

from pathlib import Path
import json
from xml.sax.saxutils import escape

import pymupdf as fitz
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

HERE = Path(__file__).resolve().parent
DEST = HERE.parent / "roteiro-pre-bot-celular.pdf"
PREVIEWS = Path("/private/tmp/pre-bot-pdf-qa")
W, H, M = 390, 780, 25
INK = colors.HexColor("#F2F4ED")
MUTED = colors.HexColor("#BAC9BE")
GREEN = colors.HexColor("#B2EDC9")
GOLD = colors.HexColor("#EEC88C")
BG = colors.HexColor("#101A15")
RULE = colors.HexColor("#33483B")

for name, filename in [("Cue", "Arial.ttf"), ("Cue-Bold", "Arial Bold.ttf")]:
    pdfmetrics.registerFont(TTFont(name, "/System/Library/Fonts/Supplemental/" + filename))
pdfmetrics.registerFontFamily("Cue", normal="Cue", bold="Cue-Bold", italic="Cue", boldItalic="Cue-Bold")

styles = {
    "title": ParagraphStyle("title", fontName="Cue-Bold", fontSize=29, leading=32, textColor=INK),
    "body": ParagraphStyle("body", fontName="Cue", fontSize=17.2, leading=23, textColor=INK),
    "action": ParagraphStyle("action", fontName="Cue", fontSize=15.8, leading=21, textColor=MUTED),
    "heading": ParagraphStyle("heading", fontName="Cue-Bold", fontSize=12.5, leading=16, textColor=GREEN),
    "cue": ParagraphStyle("cue", fontName="Cue-Bold", fontSize=11.8, leading=16, textColor=GOLD),
    "small": ParagraphStyle("small", fontName="Cue", fontSize=13, leading=17.5, textColor=MUTED),
    "row": ParagraphStyle("row", fontName="Cue-Bold", fontSize=18.5, leading=23, textColor=INK),
}
for style in styles.values():
    style.alignment = TA_LEFT
    style.splitLongWords = False
    style.allowWidows = False
    style.allowOrphans = False

data = json.loads((HERE / "roteiro.json").read_text())
pdf = canvas.Canvas(str(DEST), pagesize=(W, H), pageCompression=1)
pdf.setTitle(data["title"])
pdf.setAuthor("Victor Cappa")
pdf.setSubject("Roteiro de consulta para celular, baseado nas notas do ensaio 30/10")
pdf.setPageSize((W, H))
layout = []


def para(text, style, x, y, width=None, gap=8):
    width = width or W - 2 * M
    content = escape(text).replace("\n", "<br/>")
    p = Paragraph(content, styles[style])
    _, height = p.wrap(width, H)
    if y - height < 61:
        raise ValueError(f"Page {page_num}: content exceeds phone page: {text[:70]!r}, bottom={y-height:.1f}")
    p.drawOn(pdf, x, y - height)
    layout.append({"page": page_num, "style": style, "bottom": round(y-height, 2), "text": text})
    return y - height - gap


def footer(page, count):
    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(.6)
    pdf.line(M, 47, W - M, 47)
    pdf.setFont("Cue", 9.3)
    pdf.setFillColor(MUTED)
    pdf.drawString(M, 28, "PRÉ-BOT / SUMÁRIO")
    pdf.linkRect("Voltar ao sumário", "page-1", (M, 17, 144, 42), relative=0, thickness=0)
    pdf.setFont("Cue-Bold", 10)
    pdf.setFillColor(GREEN)
    pdf.drawRightString(W - M, 28, f"{page:02d} / {count:02d}")


for page_num, page in enumerate(data["pages"], 1):
    pdf.setFillColor(BG)
    pdf.rect(0, 0, W, H, fill=1, stroke=0)
    pdf.bookmarkPage(f"page-{page_num}")
    pdf.addOutlineEntry(page["title"].replace("\n", " "), f"page-{page_num}", 0)
    pdf.setFillColor(GREEN)
    pdf.setFont("Cue-Bold", 10)
    pdf.drawString(M, H - 34, page["tag"])
    y = para(page["title"], "title", M, H - 55, gap=16)

    if page.get("type") == "map":
        y = para(page["subtitle"], "action", M, y, gap=19)
        for row in page["rows"]:
            top = y
            pdf.setFillColor(GREEN)
            pdf.setFont("Cue-Bold", 16)
            pdf.drawString(M, y - 18, row["number"])
            y = para(row["title"], "row", M + 39, y, width=W - 2*M - 39, gap=3)
            y = para(row["detail"], "small", M + 39, y, width=W - 2*M - 39, gap=15)
            pdf.linkRect(row["title"], f"page-{row['page']}", (M, y + 4, W-M, top+4), relative=0, thickness=0)
        y -= 3
        for reminder in page["reminders"]:
            y = para(reminder, "cue", M, y, gap=4)
        y -= 9
        y = para(page["note"], "small", M, y, gap=0)
    else:
        for block in page["blocks"]:
            y = para(block["heading"].upper(), "heading", M, y, gap=5)
            if block.get("sayFirst") and block.get("say"):
                y = para("“" + block["say"] + "”", "body", M, y, gap=7)
            if block.get("action"):
                y = para(block["action"], "action", M, y, gap=7)
            if block.get("say") and not block.get("sayFirst"):
                y = para("“" + block["say"] + "”", "body", M, y, gap=7)
            for item in block.get("items", []):
                y = para(item, "body", M, y, gap=5)
            if block.get("cue"):
                y = para(block["cue"], "cue", M, y, gap=6)
            if block.get("note"):
                y = para(block["note"], "small", M, y, gap=7)
            y -= 12
        if page.get("source"):
            source = page["source"]
            top = y
            y = para(source["label"], "small", M, y, gap=0)
            pdf.linkURL(source["url"], (M, y, W-M, top), relative=0, thickness=0)

    footer(page_num, len(data["pages"]))
    pdf.showPage()

pdf.save()
reader = PdfReader(DEST)
assert len(reader.pages) == len(data["pages"])
assert all(tuple(float(v) for v in p.mediabox[2:]) == (W, H) for p in reader.pages)
text = "\n".join(p.extract_text() or "" for p in reader.pages)
plain = " ".join(text.split())
for required in ["ensaio 30/10", "iluminador", "diretor técnico", "máquina está em treinamento", "CENTRO: bexigas", "ESQUERDA: forca + disco", "DIREITA: toca-discos"]:
    assert required in plain, required
assert "\ufffd" not in text
PREVIEWS.mkdir(exist_ok=True, parents=True)
document = fitz.open(DEST)
for number, page in enumerate(document, 1):
    page.get_pixmap(matrix=fitz.Matrix(1.8, 1.8)).save(PREVIEWS / f"pagina-{number:02d}.png")
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            x0, y0, x1, y1 = line["bbox"]
            assert x0 >= M-1 and x1 <= W-M+1 and y0 > 0 and y1 < H, (number, line)
report = {"pages": len(reader.pages), "size_points": [W,H], "bytes": DEST.stat().st_size,
          "body_font_points": 17.2, "minimum_content_bottom": min(x["bottom"] for x in layout),
          "internal_and_external_links": sum(len(page.get_links()) for page in document),
          "text_checks": "passed", "bounds_checks": "passed", "previews": str(PREVIEWS)}
(PREVIEWS / "qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
(PREVIEWS / "texto-extraido.txt").write_text(text)
print(json.dumps({"pdf": str(DEST), **report}, ensure_ascii=False, indent=2))
