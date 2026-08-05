import httpx
from app.config import get_settings

settings = get_settings()

# Pipeline IDs — Embudo ventas (WhatsApp inbound)
PIPELINE_VENTAS             = 13659060
STATUS_LEADS_ENTRANTES      = 105410248
STATUS_CONTACTADO           = 105410252
STATUS_PRESUPUESTO          = 105410256
STATUS_VENTA_CERRADA        = 105410260
STATUS_VOLVER_CONTACTAR     = 105411516
STATUS_VENTA_PERDIDA        = 105410708

# Pipeline IDs — Embudo Maps (Google Maps leads)
PIPELINE_MAPS           = 13759380
STATUS_MAPS_NUEVO       = 106160416
STATUS_MAPS_CONTACTADO  = 106160420
STATUS_MAPS_INTERESADO  = 106160424

# Pipeline IDs — Embudo Mercado Libre (product stages)
PIPELINE_ML                 = 13793376
PIPELINE_MINORISTA          = 13793376  # legacy alias
STATUS_MINORISTA_NUEVO      = 106426152
STATUS_MINORISTA_CONTACTO   = 106426156

# "Volver a contactar" in ML pipeline — client must create this stage; fallback = 142 (logrado con éxito)
STATUS_ML_VOLVER_CONTACTAR = 142

# Hardcoded stage IDs for EMBUDO MERCADO LIBRE (fetched 2026-05-25)
ML_STAGE_IDS = {
    "pantalones": 106426156,
    "ambos":      106426160,
    "camperas":   106426164,
    "mamelucos":  106483028,
    "buzos":      106483032,
    "remeras":    106483036,
    "camisas":    106483040,
    "otros":      106483044,
}

# Maps product sub-menu selection_id → ML pipeline stage
PRODUCT_STAGE_MAP = {
    "prod_pantalones": ML_STAGE_IDS["pantalones"],
    "prod_ambos":      ML_STAGE_IDS["ambos"],
    "prod_camperas":   ML_STAGE_IDS["camperas"],
    "prod_mamelucos":  ML_STAGE_IDS["mamelucos"],
    "prod_buzos":      ML_STAGE_IDS["buzos"],
    "prod_remeras":    ML_STAGE_IDS["remeras"],
    "prod_camisas":    ML_STAGE_IDS["camisas"],
    "prod_bermudas":   ML_STAGE_IDS["otros"],
    "prod_delantales": ML_STAGE_IDS["otros"],
}

# Keyword → stage auto-routing
KEYWORDS_PRESUPUESTO = ["precio", "cuánto", "cuanto", "costo", "vale", "valor", "presupuesto", "cotización", "cotizacion", "cuanto sale", "cuánto sale"]
KEYWORDS_VENTA       = ["compré", "compre", "pagué", "pague", "me lo llevo", "quiero comprar", "confirmo", "gracias por tu compra", "hice el pago", "transferí", "transferi"]
KEYWORDS_PERDIDO     = ["no gracias", "no me interesa", "no por ahora", "otro momento", "no necesito", "dejalo", "no quiero"]

