"""Turns collected ML data into history rows and finds what needs a decision.

The checks follow Fede's brief ("Qué analizar de verdad"): compare with the
previous run, not just transcribe numbers.
"""
import re
from datetime import datetime, timedelta

from .collector import _num

ACTIVE = {"active", "activo", "activa"}
PAUSED = {"paused", "pausado", "pausada"}


def estado_anuncio(raw: str | None) -> str:
    s = (raw or "").lower()
    if s in ACTIVE:
        return "Activo"
    if s in PAUSED:
        return "PAUSADO"
    return "DESHABILITADO" if s else ""


def _metrics(obj: dict) -> dict:
    m = obj.get("metrics") or obj.get("metrics_summary") or {}
    inversion = _num(m.get("cost"), m.get("spend"))
    ingresos = _num(m.get("total_amount"))
    if ingresos is None:
        d, i = _num(m.get("direct_amount")), _num(m.get("indirect_amount"))
        ingresos = (d or 0) + (i or 0) if d is not None or i is not None else None
    ventas = _num(m.get("units_quantity"))
    if ventas is None:
        d, i = _num(m.get("direct_units_quantity")), _num(m.get("indirect_units_quantity"))
        ventas = (d or 0) + (i or 0) if d is not None or i is not None else None
    clics = _num(m.get("clicks"))
    roas = _num(m.get("roas"))
    if roas is None and inversion and ingresos is not None:
        roas = ingresos / inversion
    acos = _num(m.get("acos"))
    if acos is None and ingresos and inversion is not None:
        acos = inversion / ingresos * 100
    return {
        "impresiones": _num(m.get("prints"), m.get("impressions")),
        "clics": clics,
        "cpc": _num(m.get("cpc")) if _num(m.get("cpc")) is not None else (inversion / clics if inversion is not None and clics else None),
        "ventas_atrib": ventas, "ingresos": ingresos, "inversion": inversion,
        "acos": acos, "tacos": _num(m.get("tacos")), "roas": roas,
    }


def snapshot_rows(data: dict) -> list[dict]:
    """One row per advertised listing, same columns as the old Historico CSV."""
    fecha = data["fecha"]
    items = data["catalogo"]["items"]
    camp_names = {str(c.get("id")): c.get("name", "") for c in data["ads"]["campaigns"]}
    rows = []
    for ad in data["ads"]["ads"]:
        mla = ad.get("item_id") or ad.get("id")
        if not mla:
            continue
        it = items.get(mla, {})
        vis, ven = data["visitas"].get(mla), data["ventas"].get(mla)
        rows.append({
            "fecha": fecha, "mla": mla,
            "titulo": ad.get("title") or it.get("title", ""),
            "campana": camp_names.get(str(ad.get("campaign_id")), ""),
            "estado": estado_anuncio(ad.get("status")),
            **_metrics(ad),
            "visitas_7d": vis, "ventas_7d": ven,
            "conversion_7d": round(ven / vis * 100, 2) if vis and ven is not None else None,
            "precio_lista": _num(it.get("original_price"), it.get("price"), ad.get("price")),
            "precio_final": _num(it.get("price"), ad.get("price")),
            "stock": _num(it.get("available_quantity")),
            "calidad": round(float(it["health"]) * 100) if it.get("health") is not None else None,
        })
    return rows


def position_rows(data: dict) -> list[dict]:
    rows = []
    for t in data["posiciones"]:
        res = t["resultados"]
        for mla in t["mlas"]:
            if res is None:
                pos = "no medido"
            else:
                idx = next((i for i, r in enumerate(res) if r["id"] == mla), None)
                pos = str(idx + 1) if idx is not None else "no aparece"
            titulo = next((r["title"] for r in (res or []) if r["id"] == mla), "")
            rows.append({"fecha": data["fecha"], "termino": t["termino"], "total_resultados": t["total"],
                         "mla": mla, "titulo": titulo or data["catalogo"]["items"].get(mla, {}).get("title", ""), "posicion": pos})
    return rows


def competidores(data: dict) -> dict:
    """Top 3 competitors (not ours) per term."""
    propios = set(data["catalogo"]["items"].keys())
    out = {}
    for t in data["posiciones"]:
        if t["resultados"] is None:
            continue
        out[t["termino"]] = [r for r in t["resultados"] if r["id"] not in propios and r["id"] not in t["mlas"]][:3]
    return out


def campaign_rows(data: dict, facturacion: float) -> list[dict]:
    rows = []
    n_ads = {}
    for ad in data["ads"]["ads"]:
        n_ads[str(ad.get("campaign_id"))] = n_ads.get(str(ad.get("campaign_id")), 0) + 1
    for c in data["ads"]["campaigns"]:
        m = _metrics(c)
        target = _num(c.get("roas_target"))
        if target is None and _num(c.get("acos_target")):
            target = round(100 / _num(c.get("acos_target")), 2)
        rows.append({
            "nombre": c.get("name", ""), "estado": estado_anuncio(c.get("status")),
            "presupuesto": _num(c.get("budget"), (c.get("budget") or {}).get("amount") if isinstance(c.get("budget"), dict) else None),
            "roas_objetivo": target, "anuncios": n_ads.get(str(c.get("id")), 0), **m,
            "tacos_calc": round(m["inversion"] / facturacion * 100, 2) if m["inversion"] and facturacion else None,
        })
    return rows


