from fastapi import APIRouter, Depends, Request, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models.message import Message, MessageDirection, MessageStatus
from app.models.lead import Lead as LeadModel
from app.schemas.message import SendMessageRequest, SendTemplateRequest, MessageResponse
from app.services.whatsapp_service import WhatsAppService
from app.config import get_settings

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
settings = get_settings()


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    from fastapi.responses import PlainTextResponse
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(content=hub_challenge, status_code=200)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    try:
        entry = body["entry"][0]["changes"][0]["value"]
        contacts = entry.get("contacts", [{}])
        contact_name = contacts[0].get("profile", {}).get("name", "") if contacts else ""

        for msg in entry.get("messages", []):
            phone = msg["from"]
            msg_type = msg.get("type", "text")
            wa_id = msg["id"]

            if msg_type == "text":
                text = msg.get("text", {}).get("body", "")
                selection_id = None
            elif msg_type == "interactive":
                interactive = msg.get("interactive", {})
                list_reply = interactive.get("list_reply", {})
                selection_id = list_reply.get("id", "")
                text = list_reply.get("title", "")
            else:
                text = ""
                selection_id = None

            existing = await db.scalar(
                select(Message).where(
                    Message.phone == phone,
                    Message.direction == MessageDirection.inbound,
                )
            )
            is_new_contact = existing is None

            # If this phone belongs to a Maps outreach lead, never send the welcome menu.
            # They are our prospective client, not an incoming customer.
            maps_lead = await db.scalar(
                select(LeadModel).where(LeadModel.phone == phone)
            )
            if maps_lead:
                is_new_contact = False

            db.add(Message(
                phone=phone,
                direction=MessageDirection.inbound,
                content=text,
                wa_message_id=wa_id,
                status=MessageStatus.received,
            ))
            await db.commit()

            wa = WhatsAppService()
            from app.services.kommo_service import (
                KommoService, MENU_OPTIONS, WELCOME_MENU, PRODUCT_MENU, PRODUCT_REPLIES,
                PRODUCT_STAGE_MAP, PIPELINE_ML, PIPELINE_MAPS, STATUS_MAPS_INTERESADO,
            )
            kommo = KommoService()

            # Maps lead replied — log in Kommo and stop; don't trigger welcome flow
            if maps_lead and msg_type == "text" and text:
                try:
                    kommo_id = maps_lead.kommo_lead_id
                    if kommo_id:
                        await kommo.add_note(int(kommo_id), f"[WA Maps] {contact_name or phone}: {text}")
                        await kommo.move_lead_stage(int(kommo_id), STATUS_MAPS_INTERESADO)
                    else:
                        # Lead was never synced to Kommo — create it now
                        from app.services.kommo_service import KommoService
                        k_lead = await kommo.create_lead_from_maps(
                            phone=phone,
                            business_name=maps_lead.business_name or maps_lead.name or "",
                            address=maps_lead.address or "",
                        )
                        if k_lead.get("id"):
                            maps_lead.kommo_lead_id = str(k_lead["id"])
                            await db.commit()
                            await kommo.add_note(k_lead["id"], f"[WA Maps respuesta] {contact_name or phone}: {text}")
                            await kommo.move_lead_stage(k_lead["id"], STATUS_MAPS_INTERESADO)
                except Exception as e:
                    print(f"[bot] maps_lead note error: {e}")

            if is_new_contact and msg_type in ("text", "interactive"):
                # New contact — check Kommo and create lead if needed
                existing_lead = None
                try:
                    existing_lead = await kommo.find_lead_by_phone(phone)
                except Exception:
                    pass

                lead_id = None
                from app.routers.google_ads import GADS_TRIGGER
                is_gads = msg_type == "text" and GADS_TRIGGER.lower() in text.lower()

                if not existing_lead:
                    try:
                        lead = await kommo.create_lead_from_whatsapp(
                            phone, contact_name or phone, text
                        )
                        if lead.get("id"):
                            lead_id = lead["id"]
                            await kommo.add_task(
                                lead_id,
                                f"Nuevo contacto WhatsApp: {contact_name or phone} — responder en menos de 2hs",
                                due_hours=2,
                            )
                    except Exception as e:
                        print(f"[bot] create_lead error: {e}")
                else:
                    lead_id = existing_lead.get("id")

                # Tag Google Ads leads regardless of whether lead is new or existing
                if is_gads and lead_id:
                    try:
                        await kommo.add_tag(lead_id, "Google Ads")
                        await kommo.add_tag(lead_id, "GAds")
                    except Exception as e:
                        print(f"[bot] gads tag error: {e}")

                # Only send welcome if truly new — never re-send to contacts already in Kommo
                if not existing_lead:
                    try:
                        await wa.send_interactive_list(
                            phone,
                            WELCOME_MENU["body"],
                            WELCOME_MENU["button"],
                            WELCOME_MENU["sections"],
                        )
                        if lead_id:
                            await kommo.add_note(lead_id, "Bot: Envio menu de bienvenida")
                    except Exception as e:
                        print(f"[bot] welcome_menu error: {e}")

            elif msg_type == "interactive" and selection_id:

                if selection_id in PRODUCT_REPLIES:
                    # Product sub-menu selection → send ML link + move to correct stage
                    product = PRODUCT_REPLIES[selection_id]
                    try:
                        await wa.send_message(phone, product["text"])
                    except Exception as e:
                        print(f"[bot] product reply error: {e}")
                    try:
                        lead = await kommo.find_lead_by_phone(phone)
                        if lead and lead.get("id"):
                            prod_name = selection_id.replace("prod_", "").capitalize()
                            await kommo.add_note(lead["id"], f"Bot: Cliente seleccionó {prod_name}. Link enviado:\n{product['text'][:200]}")
                            stage_id = PRODUCT_STAGE_MAP.get(selection_id)
                            if stage_id:
                                await kommo.move_lead_to_pipeline(lead["id"], PIPELINE_ML, stage_id)
                    except Exception as e:
                        print(f"[bot] product note/stage error: {e}")

                elif selection_id in MENU_OPTIONS:
                    option = MENU_OPTIONS[selection_id]
                    # Move lead in Kommo
                    try:
                        lead = await kommo.find_lead_by_phone(phone)
                        if lead and lead.get("id"):
                            pipeline_id = option.get("pipeline_id")
                            if pipeline_id:
                                await kommo.move_lead_to_pipeline(lead["id"], pipeline_id, option["status"])
                            else:
                                await kommo.move_lead_stage(lead["id"], option["status"])
                            await kommo.add_tag(lead["id"], option["tag"])
                    except Exception as e:
                        print(f"[bot] kommo move error: {e}")

                    if option.get("reply"):
                        # Send text reply
                        try:
                            await wa.send_message(phone, option["reply"])
                            lead = await kommo.find_lead_by_phone(phone)
                            if lead and lead.get("id"):
                                await kommo.add_note(lead["id"], f"Bot: {option['reply'][:300]}")
                        except Exception as e:
                            print(f"[bot] option reply error: {e}")
                    else:
                        # Minorista → send product sub-menu
                        try:
                            await wa.send_interactive_list(
                                phone,
                                PRODUCT_MENU["body"],
                                PRODUCT_MENU["button"],
                                PRODUCT_MENU["sections"],
                            )
                            lead = await kommo.find_lead_by_phone(phone)
                            if lead and lead.get("id"):
                                await kommo.add_note(lead["id"], "Bot: Envio menu de productos (Minorista)")
                        except Exception as e:
                            print(f"[bot] product_menu error: {e}")

            elif msg_type == "text" and text:
                from app.routers.google_ads import GADS_TRIGGER
                try:
                    lead = await kommo.find_lead_by_phone(phone)
                    if lead and lead.get("id"):
                        if GADS_TRIGGER.lower() in text.lower():
                            await kommo.add_tag(lead["id"], "Google Ads")
                            await kommo.add_tag(lead["id"], "GAds")
                        await kommo.add_note(lead["id"], f"[WA] {contact_name or phone}: {text}")
                except Exception as e:
                    print(f"[bot] text note error: {e}")

    except (KeyError, IndexError):
        pass
    return {"status": "ok"}


