import httpx
from app.config import get_settings

settings = get_settings()

GRAPH_URL = "https://graph.facebook.com/v19.0"


def format_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "").replace("-", "").replace("+", "")
    if phone.startswith("0"):
        phone = phone[1:]
    # Only prepend Argentina country code for local numbers (≤10 digits)
    # Numbers already containing a country code (11+ digits) are used as-is
    if len(phone) <= 10 and not phone.startswith("54"):
        phone = "54" + phone
    return phone


class WhatsAppService:
    def __init__(self):
        self.phone_id = settings.WHATSAPP_PHONE_ID
        self.token = settings.WHATSAPP_TOKEN
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    async def send_message(self, phone: str, text: str) -> dict:
        phone = format_phone(phone)
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": text},
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GRAPH_URL}/{self.phone_id}/messages",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def send_template(self, phone: str, template_name: str,
                            language: str = "es_AR", params: list[str] = None) -> dict:
        phone = format_phone(phone)
        components = []
        if params:
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in params],
            })
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
                "components": components,
            },
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GRAPH_URL}/{self.phone_id}/messages",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_templates(self) -> list:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{GRAPH_URL}/{settings.WHATSAPP_BUSINESS_ID}/message_templates",
                headers=self.headers,
                params={"limit": 100},
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json().get("data", [])

    async def send_interactive_list(self, phone: str, body: str, button: str, sections: list) -> dict:
        phone = format_phone(phone)
        payload = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body},
                "action": {"button": button, "sections": sections},
            },
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GRAPH_URL}/{self.phone_id}/messages",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def mark_as_read(self, message_id: str) -> dict:
        payload = {"messaging_product": "whatsapp", "status": "read", "message_id": message_id}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GRAPH_URL}/{self.phone_id}/messages",
                headers=self.headers,
                json=payload,
                timeout=15,
            )
            return resp.json()