# Product IDs → ML listing URL + reply text
PRODUCT_REPLIES = {
    "prod_pantalones": {
        "text": (
            "Tenemos 3 modelos de pantalones:\n\n"
            "Pantalon Cargo:\nhttps://articulo.mercadolibre.com.ar/MLA-840068870-pantalon-cargo-gabardina-trabajo-uniforme-bolsillos-reforzad-_JM\n\n"
            "Pantalon de Trabajo / Clasico:\nhttps://articulo.mercadolibre.com.ar/MLA-821671970-pantalon-de-trabajo-beige-aero-azul-talle-del-36-al-60-_JM\n\n"
            "Pantalon Nautico:\nhttps://articulo.mercadolibre.com.ar/MLA-869754696-pantalon-nautico-hombre-blanco-azul-_JM"
        )
    },
    "prod_ambos": {
        "text": "Ambo medico unisex:\nhttps://articulo.mercadolibre.com.ar/MLA-840278922-ambo-medico-unisex-uniformes-sanitario-excelente-calidad-_JM"
    },
    "prod_camperas": {
        "text": "Campera de trabajo Trucker termica:\nhttps://articulo.mercadolibre.com.ar/MLA-868535335-campera-trabajo-trucker-termica-todos-los-talles-_JM"
    },
    "prod_mamelucos": {
        "text": "Mameluco de trabajo:\nhttps://articulo.mercadolibre.com.ar/MLA-860586514-mameluco-de-trabajo-azul-_JM"
    },
    "prod_camisas": {
        "text": "Camisa de trabajo gabardina:\nhttps://articulo.mercadolibre.com.ar/MLA-824976661-camisa-de-trabajo-gabardina-varios-colores-_JM"
    },
    "prod_buzos": {
        "text": "Buzo de friza liso:\nhttps://articulo.mercadolibre.com.ar/MLA-868545594-buzo-de-friza-hombre-liso-trabajo-_JM"
    },
    "prod_remeras": {
        "text": "Remera hombre lisa algodon:\nhttps://articulo.mercadolibre.com.ar/MLA-1659921072-remera-hombre-lisa-algodon-_JM"
    },
    "prod_bermudas": {
        "text": "Consulta nuestros productos disponibles:\nhttps://www.mercadolibre.com.ar/pagina/indumentariasegura"
    },
    "prod_delantales": {
        "text": "Consulta nuestros productos disponibles:\nhttps://www.mercadolibre.com.ar/pagina/indumentariasegura"
    },
}

# Product keyword → ML link (for free-text detection)
PRODUCT_LINKS = {
    "pantalon cargo":    "https://articulo.mercadolibre.com.ar/MLA-840068870-pantalon-cargo-gabardina-trabajo-uniforme-bolsillos-reforzad-_JM",
    "cargo":             "https://articulo.mercadolibre.com.ar/MLA-840068870-pantalon-cargo-gabardina-trabajo-uniforme-bolsillos-reforzad-_JM",
    "pantalon nautico":  "https://articulo.mercadolibre.com.ar/MLA-869754696-pantalon-nautico-hombre-blanco-azul-_JM",
    "nautico":           "https://articulo.mercadolibre.com.ar/MLA-869754696-pantalon-nautico-hombre-blanco-azul-_JM",
    "pantalon trabajo":  "https://articulo.mercadolibre.com.ar/MLA-821671970-pantalon-de-trabajo-beige-aero-azul-talle-del-36-al-60-_JM",
    "pantalon clasico":  "https://articulo.mercadolibre.com.ar/MLA-821671970-pantalon-de-trabajo-beige-aero-azul-talle-del-36-al-60-_JM",
    "ambo medico":       "https://articulo.mercadolibre.com.ar/MLA-840278922-ambo-medico-unisex-uniformes-sanitario-excelente-calidad-_JM",
    "ambo enfermeria":   "https://articulo.mercadolibre.com.ar/MLA-840278922-ambo-medico-unisex-uniformes-sanitario-excelente-calidad-_JM",
    "ambo":              "https://articulo.mercadolibre.com.ar/MLA-840278922-ambo-medico-unisex-uniformes-sanitario-excelente-calidad-_JM",
    "campera":           "https://articulo.mercadolibre.com.ar/MLA-868535335-campera-trabajo-trucker-termica-todos-los-talles-_JM",
    "mameluco":          "https://articulo.mercadolibre.com.ar/MLA-860586514-mameluco-de-trabajo-azul-_JM",
    "camisa":            "https://articulo.mercadolibre.com.ar/MLA-824976661-camisa-de-trabajo-gabardina-varios-colores-_JM",
    "buzo":              "https://articulo.mercadolibre.com.ar/MLA-868545594-buzo-de-friza-hombre-liso-trabajo-_JM",
    "remera":            "https://articulo.mercadolibre.com.ar/MLA-1659921072-remera-hombre-lisa-algodon-_JM",
}


def detect_product_link(text: str) -> str | None:
    t = text.lower()
    for keyword in sorted(PRODUCT_LINKS, key=len, reverse=True):
        if keyword in t:
            return PRODUCT_LINKS[keyword]
    return None