class SuggestReplyRequest(BaseModel):
    phone: str


@router.post("/suggest-reply")
async def suggest_reply(req: SuggestReplyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.phone == req.phone)
        .order_by(Message.created_at.desc())
        .limit(15)
    )
    msgs = result.scalars().all()
    msgs_data = [
        {"direction": m.direction.value, "content": m.content or ""}
        for m in reversed(msgs)
    ]

    lead_context: dict = {}
    try:
        from app.services.kommo_service import KommoService
        kommo = KommoService()
        lead = await kommo.find_lead_by_phone(req.phone)
        if lead:
            lead_context["name"] = lead.get("name", "")
            lead_context["stage"] = str(lead.get("status_id", ""))
            embedded = lead.get("_embedded", {})
            tags = embedded.get("tags", [])
            lead_context["tags"] = [t.get("name", "") for t in tags if t.get("name")]
    except Exception:
        pass

    from app.services.claude_service import ClaudeService
    claude = ClaudeService()
    try:
        suggestions = await claude.suggest_replies(msgs_data, lead_context)
        return {"suggestions": suggestions, "message_count": len(msgs_data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send")
async def send_message(req: SendMessageRequest, db: AsyncSession = Depends(get_db)):
    svc = WhatsAppService()
    result = await svc.send_message(req.phone, req.message)
    msg = Message(
        phone=req.phone,
        direction=MessageDirection.outbound,
        content=req.message,
        status=MessageStatus.sent,
        wa_message_id=result.get("messages", [{}])[0].get("id"),
    )
    db.add(msg)
    await db.commit()

    if "gracias por tu compra" in req.message.lower():
        try:
            from app.services.kommo_service import KommoService, STATUS_VOLVER_CONTACTAR, PIPELINE_VENTAS
            kommo = KommoService()
            lead = await kommo.find_lead_by_phone(req.phone)
            if lead and lead.get("id") and lead.get("pipeline_id") == PIPELINE_VENTAS:
                await kommo.move_lead_stage(lead["id"], STATUS_VOLVER_CONTACTAR)
        except Exception:
            pass

    return {"status": "sent", "wa_message_id": msg.wa_message_id}


@router.post("/send-template")
async def send_template(req: SendTemplateRequest, db: AsyncSession = Depends(get_db)):
    svc = WhatsAppService()
    result = await svc.send_template(req.phone, req.template_name, req.language, req.params)
    msg = Message(
        phone=req.phone,
        direction=MessageDirection.outbound,
        content=f"[Template: {req.template_name}]",
        template_name=req.template_name,
        status=MessageStatus.sent,
    )
    db.add(msg)
    await db.commit()
    return {"status": "sent"}


@router.get("/templates")
async def get_templates():
    svc = WhatsAppService()
    try:
        return await svc.get_templates()
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/messages", response_model=list[MessageResponse])
async def get_messages(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Message).order_by(desc(Message.created_at)).limit(limit))
    return result.scalars().all()


@router.get("/status")
async def whatsapp_status():
    svc = WhatsAppService()
    try:
        await svc.get_templates()
        return {"connected": True, "phone_id": settings.WHATSAPP_PHONE_ID}
    except Exception:
        return {"connected": False}