def account_metrics(rows: list[dict], facturacion: float) -> dict:
    inv = sum(r["inversion"] or 0 for r in rows)
    ing = sum(r["ingresos"] or 0 for r in rows)
    return {
        "inversion_product_ads": round(inv, 2),
        "ingresos_publicidad": round(ing, 2),
        "roas": round(ing / inv, 2) if inv else None,
        "acos": round(inv / ing * 100, 2) if ing else None,
        "tacos": round(inv / facturacion * 100, 2) if facturacion else None,
        "ventas_atribuidas": sum(r["ventas_atrib"] or 0 for r in rows),
        "clics": sum(r["clics"] or 0 for r in rows),
        "facturacion_30d": round(facturacion, 2),
        "anuncios": len(rows),
    }


def _tokens(s: str) -> set:
    return {w for w in re.sub(r"[^a-z0-9 ]", " ", (s or "").lower()).split() if len(w) > 2}


def _pct_change(new, old):
    if new is None or old in (None, 0):
        return None
    return (new - old) / old * 100


def find_actions(rows, prev_rows, positions, prev_positions, campaigns, promos, today: str) -> list[dict]:
    acts = []

    def add(prio, tema, observado, accion):
        acts.append({"prioridad": prio, "tema": tema, "observado": observado, "accion": accion})

    prev = {r["mla"]: r for r in prev_rows}
    inv_tot = sum(r["inversion"] or 0 for r in rows)
    ing_tot = sum(r["ingresos"] or 0 for r in rows)
    acos_cuenta = inv_tot / ing_tot * 100 if ing_tot else None

    for r in rows:
        p = prev.get(r["mla"])
        corto = (r["titulo"] or r["mla"])[:48]
        # 1. inversión crece más rápido que los ingresos
        if p:
            di, dg = _pct_change(r["inversion"], p["inversion"]), _pct_change(r["ingresos"], p["ingresos"])
            if di is not None and dg is not None and di > 0 and di - dg > 15:
                add("Alta", "Eficiencia en caída", f"{corto}: la inversión subió {di:.0f} % y los ingresos {dg:+.0f} % desde la corrida anterior.",
                    "Revisar puja o ROAS objetivo de la campaña; si sigue así, bajar el presupuesto de este anuncio.")
        # 2. ACOS muy por encima del promedio
        if acos_cuenta and r["acos"] and r["acos"] > max(acos_cuenta * 1.8, acos_cuenta + 8) and (r["inversion"] or 0) > inv_tot * 0.02:
            add("Alta", "ACOS alto", f"{corto}: ACOS {r['acos']:.1f} % contra {acos_cuenta:.1f} % de la cuenta.",
                "Pausar o mover a una campaña con ROAS objetivo más exigente.")
        # 3. deshabilitados
        if r["estado"] == "DESHABILITADO":
            add("Alta", "Anuncio deshabilitado", f"{corto} ({r['mla']}) figura deshabilitado.",
                "Ver el motivo en Mercado Ads: si la publicación cayó, es venta perdida, no solo gasto.")
        # 8. stock bajo en productos publicitados
        if r["estado"] == "Activo" and r["stock"] is not None and (r["stock"] < 20 or (r["ventas_7d"] and r["stock"] < r["ventas_7d"] * 2)):
            add("Media", "Stock bajo", f"{corto}: quedan {int(r['stock'])} unidades y se está publicitando.",
                "Reponer stock o pausar el anuncio antes de quedarse sin unidades.")

    # 4 y 5. posiciones
    # last position that was actually measured for each term/listing ("no medido" rows don't count)
    prev_pos = {}
    for x in prev_positions:
        if x["posicion"] != "no medido":
            prev_pos[(x["termino"], x["mla"])] = x["posicion"]
    inv_by_mla = {r["mla"]: r["inversion"] or 0 for r in rows}
    top_inv = sorted(inv_by_mla.values(), reverse=True)
    umbral = top_inv[max(0, len(top_inv) // 4 - 1)] if top_inv else 0
    for x in positions:
        antes = prev_pos.get((x["termino"], x["mla"]))
        if x["posicion"].isdigit() and antes and antes.isdigit() and int(x["posicion"]) - int(antes) >= 5:
            add("Media", "Bajó de posición", f"{x['mla']} pasó del {antes}° al {x['posicion']}° en «{x['termino']}».",
                "Mirar si coincide con caída de visitas; revisar precio y título frente a los 3 primeros.")
        if antes and antes.isdigit() and x["posicion"] == "no aparece":
            add("Alta", "Salió de la primera página", f"{x['mla']} estaba {antes}° en «{x['termino']}» y ya no aparece en la pág. 1.",
                "Revisar si la publicación está activa, con stock y sin reclamos.")
        inv = inv_by_mla.get(x["mla"], 0)
        if inv and inv >= umbral and (x["posicion"] == "no aparece" or (x["posicion"].isdigit() and int(x["posicion"]) > 20)):
            add("Media", "Visibilidad comprada", f"{x['mla']} tiene de las inversiones más altas pero está {x['posicion'] + '°' if x['posicion'].isdigit() else 'fuera de la pág. 1'} en «{x['termino']}».",
                "Mejorar la ficha (fotos, título, precio) para que posicione sola y bajar la dependencia de la publicidad.")

    # 6. desbalance de presupuesto
    act = [c for c in campaigns if c["estado"] == "Activo" and c["roas"] and c["presupuesto"]]
    for i, a in enumerate(act):
        for b in act[i + 1:]:
            if abs(a["roas"] - b["roas"]) / max(a["roas"], b["roas"]) <= 0.2:
                hi, lo = (a, b) if a["presupuesto"] >= b["presupuesto"] else (b, a)
                if hi["presupuesto"] >= lo["presupuesto"] * 2.5:
                    add("Baja", "Presupuesto desbalanceado", f"«{hi['nombre']}» y «{lo['nombre']}» rinden parecido (ROAS {hi['roas']:.1f} y {lo['roas']:.1f}) pero una tiene {hi['presupuesto'] / lo['presupuesto']:.1f} veces más presupuesto.",
                        "Pasar parte del presupuesto a la campaña más chica y comparar en la próxima corrida.")

    # 7. productos casi iguales con conversiones muy distintas
    conv = [r for r in rows if r["conversion_7d"] and r["visitas_7d"] and r["visitas_7d"] >= 50]
    for i, a in enumerate(conv):
        for b in conv[i + 1:]:
            ta, tb = _tokens(a["titulo"]), _tokens(b["titulo"])
            if ta and tb and len(ta & tb) / len(ta | tb) >= 0.45:
                hi, lo = (a, b) if a["conversion_7d"] >= b["conversion_7d"] else (b, a)
                if hi["conversion_7d"] >= lo["conversion_7d"] * 1.8:
                    add("Media", "Fichas parecidas, conversión distinta", f"{hi['mla']} convierte {hi['conversion_7d']:.1f} % y {lo['mla']} {lo['conversion_7d']:.1f} %, siendo casi el mismo producto.",
                        f"Copiar de {hi['mla']} a {lo['mla']} lo que funciona: fotos, título, precio o variantes.")

    # 9. promociones
    hoy = datetime.strptime(today, "%Y-%m-%d")
    for pr in promos:
        nombre = pr.get("name") or pr.get("type") or "Promoción"
        st = (pr.get("status") or "").lower()
        if st == "candidate":
            add("Media", "Propuesta sin responder", f"«{nombre}» espera respuesta.", "Decidir si conviene sumarse antes de que venza la invitación.")
        fin = pr.get("finish_date") or ""
        if st == "started" and fin[:10]:
            try:
                dias = (datetime.strptime(fin[:10], "%Y-%m-%d") - hoy).days
                if 0 <= dias <= 7:
                    add("Media", "Promoción por vencer", f"«{nombre}» termina {'hoy' if dias == 0 else 'mañana' if dias == 1 else f'en {dias} días'} ({fin[8:10]}/{fin[5:7]}).", "Definir si se renueva o qué precio queda después.")
            except ValueError:
                pass

    orden = {"Alta": 0, "Media": 1, "Baja": 2}
    acts.sort(key=lambda a: orden[a["prioridad"]])
    return acts


def highlights(metrics: dict, prev_metrics: dict | None, actions: list[dict], errors: list[dict]) -> list[str]:
    """3 to 5 sentences for the top of the report and the notification."""
    out = []
    if prev_metrics:
        for key, label in (("inversion_product_ads", "La inversión en Product Ads"), ("ingresos_publicidad", "Los ingresos por publicidad")):
            ch = _pct_change(metrics.get(key), prev_metrics.get(key))
            if ch is not None and abs(ch) >= 20:
                out.append(f"{label} {'subió' if ch > 0 else 'bajó'} {abs(ch):.0f} % respecto de la corrida anterior.")
    for a in actions:
        if len(out) >= 5:
            break
        out.append(f"{a['tema']}: {a['observado']}")
    if metrics.get("roas") and len(out) < 3:
        out.append(f"La cuenta devuelve $ {metrics['roas']:.1f} por cada $ 1 invertido en Product Ads (ACOS {metrics.get('acos') or 0:.1f} %).")
    if errors and len(out) < 5:
        out.append("No se pudo leer: " + ", ".join(sorted({e['seccion'] for e in errors})) + ". El detalle está en el informe.")
    return out[:5] or ["Sin novedades importantes respecto de la corrida anterior."]


def previous_date(dates: list[str], today: str) -> str | None:
    older = sorted(d for d in set(dates) if d < today)
    return older[-1] if older else None


def next_run(now: datetime) -> datetime:
    """Next Monday or Thursday at 08:00 (same timezone as `now`)."""
    for add_days in range(0, 8):
        d = (now + timedelta(days=add_days)).replace(hour=8, minute=0, second=0, microsecond=0)
        if d.weekday() in (0, 3) and d > now:
            return d
    return now + timedelta(days=1)
