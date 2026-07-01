import fitz

template = fitz.open(r"C:\Users\Antonio Garcia\pagina snatnder\sant v4\estado de cuenta.pdf")
mio2 = fitz.open(r"C:\Users\Antonio Garcia\pagina snatnder\sant v4\mio2.pdf")

print("=== TEMPLATE P1 barcode zone ===")
for line in template[0].get_text("dict")["blocks"]:
    if line.get("type") != 0:
        continue
    for l in line["lines"]:
        t = "".join(s["text"] for s in l["spans"]).strip()
        b = l["bbox"]
        if b[1] < 155 and b[0] < 400 and t:
            print(round(b[0], 1), round(b[1], 1), round(b[2], 1), round(b[3], 1), t[:50])

print("\n=== TEMPLATE P2 table headers ===")
for line in template[1].get_text("dict")["blocks"]:
    if line.get("type") != 0:
        continue
    for l in line["lines"]:
        t = "".join(s["text"] for s in l["spans"]).strip()
        b = l["bbox"]
        if 155 < b[1] < 225 and t:
            print(round(b[0], 1), round(b[1], 1), round(b[2], 1), round(b[3], 1), t)

print("\n=== MIO2 P2 table zone ===")
for line in mio2[1].get_text("dict")["blocks"]:
    if line.get("type") != 0:
        continue
    for l in line["lines"]:
        t = "".join(s["text"] for s in l["spans"]).strip()
        b = l["bbox"]
        if 155 < b[1] < 230 and t:
            print(round(b[0], 1), round(b[1], 1), round(b[2], 1), round(b[3], 1), t)

# crop barcode area from template
page = template[0]
pix = page.get_pixmap(clip=fitz.Rect(25, 100, 80, 155), matrix=fitz.Matrix(4, 4))
pix.save(r"C:\Users\Antonio Garcia\pagina snatnder\sant v4\dbg-barcode-left.png")
pix2 = page.get_pixmap(clip=fitz.Rect(45, 105, 370, 150), matrix=fitz.Matrix(3, 3))
pix2.save(r"C:\Users\Antonio Garcia\pagina snatnder\sant v4\dbg-barcode-wide.png")