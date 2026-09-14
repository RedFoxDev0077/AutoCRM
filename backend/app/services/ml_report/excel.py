"""Builds ML_informe_AAAA-MM-DD.xlsx: Resumen, Historico, Posiciones, Campanas, Promociones, Acciones.

Arial throughout. Totals, ratios and variations are Excel formulas, so the
sheet stays live if Fede edits a number.
"""
from datetime import date, datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

DARK = "2B2724"
RED = "B5332D"
SOFT = "F4F1EE"
LINE = Side(style="thin", color="DDD6CF")

F = lambda **k: Font(name="Arial", **k)  # noqa: E731
HEAD_FONT = F(bold=True, color="FFFFFF", size=10)
HEAD_FILL = PatternFill("solid", fgColor=DARK)
PRIO_FILL = {"Alta": "F8E1DE", "Media": "F8EFDC", "Baja": "E8EEF6"}

MONEY = '"$" #,##0.00'
INT = "#,##0"
PCT = '0.00" %"'
DEC = "0.00"
DATE = "dd/mm/yyyy"


def _d(s):
    """ISO text -> real date cell value, so SUMIFS and date math work in any Excel locale."""
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None

HIST_COLS = [
    ("Fecha", "fecha", 11, DATE), ("MLA", "mla", 15, None), ("Titulo", "titulo", 46, None),
    ("Campana", "campana", 20, None), ("Estado anuncio", "estado", 15, None),
    ("Impresiones", "impresiones", 12, INT), ("Clics", "clics", 9, INT), ("CPC", "cpc", 10, MONEY),
    ("Ventas atrib", "ventas_atrib", 11, INT), ("Ingresos pub", "ingresos", 15, MONEY),
    ("Inversion", "inversion", 14, MONEY), ("ACOS pct", "acos", 9, PCT), ("TACOS pct", "tacos", 9, PCT),
    ("ROAS", "roas", 8, DEC), ("Visitas 7d", "visitas_7d", 10, INT), ("Ventas 7d", "ventas_7d", 10, INT),
    ("Conversion 7d pct", "conversion_7d", 12, PCT), ("Precio lista", "precio_lista", 13, MONEY),
    ("Precio final", "precio_final", 13, MONEY), ("Stock", "stock", 8, INT), ("Calidad", "calidad", 8, INT),
]


def _head(ws, row, titles, widths=None):
    for i, t in enumerate(titles, start=1):
        c = ws.cell(row=row, column=i, value=t)
        c.font, c.fill = HEAD_FONT, HEAD_FILL
        c.alignment = Alignment(vertical="center", wrap_text=True)
        if widths:
            ws.column_dimensions[get_column_letter(i)].width = widths[i - 1]
    ws.row_dimensions[row].height = 22


def _title(ws, text, sub):
    ws["A1"] = text
    ws["A1"].font = F(bold=True, size=15, color=DARK)
    ws["A2"] = sub
    ws["A2"].font = F(size=9, color="7A716A")


def _fontify(ws):
    for row in ws.iter_rows():
        for c in row:
            if c.font.name != "Arial":
                c.font = c.font.copy(name="Arial")


