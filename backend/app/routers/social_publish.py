import os
import io
import json
import uuid
import asyncio
import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from PIL import Image
from app.config import get_settings

router = APIRouter(prefix="/social", tags=["social-publish"])

UPLOAD_DIR = "/app/data/uploads"
META_TOKENS_PATH = "/app/data/meta_tokens.json"
PANEL_BASE_URL = "https://panel.indumentariasegura.com.ar"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp"}


def load_meta_tokens() -> dict:
    try:
        with open(META_TOKENS_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def get_meta_creds() -> dict:
    saved = load_meta_tokens()
    settings = get_settings()
    return {
        "access_token":  saved.get("access_token")  or settings.META_ACCESS_TOKEN or "",
        "page_id":       saved.get("page_id")        or settings.META_PAGE_ID or "",
        "ig_account_id": saved.get("ig_account_id") or settings.META_IG_ACCOUNT_ID or "",
        "ad_account_id": saved.get("ad_account_id") or "",
    }


async def _boost_post(
    client: httpx.AsyncClient,
    access_token: str,
    ad_account_id: str,
    page_id: str,
    post_id: str,
    daily_budget_ars: float,
) -> dict:
    """Create a simple boosted post campaign via Meta Ads API."""
    act = f"act_{ad_account_id.lstrip('act_')}"
    # Budget in centavos (Meta expects smallest currency unit)
    daily_budget_centavos = int(daily_budget_ars * 100)

    # 1. Create campaign
    r1 = await client.post(
        f"https://graph.facebook.com/v18.0/{act}/campaigns",
        params={
            "name": "AutoCRM Boost",
            "objective": "POST_ENGAGEMENT",
            "status": "ACTIVE",
            "special_ad_categories": "[]",
            "access_token": access_token,
        },
    )
    d1 = r1.json()
    if "error" in d1:
        return {"error": d1["error"].get("message", "Error creando campaña")}
    campaign_id = d1["id"]

    # 2. Create ad set with daily budget
    r2 = await client.post(
        f"https://graph.facebook.com/v18.0/{act}/adsets",
        params={
            "name": "AutoCRM Ad Set",
            "campaign_id": campaign_id,
            "daily_budget": daily_budget_centavos,
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "POST_ENGAGEMENT",
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
            "targeting": json.dumps({
                "geo_locations": {"countries": ["AR"]},
                "age_min": 18,
                "age_max": 65,
            }),
            "status": "ACTIVE",
            "access_token": access_token,
        },
    )
    d2 = r2.json()
    if "error" in d2:
        return {"error": d2["error"].get("message", "Error creando ad set")}
    adset_id = d2["id"]

    # 3. Create ad creative from the published post
    r3 = await client.post(
        f"https://graph.facebook.com/v18.0/{act}/adcreatives",
        params={
            "name": "AutoCRM Creative",
            "object_story_id": f"{page_id}_{post_id.split('_')[-1]}",
            "access_token": access_token,
        },
    )
    d3 = r3.json()
    if "error" in d3:
        return {"error": d3["error"].get("message", "Error creando creative")}
    creative_id = d3["id"]

    # 4. Create ad
    r4 = await client.post(
        f"https://graph.facebook.com/v18.0/{act}/ads",
        params={
            "name": "AutoCRM Ad",
            "adset_id": adset_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": "ACTIVE",
            "access_token": access_token,
        },
    )
    d4 = r4.json()
    if "error" in d4:
        return {"error": d4["error"].get("message", "Error creando anuncio")}

    return {
        "boosted": True,
        "campaign_id": campaign_id,
        "ad_id": d4["id"],
        "daily_budget_ars": daily_budget_ars,
    }


def _pad_for_instagram(data: bytes) -> bytes:
    """Pad image to fit Instagram's max 4:5 portrait ratio (adds white side bars if too tall)."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    # Instagram allows h/w up to 1.25 (4:5 portrait). Taller images get cropped in the feed.
    if h / w > 1.25:
        target_w = int(h / 1.25)
        padded = Image.new("RGB", (target_w, h), (255, 255, 255))
        padded.paste(img, ((target_w - w) // 2, 0))
        img = padded
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=95)
    return out.getvalue()


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "Formato no soportado. Usá JPG, PNG o WEBP.")
    content = await file.read()
    try:
        content = _pad_for_instagram(content)
        ext = "jpg"
    except Exception:
        pass
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)
    return {"url": f"{PANEL_BASE_URL}/uploads/{filename}"}


class PublishRequest(BaseModel):
    caption: str
    image_url: str
    platform: str       # instagram | facebook | ambas
    budget_ars: float = 0  # optional daily budget in ARS — if > 0, boost the Facebook post


class MetaConfigRequest(BaseModel):
    access_token: str
    page_id: str = ""
    ig_account_id: str = ""
    ad_account_id: str = ""


@router.post("/meta-config")
async def save_meta_config(req: MetaConfigRequest):
    os.makedirs(os.path.dirname(META_TOKENS_PATH), exist_ok=True)
    # Preserve existing values not being updated
    existing = load_meta_tokens()
    data = {
        "access_token":  req.access_token.strip() or existing.get("access_token", ""),
        "page_id":       req.page_id.strip()       or existing.get("page_id", ""),
        "ig_account_id": req.ig_account_id.strip() or existing.get("ig_account_id", ""),
        "ad_account_id": req.ad_account_id.strip() or existing.get("ad_account_id", ""),
    }
    with open(META_TOKENS_PATH, "w") as f:
        json.dump(data, f)
    return {"saved": True}


@router.post("/publish")
async def publish_post(req: PublishRequest):
    creds = get_meta_creds()
    if not creds["access_token"]:
        raise HTTPException(500, "Meta Access Token no configurado — guardalo en Configuración > Meta")

    results: dict = {}

    async with httpx.AsyncClient(timeout=60) as client:
        # ── Instagram ──────────────────────────────────────────────────────────
        if req.platform in ("instagram", "ambas"):
            if not creds["ig_account_id"]:
                results["instagram"] = {"error": "IG Account ID no configurado"}
            else:
                try:
                    r1 = await client.post(
                        f"https://graph.facebook.com/v18.0/{creds['ig_account_id']}/media",
                        params={
                            "image_url": req.image_url,
                            "caption": req.caption,
                            "access_token": creds["access_token"],
                        },
                    )
                    d1 = r1.json()
                    if "error" in d1:
                        results["instagram"] = {"error": d1["error"].get("message", "Error al crear container")}
                    else:
                        creation_id = d1["id"]
                        # Poll until Instagram finishes processing the image (max 30s)
                        for _ in range(10):
                            await asyncio.sleep(3)
                            rs = await client.get(
                                f"https://graph.facebook.com/v18.0/{creation_id}",
                                params={"fields": "status_code", "access_token": creds["access_token"]},
                            )
                            status_code = rs.json().get("status_code", "")
                            if status_code == "FINISHED":
                                break
                            if status_code == "ERROR":
                                results["instagram"] = {"error": "Instagram rechazó la imagen — verificá que sea JPG/PNG accesible públicamente"}
                                break
                        else:
                            status_code = "TIMEOUT"

                        if status_code == "FINISHED":
                            r2 = await client.post(
                                f"https://graph.facebook.com/v18.0/{creds['ig_account_id']}/media_publish",
                                params={
                                    "creation_id": creation_id,
                                    "access_token": creds["access_token"],
                                },
                            )
                            d2 = r2.json()
                            if "error" in d2:
                                results["instagram"] = {"error": d2["error"].get("message", "Error al publicar")}
                            else:
                                results["instagram"] = {"success": True, "post_id": d2.get("id")}
                        elif status_code not in ("ERROR",):
                            results["instagram"] = {"error": f"Tiempo de espera agotado procesando imagen (status: {status_code})"}
                except Exception as e:
                    results["instagram"] = {"error": str(e)}

        # ── Facebook Page ──────────────────────────────────────────────────────
        if req.platform in ("facebook", "ambas"):
            if not creds["page_id"]:
                results["facebook"] = {"error": "Page ID no configurado"}
            else:
                try:
                    r = await client.post(
                        f"https://graph.facebook.com/v18.0/{creds['page_id']}/photos",
                        params={
                            "url": req.image_url,
                            "message": req.caption,
                            "access_token": creds["access_token"],
                        },
                    )
                    d = r.json()
                    if "error" in d:
                        results["facebook"] = {"error": d["error"].get("message", "Error al publicar")}
                    else:
                        fb_post_id = d.get("post_id") or d.get("id")
                        results["facebook"] = {"success": True, "post_id": fb_post_id}

                        # ── Boost post if budget provided ──────────────────
                        ad_account_id = creds.get("ad_account_id", "")
                        if req.budget_ars > 0 and ad_account_id and fb_post_id:
                            try:
                                boost = await _boost_post(
                                    client=client,
                                    access_token=creds["access_token"],
                                    ad_account_id=ad_account_id,
                                    page_id=creds["page_id"],
                                    post_id=fb_post_id,
                                    daily_budget_ars=req.budget_ars,
                                )
                                results["facebook"]["boost"] = boost
                            except Exception as be:
                                results["facebook"]["boost"] = {"error": str(be)}
                        elif req.budget_ars > 0 and not ad_account_id:
                            results["facebook"]["boost"] = {"error": "Ad Account ID no configurado — guardalo en Configuración > Meta"}
                except Exception as e:
                    results["facebook"] = {"error": str(e)}

    return results


@router.get("/meta-status")
async def meta_status():
    creds = get_meta_creds()
    return {
        "configured": bool(creds["access_token"]),
        "instagram": bool(creds["ig_account_id"]),
        "facebook": bool(creds["page_id"]),
    }
