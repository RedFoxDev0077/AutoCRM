import math
import httpx
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import get_settings
from app.models.lead import Lead, LeadSource, LeadStatus
from app.services.kommo_service import KommoService
from app.services.whatsapp_service import WhatsAppService


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

settings = get_settings()
PLACES_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAIL_URL = "https://maps.googleapis.com/maps/api/place/details/json"
GEOCODE_URL       = "https://maps.googleapis.com/maps/api/geocode/json"


class LeadsService:
    def __init__(self):
        self.redis    = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        self.kommo    = KommoService()
        self.whatsapp = WhatsAppService()
        self.key      = settings.GOOGLE_PLACES_API_KEY

    async def _geocode(self, location: str) -> str:
        async with httpx.AsyncClient() as client:
            r = await client.get(GEOCODE_URL, params={"address": location, "key": self.key}, timeout=10)
            results = r.json().get("results", [])
            if results:
                loc = results[0]["geometry"]["location"]
                return f"{loc['lat']},{loc['lng']}"
        return "-34.6037,-58.3816"  # Buenos Aires default

    async def search_places(self, query: str, location: str, radius_km: int = 10) -> list:
        center = await self._geocode(location)
        clat, clng = map(float, center.split(","))
        params = {
            "query": f"{query} en {location}",
            "location": center,
            "radius": radius_km * 1000,
            "language": "es",
            "key": self.key,
        }
        async with httpx.AsyncClient() as client:
            r = await client.get(PLACES_SEARCH_URL, params=params, timeout=20)
            r.raise_for_status()
            data = r.json()
            if data.get("status") not in ("OK", "ZERO_RESULTS"):
                raise Exception(f"Places API: {data.get('status')} — {data.get('error_message', '')}")
            # Strict distance filter — the API uses radius as a bias, not a hard limit
            places = [
                p for p in data.get("results", [])
                if _distance_km(
                    clat, clng,
                    p["geometry"]["location"]["lat"],
                    p["geometry"]["location"]["lng"],
                ) <= radius_km
            ]

        # Fetch phone numbers via Place Details (max 15 results)
        enriched = []
        async with httpx.AsyncClient() as client:
            for place in places[:15]:
                detail_r = await client.get(
                    PLACES_DETAIL_URL,
                    params={
                        "place_id": place["place_id"],
                        "fields": "name,formatted_address,international_phone_number",
                        "key": self.key,
                    },
                    timeout=10,
                )
                det = detail_r.json().get("result", {})
                phone_raw = det.get("international_phone_number", "")
                # Convert +54 9 11 1234-5678 → digits only
                phone = "".join(c for c in phone_raw if c.isdigit())
                enriched.append({
                    "name": place.get("name", ""),
                    "address": place.get("formatted_address", ""),
                    "place_id": place.get("place_id", ""),
                    "phone": phone,
                })

        return enriched

    async def process_lead(self, place: dict, db: AsyncSession) -> Lead | None:
        phone = place.get("phone", "")
        if not phone:
            return None

        redis_key = f"lead:phone:{phone}"
        if await self.redis.exists(redis_key):
            return None

        result = await db.execute(select(Lead).where(Lead.phone == phone))
        if result.scalar_one_or_none():
            return None

        lead = Lead(
            phone=phone,
            name=place.get("name", ""),
            business_name=place.get("name", ""),
            address=place.get("address", ""),
            google_place_id=place.get("place_id", ""),
            source=LeadSource.google_maps,
            status=LeadStatus.new,
        )
        db.add(lead)
        await db.commit()
        await db.refresh(lead)

        await self.redis.setex(redis_key, 2592000, "1")

        try:
            kommo_lead = await self.kommo.create_lead_from_maps(
                phone=phone,
                business_name=lead.business_name or lead.name,
                address=place.get("address", ""),
            )
            if kommo_lead.get("id"):
                lead.kommo_lead_id = str(kommo_lead["id"])
                await db.commit()
        except Exception:
            pass

        # Send WhatsApp first contact template automatically
        try:
            await self.whatsapp.send_template(
                phone=phone,
                template_name="primer_contacto_maps",
                language="es",
                params=[lead.business_name or lead.name or ""],
            )
            lead.status = LeadStatus.contacted
            await db.commit()
        except Exception:
            pass

        return lead