def build_workbook(path: str, *, fecha: str, metrics: dict, alertas: dict, highlights: list[str],
                   history: list[dict], positions: list[dict], campaigns: list[dict],
                   competidores: dict, promos: list[dict], actions: list[dict], errors: list[dict],
                   ads_desde: str | None, ads_hasta: str | None):
    wb = Workbook()

    # ── Historico ─────────────────────────────────────────
    wh = wb.active
    wh.title = "Historico"
    _title(wh, "Histórico de anuncios", "Una fila por anuncio en cada corrida. Métricas de publicidad de los últimos 30 días; visitas y ventas de los últimos 7.")
    _head(wh, 4, [c[0] for c in HIST_COLS], [c[2] for c in HIST_COLS])
    r = 5
    for row in history:
        for j, (_, key, _, fmt) in enumerate(HIST_COLS, start=1):
            c = wh.cell(row=r, column=j, value=_d(row.get(key)) if key == "fecha" else row.get(key))
            if fmt:
                c.number_format = fmt
        r += 1
    last = r - 1
    tot = r
    wh.cell(row=tot, column=1, value="Totales").font = F(bold=True)
    col = {k: get_column_letter(i) for i, (_, k, _, _) in enumerate(HIST_COLS, start=1)}
    for key in ("impresiones", "clics", "ventas_atrib", "ingresos", "inversion"):
        c = wh.cell(row=tot, column=list(col).index(key) + 1, value=f"=SUM({col[key]}5:{col[key]}{max(last, 5)})")
        c.font = F(bold=True)
        c.number_format = MONEY if key in ("ingresos", "inversion") else INT
    c = wh.cell(row=tot, column=list(col).index("roas") + 1, value=f'=IFERROR({col["ingresos"]}{tot}/{col["inversion"]}{tot},"")')
    c.font, c.number_format = F(bold=True), DEC
    for j in range(1, len(HIST_COLS) + 1):
        wh.cell(row=tot, column=j).border = Border(top=Side(style="medium", color=DARK))
    wh.freeze_panes = "C5"
    wh.auto_filter.ref = f"A4:{get_column_letter(len(HIST_COLS))}{max(last, 4)}"

    # ── Resumen ───────────────────────────────────────────
    ws = wb.create_sheet("Resumen", 0)
    _title(ws, f"Informe Mercado Libre · {datetime.strptime(fecha, '%Y-%m-%d').strftime('%d/%m/%Y')}",
           f"PROVEEDURIADELREY (INDUMENTARIA SEGURA S.R.L.) · publicidad del {ads_desde or '—'} al {ads_hasta or '—'}")
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 20
    ws.column_dimensions["C"].width = 70
    rng = lambda key: f"Historico!{col[key]}:{col[key]}"  # noqa: E731
    y, m, d = fecha.split("-")
    fecha_crit = f"Historico!$A:$A,DATE({int(y)},{int(m)},{int(d)})"
    ws["A4"] = "Métricas de la cuenta"
    ws["A4"].font = F(bold=True, size=11, color=RED)
    filas = [
        ("Inversión Product Ads", f"=SUMIFS({rng('inversion')},{fecha_crit})", MONEY, "Suma de los anuncios de esta corrida."),
        ("Inversión Display Ads", "no disponible", None, "La API de Mercado Libre no expone Display Ads: revisarlo en el panel de Mercado Ads."),
        ("Ingresos por publicidad", f"=SUMIFS({rng('ingresos')},{fecha_crit})", MONEY, ""),
        ("ROAS", "=IFERROR(B7/B5,\"\")", DEC, "Ingresos ÷ inversión de Product Ads."),
        ("ACOS", "=IFERROR(B5/B7*100,\"\")", PCT, "Inversión ÷ ingresos por publicidad."),
        ("Facturación total ML (30 días)", metrics.get("facturacion_30d"), MONEY, "Órdenes pagadas de los últimos 30 días."),
        ("TACOS", "=IFERROR(B5/B10*100,\"\")", PCT, "Inversión ÷ facturación total."),
        ("Ventas atribuidas", f"=SUMIFS({rng('ventas_atrib')},{fecha_crit})", INT, ""),
        ("Clics", f"=SUMIFS({rng('clics')},{fecha_crit})", INT, ""),
        ("Presupuesto diario (campañas activas)", "=SUMIFS(Campanas!C:C,Campanas!B:B,\"Activo\")", MONEY, ""),
    ]
    for i, (label, val, fmt, nota) in enumerate(filas, start=5):
        ws.cell(row=i, column=1, value=label).font = F(size=10)
        c = ws.cell(row=i, column=2, value=val)
        c.font = F(bold=True, size=10)
        if fmt:
            c.number_format = fmt
        ws.cell(row=i, column=3, value=nota).font = F(size=9, color="7A716A")
    r = 5 + len(filas) + 1

    ws.cell(row=r, column=1, value="Alertas del catálogo").font = F(bold=True, size=11, color=RED)
    r += 1
    etiquetas = {
        "sin_stock": ("Publicaciones activas sin stock", "Alta"), "para_corregir": ("Pendientes por corregir", "Alta"),
        "en_revision": ("En revisión por Mercado Libre", "Alta"), "calidad_baja": ("Calidad por debajo de 70", "Media"),
        "stock_bajo": ("Stock bajo (menos de 20)", "Media"), "pausadas": ("Pausadas", "Baja"), "inactivas": ("Inactivas", "Baja"),
    }
    for key, (label, prio) in etiquetas.items():
        if key not in alertas:
            continue
        ws.cell(row=r, column=1, value=label).font = F(size=10)
        ws.cell(row=r, column=2, value=alertas[key]).font = F(bold=True, size=10)
        c = ws.cell(row=r, column=3, value=prio if alertas[key] else "—")
        c.font = F(size=9, bold=bool(alertas[key]))
        if alertas[key]:
            c.fill = PatternFill("solid", fgColor=PRIO_FILL[prio])
        r += 1
    r += 1

    ws.cell(row=r, column=1, value="Lo más importante de hoy").font = F(bold=True, size=11, color=RED)
    r += 1
    for h in highlights:
        c = ws.cell(row=r, column=1, value="• " + h)
        c.font = F(size=10)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
        ws.row_dimensions[r].height = 30
        r += 1
    if errors:
        r += 1
        ws.cell(row=r, column=1, value="No se pudo leer").font = F(bold=True, size=11, color=RED)
        r += 1
        for e in errors:
            ws.cell(row=r, column=1, value=e["seccion"]).font = F(size=10)
            ws.cell(row=r, column=3, value=e["detalle"]).font = F(size=9, color="7A716A")
            r += 1

    # ── Posiciones ────────────────────────────────────────
    wp = wb.create_sheet("Posiciones")
    _title(wp, "Posición en búsquedas", "Posición en la primera página de resultados, de arriba hacia abajo. Variación positiva = subió.")
    _head(wp, 4, ["Fecha", "Término", "Total resultados", "MLA", "Título", "Posición", "Variación vs. anterior"], [11, 30, 14, 15, 46, 12, 18])
    r = 5
    ultima = {}
    for p in positions:
        pos = int(p["posicion"]) if str(p["posicion"]).isdigit() else p["posicion"]
        vals = [_d(p["fecha"]), p["termino"], p["total_resultados"], p["mla"], p["titulo"], pos]
        for j, v in enumerate(vals, start=1):
            wp.cell(row=r, column=j, value=v)
        wp.cell(row=r, column=3).number_format = INT
        wp.cell(row=r, column=1).number_format = DATE
        key = (p["termino"], p["mla"])
        if key in ultima:
            wp.cell(row=r, column=7, value=f'=IF(AND(ISNUMBER(F{ultima[key]}),ISNUMBER(F{r})),F{ultima[key]}-F{r},"")')
        ultima[key] = r
        r += 1
    wp.freeze_panes = "A5"
    r += 1
    wp.cell(row=r, column=1, value="Competidores mejor rankeados (última corrida)").font = F(bold=True, size=11, color=RED)
    r += 1
    _head(wp, r, ["Término", "Puesto", "Publicación", "Título", "Precio"])
    r += 1
    for termino, comps in competidores.items():
        for i, cpt in enumerate(comps, start=1):
            for j, v in enumerate([termino, i, cpt["id"], cpt["title"], cpt["price"]], start=1):
                wp.cell(row=r, column=j, value=v)
            wp.cell(row=r, column=5).number_format = MONEY
            r += 1

    # ── Campanas ──────────────────────────────────────────
    wc = wb.create_sheet("Campanas")
    _title(wc, "Campañas de Product Ads", "El % del gasto se calcula sobre el presupuesto de las campañas ACTIVAS.")
    _head(wc, 4, ["Campaña", "Estado", "Presupuesto diario", "ROAS objetivo", "ROAS real", "Anuncios", "Inversión", "Ingresos", "Ventas", "TACOS pct", "% del presupuesto activo"],
          [28, 12, 16, 13, 10, 10, 15, 15, 9, 10, 18])
    r = 5
    first = r
    for cp in campaigns:
        vals = [cp["nombre"], cp["estado"], cp["presupuesto"], cp["roas_objetivo"], cp["roas"], cp["anuncios"],
                cp["inversion"], cp["ingresos"], cp["ventas_atrib"], cp["tacos"] if cp["tacos"] is not None else cp["tacos_calc"]]
        for j, v in enumerate(vals, start=1):
            wc.cell(row=r, column=j, value=v)
        for j, fmt in ((3, MONEY), (4, DEC), (5, DEC), (7, MONEY), (8, MONEY), (9, INT), (10, PCT)):
            wc.cell(row=r, column=j).number_format = fmt
        r += 1
    lastc = max(r - 1, first)
    for rr in range(first, r):
        c = wc.cell(row=rr, column=11, value=f'=IF(B{rr}="Activo",IFERROR(C{rr}/SUMIFS($C${first}:$C${lastc},$B${first}:$B${lastc},"Activo")*100,""),"")')
        c.number_format = PCT
    wc.freeze_panes = "B5"

    # ── Promociones ───────────────────────────────────────
    wpr = wb.create_sheet("Promociones")
    _title(wpr, "Promociones", "Activas, programadas y propuestas sin responder.")
    _head(wpr, 4, ["Promoción", "Tipo", "Estado", "Desde", "Hasta", "Días restantes"], [36, 22, 22, 12, 12, 14])
    labels = {"started": "Activa", "pending": "Programada", "candidate": "Propuesta sin responder", "finished": "Terminada"}
    r = 5
    for pr in promos:
        st = (pr.get("status") or "").lower()
        if st == "finished":
            continue
        vals = [pr.get("name") or pr.get("type"), pr.get("type"), labels.get(st, st),
                _d(pr.get("start_date")), _d(pr.get("finish_date"))]
        for j, v in enumerate(vals, start=1):
            wpr.cell(row=r, column=j, value=v)
        wpr.cell(row=r, column=4).number_format = DATE
        wpr.cell(row=r, column=5).number_format = DATE
        wpr.cell(row=r, column=6, value=f'=IF(ISNUMBER(E{r}),E{r}-TODAY(),"")')
        if st == "candidate":
            wpr.cell(row=r, column=3).fill = PatternFill("solid", fgColor=PRIO_FILL["Media"])
        r += 1
    if r == 5:
        wpr.cell(row=5, column=1, value="Sin promociones activas ni propuestas.").font = F(size=10, color="7A716A")

    # ── Acciones ──────────────────────────────────────────
    wa = wb.create_sheet("Acciones")
    _title(wa, "Acciones sugeridas", "Ordenadas por prioridad. Salen de comparar esta corrida con la anterior.")
    _head(wa, 4, ["Prioridad", "Tema", "Qué se observó", "Qué haría"], [11, 26, 70, 60])
    r = 5
    for a in actions:
        for j, v in enumerate([a["prioridad"], a["tema"], a["observado"], a["accion"]], start=1):
            c = wa.cell(row=r, column=j, value=v)
            c.alignment = Alignment(wrap_text=True, vertical="top")
        wa.cell(row=r, column=1).fill = PatternFill("solid", fgColor=PRIO_FILL[a["prioridad"]])
        wa.cell(row=r, column=1).font = F(bold=True, size=10)
        r += 1
    if not actions:
        wa.cell(row=5, column=1, value="Sin acciones urgentes en esta corrida.").font = F(size=10, color="7A716A")

    for sheet in wb.worksheets:
        _fontify(sheet)
        sheet.sheet_view.showGridLines = sheet.title != "Resumen"
    wb.save(path)
