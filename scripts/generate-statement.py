#!/usr/bin/env python3
"""Genera estado de cuenta duplicando el PDF plantilla y superponiendo datos del usuario."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from io import BytesIO
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "estado de cuenta.pdf"

MONTHS_UPPER = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
PRODUCT = "CUENTA DIGITAL"
TEMPLATE_NAME = "MUNICIPIO DE PUERTO VALLARTA JALISCO"
TEMPLATE_CLIENT_CODE = "30307689"
TEMPLATE_RFC = "MPV1806054D2"
TEMPLATE_PHONE = "55 5169 4300"


def parse_amount(value) -> float:
    if value is None:
        return 0.0
    clean = re.sub(r"[^\d.-]", "", str(value))
    try:
        return float(clean or 0)
    except ValueError:
        return 0.0


def format_amount(value) -> str:
    num = parse_amount(value)
    negative = num < 0
    num = abs(num)
    whole, frac = f"{num:.2f}".split(".")
    whole = f"{int(whole):,}"
    result = f"{whole}.{frac}"
    return f"-{result}" if negative else result


def format_account(account: str) -> str:
    digits = re.sub(r"\D", "", account or "").zfill(11)[-11:]
    return f"{digits[:2]}-{digits[2:10]}-{digits[10]}"


def client_code(account: str) -> str:
    return re.sub(r"\D", "", account or "").zfill(8)[-8:]


def generate_clabe(account: str) -> str:
    account_digits = re.sub(r"\D", "", account or "").zfill(11)[-11:]
    base = f"014129{account_digits}"
    weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7]
    total = sum((int(base[i]) * weights[i]) % 10 for i in range(17))
    check = (10 - (total % 10)) % 10
    return f"{base}{check}"


def generate_rfc(name: str, subtitle: str) -> str:
    n = (name or "USUARIO").strip().upper().split()
    s = (subtitle or "SN").strip().upper().split()
    p1 = (n[0] if n else "X")[0]
    p2 = (n[1] if len(n) > 1 else n[0] if n else "X")[0]
    p3 = (s[0] if s else "X")[0]
    p4 = (s[1] if len(s) > 1 else s[0] if s else "X")[0]
    return f"{p1}{p2}{p3}{p4}900101XX0"[:13]


def fmt_period_date(value) -> str:
    if isinstance(value, str):
        dt = datetime.strptime(value[:10], "%Y-%m-%d")
    else:
        dt = value
    return f"{dt.day:02d}-{MONTHS_UPPER[dt.month - 1]}-{dt.year}"


def fmt_mov_date(value: str) -> str:
    parts = (value or "").split("-")
    if len(parts) != 3:
        return value or ""
    year = parts[0][-2:]
    return f"{parts[2].zfill(2)}-{MONTHS_UPPER[int(parts[1]) - 1]}-{year}"


def phone_fmt(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "").zfill(10)[-10:]
    return f"{digits[:2]} {digits[2:6]} {digits[6:]}"


def barcode_payload(cc: str, account: str) -> tuple[str, str, str]:
    account_digits = re.sub(r"\D", "", account or "").zfill(10)[-10:]
    prefix = cc[-7:].zfill(7)
    payload = f"06243030{cc}{account_digits}0040037"
    postal = f"P0{cc}"[:9]
    return prefix, payload, postal


def distribution_pct(amount: float) -> str:
    return "100.00" if amount > 0 else "0.00"


def redact_rect(page: fitz.Page, rect: fitz.Rect) -> None:
    page.draw_rect(rect, color=None, fill=(1, 1, 1), width=0, overlay=True)


def redact_text(page: fitz.Page, text: str) -> list[fitz.Rect]:
    areas = page.search_for(text)
    if not areas:
        return []
    for rect in areas:
        redact_rect(page, rect)
    return areas


def write_text(
    page: fitz.Page,
    point: tuple[float, float],
    text: str,
    *,
    size: float = 8,
    bold: bool = False,
) -> None:
    if not text:
        return
    font = "F48" if bold else "F45"
    page.insert_text(point, text, fontname=font, fontsize=size, color=(0, 0, 0))


def write_text_right(
    page: fitz.Page,
    x_right: float,
    y: float,
    text: str,
    *,
    size: float = 8,
    bold: bool = False,
) -> None:
    if not text:
        return
    font = "F48" if bold else "F45"
    page.insert_textbox(
        fitz.Rect(0, y - size - 2, x_right, y + 2), text,
        fontname=font, fontsize=size, color=(0, 0, 0),
        align=fitz.TEXT_ALIGN_RIGHT,
    )


def write_at_rect(page: fitz.Page, rect: fitz.Rect, text: str, *, size: float | None = None, bold: bool = False) -> None:
    font_size = size or max(6.5, rect.height * 0.85)
    write_text(page, (rect.x0, rect.y1 - 1.2), text, size=font_size, bold=bold)


def replace_all(page: fitz.Page, old: str, new: str, *, size: float | None = None, bold: bool = False) -> bool:
    areas = page.search_for(old)
    if not areas:
        return False
    for rect in areas:
        redact_rect(page, rect)
    for rect in areas:
        write_at_rect(page, rect, new, size=size, bold=bold)
    return True


BARCODE_LEFT = 51.1
BARCODE_RIGHT = 250.0
BARCODE_TOP = 112.0
BARCODE_BOTTOM = 143.0

TABLE_LEFT = 31.0
TABLE_RIGHT = 581.8
COL_DIVIDERS = [80.2, 113.0, 362.6, 430.3, 498.2]
GRAY_LIGHT = (0.773, 0.773, 0.773)
GRAY_MID = (0.643, 0.643, 0.643)
YELLOW = (1.0, 0.839, 0.361)
LINE_W = 0.24


def draw_fill_rect(page: fitz.Page, rect: fitz.Rect, fill: tuple[float, float, float]) -> None:
    page.draw_rect(rect, color=None, fill=fill, width=0, overlay=True)


def ensure_white_page(page: fitz.Page) -> None:
    page.draw_rect(page.rect, color=None, fill=(1, 1, 1), width=0, overlay=False)


def draw_hline(page: fitz.Page, y: float, x0: float = TABLE_LEFT, x1: float = TABLE_RIGHT) -> None:
    page.draw_line(fitz.Point(x0, y), fitz.Point(x1, y), color=(0, 0, 0), width=LINE_W, overlay=True)


def draw_vline(page: fitz.Page, x: float, y0: float, y1: float) -> None:
    page.draw_line(fitz.Point(x, y0), fitz.Point(x, y1), color=(0, 0, 0), width=LINE_W, overlay=True)


def draw_page1_table_borders(page: fitz.Page) -> None:
    draw_hline(page, 257.3)
    draw_fill_rect(page, fitz.Rect(30.5, 288.2, 579.8, 302.4), GRAY_LIGHT)
    draw_vline(page, 157.4, 288.2, 347.8)
    draw_vline(page, 242.2, 288.2, 347.8)
    draw_vline(page, 411.6, 288.2, 347.8)
    draw_hline(page, 347.8)
    draw_fill_rect(page, fitz.Rect(30.5, 380.4, 581.5, 394.6), GRAY_LIGHT)
    draw_vline(page, 486.2, 415.2, 463.4)


def draw_movements_table_borders(
    page: fitz.Page,
    *,
    data_y0: float,
    data_y1: float,
    total_y0: float,
    total_y1: float,
    final_y0: float,
    final_y1: float,
) -> None:
    grid_top = 185.0
    grid_bottom = final_y1

    draw_fill_rect(page, fitz.Rect(31.2, 170.4, 345.1, 185.0), GRAY_MID)
    draw_fill_rect(page, fitz.Rect(31.2, 185.0, TABLE_RIGHT, 197.8), GRAY_LIGHT)
    draw_fill_rect(page, fitz.Rect(362.6, final_y0, 499.0, final_y1), YELLOW)
    draw_fill_rect(page, fitz.Rect(499.0, final_y0, TABLE_RIGHT, final_y1), YELLOW)

    for x in COL_DIVIDERS:
        draw_vline(page, x, grid_top, grid_bottom)

    draw_hline(page, 185.0)
    draw_hline(page, 197.8)
    draw_hline(page, data_y0)
    y = data_y0
    while y < data_y1:
        y += MOV_ROW_HEIGHT
        draw_hline(page, y)
    draw_hline(page, total_y0)
    draw_hline(page, total_y1)
    draw_hline(page, final_y1)


def insert_barcode(page: fitz.Page, payload: str) -> None:
    # Cover the complete barcode and its human-readable values from the source
    # before drawing the personalized version. The original extends farther than
    # its visible bars because its encoded font includes start/stop glyphs.
    barcode_area = fitz.Rect(28, 105, 380, 153)
    page.add_redact_annot(barcode_area, fill=(1, 1, 1))
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

    # The postal line touches the barcode's encoded-font bounding box in the
    # source PDF, so redraw the unchanged values after the precise redaction.
    write_text(page, (51.1, 110.5), "C.P. 48300", size=8, bold=True)
    write_text(page, (184.3, 110.5), "P05604734", size=8)

    png_bytes = None
    try:
        from barcode import Code128
        from barcode.writer import ImageWriter

        buffer = BytesIO()
        Code128(payload, writer=ImageWriter()).write(
            buffer,
            options={
                "module_height": 11.0,
                "module_width": 0.28,
                "quiet_zone": 0.15,
                "font_size": 0,
                "text_distance": 0,
                "dpi": 300,
            },
        )
        # python-barcode leaves substantial white padding inside the PNG even
        # with a minimal quiet zone. Crop that internal padding so the first
        # visible bar aligns with the address column, not merely the image box.
        from PIL import Image, ImageChops

        buffer.seek(0)
        barcode_image = Image.open(buffer).convert("RGB")
        background = Image.new("RGB", barcode_image.size, "white")
        bbox = ImageChops.difference(barcode_image, background).getbbox()
        if bbox:
            left, top, right, bottom = bbox
            barcode_image = barcode_image.crop((max(0, left - 2), top, min(barcode_image.width, right + 2), bottom))
        cropped = BytesIO()
        barcode_image.save(cropped, format="PNG")
        png_bytes = cropped.getvalue()
    except Exception:
        png_bytes = None

    if png_bytes:
        page.insert_image(
            fitz.Rect(BARCODE_LEFT, BARCODE_TOP, BARCODE_RIGHT, BARCODE_BOTTOM),
            stream=png_bytes,
            keep_proportion=False,
        )

    write_text(page, (BARCODE_LEFT, BARCODE_BOTTOM + 5.5), payload, size=6)


def build_context(data: dict) -> dict:
    movements = sorted(data.get("movements") or [], key=lambda m: m.get("date", ""))
    balance = parse_amount(data.get("balance"))
    account = data.get("account", "")
    account_fmt = format_account(account)
    cc = str(data.get("client_code") or TEMPLATE_CLIENT_CODE)
    clabe = generate_clabe(account)
    name = (data.get("name") or TEMPLATE_NAME).strip().upper()
    subtitle = (data.get("subtitle") or "").strip().upper()

    addr_lines = data.get("address_lines") or []

    total_charges = 0.0
    total_credits = 0.0
    for mov in movements:
        amount = parse_amount(mov.get("amount"))
        if mov.get("type") == "positive":
            total_credits += amount
        else:
            total_charges += amount

    opening = balance - total_credits + total_charges
    if movements:
        period_start = datetime.strptime(movements[0]["date"][:10], "%Y-%m-%d")
        period_end = datetime.strptime(movements[-1]["date"][:10], "%Y-%m-%d")
    else:
        period_start = period_end = datetime.now()

    period_text = f"{fmt_period_date(period_start)}  AL  {fmt_period_date(period_end)}"
    days = max(1, (period_end - period_start).days + 1)
    avg_balance = (opening + balance) / 2
    prefix, payload, postal = barcode_payload(cc, account)
    doc_id = f"0{cc}"[-7:].zfill(7)

    running = opening
    mov_rows = []
    for mov in movements:
        amount = parse_amount(mov.get("amount"))
        positive = mov.get("type") == "positive"
        deposit = format_amount(amount) if positive else ""
        withdraw = "" if positive else format_amount(amount)
        if positive:
            running += amount
        else:
            running -= amount
        desc = mov.get("title", "")
        if mov.get("location"):
            desc = f"{desc} {mov['location']}"
        mov_rows.append(
            {
                "date": fmt_mov_date(mov.get("date", "")),
                "folio": (mov.get("reference") or "")[:8],
                "desc": desc[:38],
                "deposit": deposit,
                "withdraw": withdraw,
                "balance": format_amount(running),
            }
        )

    return {
        "name": name,
        "addr_lines": addr_lines,
        "postal": postal,
        "barcode_prefix": prefix,
        "barcode_payload": payload,
        "client_code": cc,
        "rfc": str(data.get("rfc") or TEMPLATE_RFC),
        "phone": phone_fmt(data.get("phone")) if data.get("phone") else TEMPLATE_PHONE,
        "period_text": period_text,
        "cut_date": fmt_period_date(period_end),
        "account_fmt": account_fmt,
        "product": str(data.get("product") or PRODUCT).strip().upper(),
        "clabe": clabe,
        "opening": format_amount(opening),
        "balance": format_amount(balance),
        "avg_balance": format_amount(avg_balance),
        "total_credits": format_amount(total_credits),
        "total_charges": format_amount(total_charges),
        "days": str(days),
        "prev_pct": distribution_pct(opening),
        "curr_pct": distribution_pct(balance),
        "doc_id": doc_id,
        "mov_rows": mov_rows,
        "client_header": name,
        "has_name": bool(data.get("name")),
        "has_address": bool(addr_lines),
        "has_phone": bool(data.get("phone")),
        "has_rfc": bool(data.get("rfc")),
        "has_client_code": bool(data.get("client_code")),
    }


def paint_page_1(page: fitz.Page, ctx: dict) -> None:
    ensure_white_page(page)
    if ctx["has_name"]:
        replace_all(page, TEMPLATE_NAME, ctx["name"], size=9, bold=True)
    if ctx["has_address"]:
        for old, new in zip(
            ["MORELOS E INDEPENDENCIA", "CENTRO VALLARTA, PUERTO VALLARTA", "PUERTO VALLARTA, JALISCO"],
            ctx["addr_lines"][:3],
        ):
            replace_all(page, old, str(new).upper(), size=8, bold=True)

    insert_barcode(page, ctx["barcode_payload"])

    # Rebuild the complete metadata block so longer personalized values never
    # collide with remnants from the template.
    redact_rect(page, fitz.Rect(378, 62, 585, 150))
    write_text(page, (382.3, 78.9), f"CODIGO DE CLIENTE NO. {ctx['client_code']}", size=10, bold=True)
    write_text(page, (382.3, 93.3), "R.F.C.", size=10, bold=True)
    write_text(page, (435.1, 93.3), ctx["rfc"], size=10, bold=True)
    write_text(page, (382.3, 107.8), "MONEDA", size=8, bold=True)
    write_text(page, (435.1, 107.8), "PESOS MEXICANOS", size=8, bold=True)
    write_text(page, (382.3, 117.4), "SUCURSAL", size=8, bold=True)
    write_text(page, (435.1, 117.4), "4734 SUC. PRINCIPAL TEPIC", size=8, bold=True)
    write_text(page, (382.3, 127.0), "TELEFONO", size=8, bold=True)
    write_text(page, (435.1, 127.0), ctx["phone"], size=8, bold=True)
    write_text(page, (382.3, 136.6), "PERIODO", size=8, bold=True)
    write_text(page, (435.1, 136.6), f"DEL {ctx['period_text'].replace('  AL  ', ' AL ')}", size=8, bold=True)
    write_text(page, (382.3, 146.2), "CORTE AL", size=8, bold=True)
    write_text(page, (435.1, 146.2), ctx["cut_date"], size=8, bold=True)

    redact_rect(page, fitz.Rect(28, 243, 582, 257))
    write_text(page, (30.5, 254.5), ctx["product"], size=7.5)
    write_text(page, (177.6, 254.5), ctx["account_fmt"], size=8)
    for x in (260.9, 315.1, 368.9, 432.2):
        write_text(page, (x, 254.5), "0.00", size=8)

    redact_rect(page, fitz.Rect(28, 313, 582, 327))
    write_text(page, (30.5, 324.8), ctx["product"], size=7.5)
    write_text(page, (168.7, 324.8), ctx["account_fmt"], size=8)
    write_text(page, (301.4, 324.8), ctx["opening"], size=8)
    write_text(page, (372.2, 324.8), f"{ctx['prev_pct']}%", size=8)
    write_text(page, (469.9, 324.8), ctx["balance"], size=8)
    write_text(page, (540.5, 324.8), f"{ctx['curr_pct']}%", size=8)

    redact_rect(page, fitz.Rect(28, 329, 582, 344))
    write_text(page, (30.5, 341.2), "TOTAL", size=10, bold=True)
    write_text(page, (295.0, 341.2), ctx["opening"], size=10, bold=True)
    write_text(page, (365.5, 341.2), f"{ctx['prev_pct']}%", size=10, bold=True)
    write_text(page, (463.4, 341.2), ctx["balance"], size=10, bold=True)
    write_text(page, (534.0, 341.2), f"{ctx['curr_pct']}%", size=10, bold=True)

    redact_rect(page, fitz.Rect(45, 378, 582, 393))
    write_text(page, (49.2, 390.0), ctx["product"], size=8, bold=True)
    write_text(page, (215.0, 390.0), ctx["account_fmt"], size=8, bold=True)
    write_text(page, (296.9, 390.0), f"CUENTA CLABE: {ctx['clabe']}", size=9, bold=True)

    redact_rect(page, fitz.Rect(45, 393, 290, 405))
    write_text(page, (48.5, 403.5), "SUCURSAL  4734 SUC. PRINCIPAL TEPIC", size=8, bold=True)

    redact_rect(page, fitz.Rect(238, 409, 299, 463))
    write_text(page, (252.0, 423.2), ctx["avg_balance"], size=8)
    write_text(page, (250.6, 434.2), "0.0000%", size=8, bold=True)
    write_text(page, (273.8, 445.2), ctx["days"], size=8)
    write_text(page, (252.0, 456.2), "3,000.00", size=8)

    redact_rect(page, fitz.Rect(423, 409, 500, 463))
    write_text(page, (441.4, 423.2), ctx["opening"], size=8)
    write_text(page, (456.7, 434.2), ctx["total_credits"], size=8)
    write_text(page, (456.7, 445.2), ctx["total_charges"], size=8)
    write_text(page, (433.4, 456.2), ctx["balance"], size=10, bold=True)

    redact_rect(page, fitz.Rect(48, 522, 280, 575))
    write_text(page, (52.1, 535.5), ctx["product"], size=11, bold=True)
    write_text(page, (52.1, 550.5), f"No. de cuenta {ctx['account_fmt']}", size=11, bold=True)
    write_text(page, (52.1, 564.5), f"Saldo inicial de ${ctx['opening']}", size=10, bold=True)

    draw_page1_table_borders(page)

    replace_all(page, "Saldo final  $7,931.50", f"Saldo final  ${ctx['balance']}", size=8, bold=True)
    replace_all(page, "0889575", ctx["doc_id"], size=7.5)


MOV_DATE_X = 42.2
MOV_FOLIO_X = 84.0
MOV_DESC_X = 118.8
MOV_DEPOSIT_RIGHT = 413.7
MOV_WITHDRAW_RIGHT = 476.1
MOV_BALANCE_RIGHT = 550.7
MOV_OPENING_RIGHT = 344.6
MOV_TOTAL_DEPOSIT_RIGHT = 429.2
MOV_TOTAL_WITHDRAW_RIGHT = 497.1
MOV_FINAL_BALANCE_RIGHT = 577.4
MOV_DATA_Y0 = 198.0
MOV_ROW_HEIGHT = 12.0
MOV_TOTAL_HEIGHT = 14.5
MOV_FINAL_HEIGHT = 14.4
MOV_FONT_SIZE = 7.5
ROWS_FIRST_PAGE = 32
ROWS_EXTRA_PAGE = 45


def movement_layout(row_count: int) -> tuple[float, float, float, float, float, float, float]:
    if row_count == 0:
        data_y1 = MOV_DATA_Y0
        total_y0 = 200.6
        total_y1 = total_y0 + MOV_TOTAL_HEIGHT
        final_y0 = 215.0
        final_y1 = final_y0 + MOV_FINAL_HEIGHT
    else:
        data_y1 = MOV_DATA_Y0 + row_count * MOV_ROW_HEIGHT
        total_y0 = data_y1
        total_y1 = total_y0 + MOV_TOTAL_HEIGHT
        final_y0 = total_y1
        final_y1 = final_y0 + MOV_FINAL_HEIGHT
    return MOV_DATA_Y0, data_y1, total_y0, total_y1, final_y0, final_y1


def paint_movements_page(
    page: fitz.Page,
    ctx: dict,
    rows: list[dict],
    *,
    include_legend: bool,
    show_totals: bool,
) -> None:
    ensure_white_page(page)
    if ctx["has_name"]:
        replace_all(page, TEMPLATE_NAME, ctx["client_header"], size=9, bold=True)
    if ctx["has_client_code"]:
        replace_all(page, "CODIGO DE CLIENTE NO. 30307689", f"CODIGO DE CLIENTE NO. {ctx['client_code']}", size=10, bold=True)
    replace_all(page, "PERIODO DEL 01-JUN-2024 AL 30-JUN-2024", f"PERIODO DEL {ctx['period_text'].replace('  AL  ', ' AL ')}", size=8, bold=True)

    # Begin below the red section title; covering from y=153 clipped its
    # descenders at some zoom levels.
    redact_rect(page, fitz.Rect(31, 156, TABLE_RIGHT, 198))
    write_text(page, (34.8, 164.5), ctx["product"], size=8, bold=True)
    write_text(page, (180.0, 164.5), ctx["account_fmt"], size=8, bold=True)
    replace_all(page, "0889575", ctx["doc_id"], size=7.5)

    redact_rect(page, fitz.Rect(238.1, 166, 360, 186))

    if show_totals:
        data_y0, data_y1, total_y0, total_y1, final_y0, final_y1 = movement_layout(len(rows))
        clear_bottom = final_y1 + 4
    else:
        data_y0 = MOV_DATA_Y0
        data_y1 = MOV_DATA_Y0 + len(rows) * MOV_ROW_HEIGHT
        total_y0 = total_y1 = final_y0 = final_y1 = data_y1
        clear_bottom = data_y1 + 4
    if rows:
        clear_bottom = max(clear_bottom, 620.0)
    elif include_legend:
        clear_bottom = max(clear_bottom, 242.0)

    redact_rect(page, fitz.Rect(31, MOV_DATA_Y0, TABLE_RIGHT, clear_bottom))

    if show_totals or rows:
        draw_movements_table_borders(
            page,
            data_y0=data_y0,
            data_y1=data_y1,
            total_y0=total_y0 if show_totals else data_y1,
            total_y1=total_y1 if show_totals else data_y1,
            final_y0=final_y0 if show_totals else data_y1,
            final_y1=final_y1 if show_totals else data_y1,
        )

    for index, row in enumerate(rows):
        y = data_y0 + (index + 1) * MOV_ROW_HEIGHT - 3.5
        write_text(page, (MOV_DATE_X, y), row["date"], size=MOV_FONT_SIZE)
        write_text(page, (MOV_FOLIO_X, y), row["folio"], size=MOV_FONT_SIZE)
        # The Santander font embedded in the source is subsetted and does not
        # contain every glyph (notably uppercase W). Use a metrically compact
        # fallback for user-entered descriptions so letters are never omitted.
        page.insert_text(
            (MOV_DESC_X, y), row["desc"],
            fontname="helv", fontsize=MOV_FONT_SIZE, color=(0, 0, 0),
        )
        write_text_right(page, MOV_DEPOSIT_RIGHT, y, row["deposit"], size=MOV_FONT_SIZE)
        write_text_right(page, MOV_WITHDRAW_RIGHT, y, row["withdraw"], size=MOV_FONT_SIZE)
        write_text_right(page, MOV_BALANCE_RIGHT, y, row["balance"], size=MOV_FONT_SIZE)

    if show_totals:
        total_text_y = total_y0 + MOV_TOTAL_HEIGHT - 4.0
        final_text_y = final_y0 + MOV_FINAL_HEIGHT - 4.0

        write_text(page, (124.3, total_text_y), "TOTAL", size=MOV_FONT_SIZE, bold=True)
        write_text_right(page, MOV_TOTAL_DEPOSIT_RIGHT, total_text_y, ctx["total_credits"], size=MOV_FONT_SIZE, bold=True)
        write_text_right(page, MOV_TOTAL_WITHDRAW_RIGHT, total_text_y, ctx["total_charges"], size=MOV_FONT_SIZE, bold=True)

        write_text(page, (366.2, final_text_y), "SALDO FINAL DEL PERIODO:", size=8, bold=True)
        write_text_right(page, MOV_FINAL_BALANCE_RIGHT, final_text_y, f"${ctx['balance']}", size=8, bold=True)

    write_text(page, (38.2, 175.5), "SALDO FINAL DEL PERIODO ANTERIOR:", size=8, bold=True)
    write_text_right(page, MOV_OPENING_RIGHT, 175.5, f"${ctx['opening']}", size=8, bold=True)
    for label, x in (
        ("FECHA", MOV_DATE_X),
        ("FOLIO", MOV_FOLIO_X),
        ("DESCRIPCION", MOV_DESC_X),
        ("DEPOSITO", 376.3),
        ("RETIRO", 449.5),
        ("SALDO", 526.3),
    ):
        write_text(page, (x, 196.5), label, size=MOV_FONT_SIZE, bold=True)

    if rows:
        legend_start = (final_y1 + 8.0) if show_totals else (data_y1 + 8.0)
        redact_rect(page, fitz.Rect(28, legend_start, 585, 760))
    elif not include_legend:
        redact_rect(page, fitz.Rect(28, 242.0, 585, 760))


def paint_header_pages(page: fitz.Page, ctx: dict) -> None:
    ensure_white_page(page)
    if ctx["has_name"]:
        replace_all(page, TEMPLATE_NAME, ctx["client_header"], size=9, bold=True)
    if ctx["has_client_code"]:
        replace_all(page, "CODIGO DE CLIENTE NO. 30307689", f"CODIGO DE CLIENTE NO. {ctx['client_code']}", size=10, bold=True)
    replace_all(page, "PERIODO DEL 01-JUN-2024 AL 30-JUN-2024", f"PERIODO DEL {ctx['period_text'].replace('  AL  ', ' AL ')}", size=8, bold=True)
    replace_all(page, "0889575", ctx["doc_id"], size=7.5)


def generate_pdf(data: dict) -> bytes:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"No se encontró la plantilla: {TEMPLATE}")

    template = fitz.open(TEMPLATE)
    doc = fitz.open()
    doc.insert_pdf(template)

    ctx = build_context(data)
    paint_page_1(doc[0], ctx)

    rows = ctx["mov_rows"]
    if not rows:
        chunks = [[]]
    else:
        chunks = [rows[:ROWS_FIRST_PAGE]]
        remaining = rows[ROWS_FIRST_PAGE:]
        chunks.extend(
            remaining[i : i + ROWS_EXTRA_PAGE]
            for i in range(0, len(remaining), ROWS_EXTRA_PAGE)
        )

    for index, chunk in enumerate(chunks):
        if index == 0:
            page = doc[1]
            include_legend = True
        else:
            insert_at = 1 + index
            doc.insert_pdf(template, from_page=1, to_page=1, start_at=insert_at)
            page = doc[insert_at]
            include_legend = False
        paint_movements_page(
            page,
            ctx,
            chunk,
            include_legend=include_legend,
            show_totals=index == 0,
        )

    legal_start = 1 + len(chunks)
    for page_index in range(legal_start, doc.page_count):
        paint_header_pages(doc[page_index], ctx)

    pdf_bytes = doc.tobytes(deflate=True)
    template.close()
    doc.close()
    return pdf_bytes


def main() -> int:
    try:
        raw = sys.stdin.read()
        data = json.loads(raw or "{}")
        sys.stdout.buffer.write(generate_pdf(data))
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
