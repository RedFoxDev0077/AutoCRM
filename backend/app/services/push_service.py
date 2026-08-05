import json
import base64
import httpx
from cryptography.hazmat.primitives.asymmetric.ec import generate_private_key, SECP256R1, ECDH
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.hmac import HMAC
from cryptography.hazmat.backends import default_backend
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.push_subscription import PushSubscription
from app.config import get_settings
import time
import struct

settings = get_settings()


def _b64decode(s: str) -> bytes:
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


async def _send_web_push(endpoint: str, p256dh: str, auth_key: str, title: str, body: str, url: str = "/") -> bool:
    payload = json.dumps({"title": title, "body": body, "url": url}).encode()
    try:
        async with httpx.AsyncClient() as client:
            from pywebpush import webpush, WebPushException
            import threading
            result = {"ok": False}

            def _push():
                try:
                    webpush(
                        subscription_info={
                            "endpoint": endpoint,
                            "keys": {"p256dh": p256dh, "auth": auth_key},
                        },
                        data=json.dumps({"title": title, "body": body, "url": url}),
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": settings.VAPID_EMAIL},
                    )
                    result["ok"] = True
                except Exception as e:
                    print(f"[push] error: {e}")

            t = threading.Thread(target=_push)
            t.start()
            t.join(timeout=15)
            return result["ok"]
    except Exception as e:
        print(f"[push] send error: {e}")
        return False


async def send_push_to_all(db: AsyncSession, title: str, body: str, url: str = "/") -> int:
    subs = (await db.execute(select(PushSubscription))).scalars().all()
    sent = 0
    stale = []
    for sub in subs:
        ok = await _send_web_push(sub.endpoint, sub.p256dh, sub.auth, title, body, url)
        if ok:
            sent += 1
        else:
            stale.append(sub.id)
    return sent