# Bot main menu selection → stage + tag
MENU_OPTIONS = {
    "mayorista": {
        "status": STATUS_CONTACTADO, "tag": "mayorista",
        "reply": "Genial! Para compras mayoristas (mas de 10 unidades del mismo producto) te armamos un presupuesto personalizado.\nQue productos te interesan y en que cantidades?",
    },
    "minorista": {
        "status": STATUS_MINORISTA_CONTACTO, "pipeline_id": PIPELINE_MINORISTA, "tag": "minorista",
        "reply": None,  # sends product sub-menu instead
    },
    "empresa": {
        "status": STATUS_CONTACTADO, "tag": "empresa",
        "reply": "Entendido! Para compras corporativas o licitaciones, un asesor te contactara en breve.\nPodes dejarnos tu nombre, empresa y detalle de lo que necesitas?",
    },
    "consulta": {
        "status": STATUS_CONTACTADO, "tag": "consulta",
        "reply": "Claro! Contanos tu consulta y te respondemos a la brevedad.\nNuestro horario de atencion es de 9 a 17 hs.",
    },
}

# Welcome interactive list message
WELCOME_MENU = {
    "body": "Hola! Bienvenido a *Indumentaria Segura*.\nComo podemos ayudarte hoy?",
    "button": "Ver opciones",
    "sections": [{
        "title": "Tipo de compra",
        "rows": [
            {"id": "mayorista", "title": "Mayorista",     "description": "Mas de 10 unidades del mismo producto"},
            {"id": "minorista", "title": "Minorista",     "description": "Compra individual o pocas unidades"},
            {"id": "empresa",   "title": "Empresa",       "description": "Compras corporativas o licitaciones"},
            {"id": "consulta",  "title": "Otra consulta", "description": "Otros productos o consultas generales"},
        ],
    }],
}

# Product sub-menu (shown after Minorista is selected)
PRODUCT_MENU = {
    "body": "Que producto estas buscando?",
    "button": "Ver productos",
    "sections": [{
        "title": "Productos disponibles",
        "rows": [
            {"id": "prod_pantalones", "title": "Pantalones",  "description": "Cargo, clasico y nautico"},
            {"id": "prod_ambos",      "title": "Ambos",       "description": "Ambo medico unisex"},
            {"id": "prod_camperas",   "title": "Camperas",    "description": "Campera trucker termica"},
            {"id": "prod_mamelucos",  "title": "Mamelucos",   "description": "Mameluco de trabajo"},
            {"id": "prod_camisas",    "title": "Camisas",     "description": "Camisa de trabajo gabardina"},
            {"id": "prod_buzos",      "title": "Buzos",       "description": "Buzo de friza liso"},
            {"id": "prod_remeras",    "title": "Remeras",     "description": "Remera lisa algodon"},
            {"id": "prod_bermudas",   "title": "Bermudas",    "description": "Consultar disponibilidad"},
            {"id": "prod_delantales", "title": "Delantales",  "description": "Consultar disponibilidad"},
        ],
    }],
}


def classify_ml_product(title: str) -> str:
    t = title.lower()
    for kw, cat in [
        (["pantalon", "cargo", "nautico", "clasico"], "pantalones"),
        (["ambo", "medico", "sanitario", "enfermeria"], "ambos"),
        (["campera", "trucker", "termica"], "camperas"),
        (["mameluco"], "mamelucos"),
        (["buzo", "friza"], "buzos"),
        (["remera"], "remeras"),
        (["camisa", "gabardina"], "camisas"),
    ]:
        if any(k in t for k in kw):
            return cat
    return "otros"


def qualify_lead(text: str) -> dict:
    t = text.lower()
    tags = []
    status = STATUS_LEADS_ENTRANTES
    if any(k in t for k in KEYWORDS_VENTA):
        tags.append("venta")
        status = STATUS_VENTA_CERRADA
    elif any(k in t for k in KEYWORDS_PERDIDO):
        tags.append("perdido")
        status = STATUS_VENTA_PERDIDA
    elif any(k in t for k in KEYWORDS_PRESUPUESTO):
        tags.append("presupuesto")
        status = STATUS_PRESUPUESTO
    return {"tags": tags, "status": status}


def detect_stage_from_message(text: str) -> int | None:
    t = text.lower()
    if any(k in t for k in KEYWORDS_VENTA):
        return STATUS_VENTA_CERRADA
    if any(k in t for k in KEYWORDS_PERDIDO):
        return STATUS_VENTA_PERDIDA
    if any(k in t for k in KEYWORDS_PRESUPUESTO):
        return STATUS_PRESUPUESTO
    return None


class KommoService:
    def __init__(self):
        self.base_url = settings.KOMMO_BASE_URL.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.KOMMO_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        }

    async def get_leads(self, pipeline_id: int = None, limit: int = 50) -> list:
        params = {"limit": limit}
        if pipeline_id:
            params["filter[pipeline_id]"] = pipeline_id
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/api/v4/leads",
                headers=self.headers,
                params=params,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("_embedded", {}).get("leads", [])

    async def create_lead(self, name: str, phone: str, source: str, pipeline_id: int = None) -> dict:
        payload = [{
            "name": name,
            "custom_fields_values": [
                {"field_code": "PHONE", "values": [{"value": phone}]},
            ],
            "tags": [{"name": source}],
        }]
        if pipeline_id:
            payload[0]["pipeline_id"] = pipeline_id
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/v4/leads",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            leads = data.get("_embedded", {}).get("leads", [])
            return leads[0] if leads else {}

    async def create_lead_from_whatsapp(self, phone: str, contact_name: str, first_message: str) -> dict:
        qualification = qualify_lead(first_message)
        tags = [{"name": "WhatsApp"}, {"name": "AutoCRM"}]
        for t in qualification["tags"]:
            tags.append({"name": t})

        payload = [{
            "name": f"WA - {contact_name} | {phone}",
            "pipeline_id": PIPELINE_VENTAS,
            "tags": tags,
        }]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/v4/leads",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            if resp.status_code >= 400:
                print(f"[kommo] create_lead error {resp.status_code}: {resp.text[:500]}")
            resp.raise_for_status()
            leads = resp.json().get("_embedded", {}).get("leads", [])
            lead = leads[0] if leads else {}

            if lead.get("id") and first_message:
                await self.add_note(lead["id"], f"Primer mensaje WhatsApp:\n{first_message}")

            return lead

    async def create_lead_from_maps(self, phone: str, business_name: str, address: str) -> dict:
        payload = [{
            "name": f"Maps - {business_name}",
            "pipeline_id": PIPELINE_MAPS,
            "status_id": STATUS_MAPS_NUEVO,
            "custom_fields_values": [
                {"field_code": "PHONE", "values": [{"value": f"+{phone}"}]},
            ],
            "tags": [{"name": "Google Maps"}, {"name": "AutoCRM"}],
        }]
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/v4/leads",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            leads = resp.json().get("_embedded", {}).get("leads", [])
            lead = leads[0] if leads else {}
            if lead.get("id") and address:
                await self.add_note(lead["id"], f"Direccion: {address}")
            return lead

    async def move_lead_stage(self, lead_id: int, status_id: int) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{self.base_url}/api/v4/leads/{lead_id}",
                headers=self.headers,
                json={"status_id": status_id},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def move_lead_to_pipeline(self, lead_id: int, pipeline_id: int, status_id: int) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{self.base_url}/api/v4/leads/{lead_id}",
                headers=self.headers,
                json={"pipeline_id": pipeline_id, "status_id": status_id},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def update_lead_status(self, lead_id: int, status_id: int) -> dict:
        return await self.move_lead_stage(lead_id, status_id)

    async def get_pipelines(self) -> list:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/api/v4/leads/pipelines",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("_embedded", {}).get("pipelines", [])

    async def add_note(self, lead_id: int, text: str) -> dict:
        payload = [{"entity_id": lead_id, "note_type": "common", "params": {"text": text}}]
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/v4/leads/{lead_id}/notes",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def add_task(self, lead_id: int, text: str, due_hours: int = 2) -> dict:
        import time
        due_ts = int(time.time()) + (due_hours * 3600)
        payload = [{
            "entity_id": lead_id,
            "entity_type": "leads",
            "task_type_id": 1,
            "text": text,
            "complete_till": due_ts,
        }]
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/v4/tasks",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def find_lead_by_phone(self, phone: str) -> dict | None:
        digits = "".join(c for c in phone if c.isdigit())
        if not digits.startswith("54"):
            digits = "54" + digits
        async with httpx.AsyncClient() as client:
            for query in [digits, phone]:
                resp = await client.get(
                    f"{self.base_url}/api/v4/leads",
                    headers=self.headers,
                    params={"query": query, "limit": 10, "with": "tags,contacts"},
                    timeout=15,
                )
                if resp.status_code != 200:
                    continue
                leads = resp.json().get("_embedded", {}).get("leads", [])
                if not leads:
                    continue
                # If duplicates exist (VENTAS + ML), prefer the ML one
                ml = next((l for l in leads if l.get("pipeline_id") == PIPELINE_ML), None)
                return ml if ml else leads[0]
        return None

    async def get_pipeline_stages(self, pipeline_id: int) -> dict:
        """Returns {stage_name_lower: stage_id} for the given pipeline."""
        async with httpx.AsyncClient() as client:
            # Try direct pipeline endpoint first
            resp = await client.get(
                f"{self.base_url}/api/v4/leads/pipelines/{pipeline_id}",
                headers=self.headers,
                timeout=15,
            )
            if resp.status_code == 200:
                statuses = resp.json().get("_embedded", {}).get("statuses", [])
                result = {s["name"].lower().strip(): s["id"] for s in statuses if s.get("type") != 10}
                if result:
                    return result

            # Fallback: list all pipelines and find matching
            resp2 = await client.get(
                f"{self.base_url}/api/v4/leads/pipelines",
                headers=self.headers,
                timeout=15,
            )
            if resp2.status_code != 200:
                return {}
            pipelines = resp2.json().get("_embedded", {}).get("pipelines", [])
            for p in pipelines:
                if p.get("id") == pipeline_id:
                    statuses = p.get("_embedded", {}).get("statuses", [])
                    return {s["name"].lower().strip(): s["id"] for s in statuses if s.get("type") != 10}
            return {}

    async def create_lead_from_ml_question(self, question: dict) -> dict:
        item = question.get("item", {})
        item_title = item.get("title", "") or f"Consulta {question.get('item_id', 'ML')}"
        buyer = question.get("from", {})
        buyer_name = buyer.get("nickname", "") or "Comprador ML"
        category = classify_ml_product(item_title)

        stages = await self.get_pipeline_stages(PIPELINE_ML)
        stage_id = (stages.get(category) or stages.get("otros")
                    or ML_STAGE_IDS.get(category) or ML_STAGE_IDS["otros"])

        payload: dict = {
            "name": f"ML - {buyer_name}",
            "pipeline_id": PIPELINE_ML,
            "tags": [{"name": "MercadoLibre"}, {"name": category.upper()}],
        }
        if stage_id:
            payload["status_id"] = stage_id

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/api/v4/leads",
                headers=self.headers,
                json=[payload],
                timeout=15,
            )
            if resp.status_code >= 400:
                return {}
            leads = resp.json().get("_embedded", {}).get("leads", [])
            lead = leads[0] if leads else {}

        if lead.get("id"):
            note_lines = [f"Pregunta ML: {question.get('text', '')}",
                          f"Producto: {item_title}"]
            if item.get("permalink"):
                note_lines.append(item["permalink"])
            note_lines.append(f"Stock: {item.get('available_quantity', '—')} u.")
            await self.add_note(lead["id"], "\n".join(note_lines))
        return lead

    async def find_ml_lead_by_nickname(self, nickname: str) -> dict | None:
        """Find a lead in PIPELINE_ML whose name starts with 'ML - <nickname>'."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/api/v4/leads",
                headers=self.headers,
                params={"query": f"ML - {nickname}", "filter[pipeline_id]": PIPELINE_ML, "limit": 5},
                timeout=15,
            )
            if resp.status_code != 200:
                return None
            leads = resp.json().get("_embedded", {}).get("leads", [])
            return leads[0] if leads else None

    async def add_tag(self, lead_id: int, tag: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{self.base_url}/api/v4/leads/{lead_id}",
                headers=self.headers,
                json={"tags": [{"name": tag}]},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
