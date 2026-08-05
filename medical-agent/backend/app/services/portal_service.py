import os
import re
import httpx
from bs4 import BeautifulSoup
from app.config import get_settings

settings = get_settings()


async def scrape_portal() -> dict:
    """Login to Alexander Fleming portal via httpx and download studies."""
    studies_dir = settings.STUDIES_DIR
    os.makedirs(studies_dir, exist_ok=True)
    downloaded = []
    errors = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=30, headers=headers) as client:
        try:
            # Step 1: Load login page
            resp = await client.get(settings.PORTAL_URL)
            soup = BeautifulSoup(resp.text, "html.parser")

            # Find login form
            form = soup.find("form")
            if not form:
                errors.append("No se encontró formulario de login en el portal")
                return {"downloaded": [], "errors": errors}

            # Build form data from existing hidden fields + credentials
            form_data: dict = {}
            for inp in soup.find_all("input"):
                name = inp.get("name", "")
                value = inp.get("value", "")
                if name:
                    form_data[name] = value

            # Fill patient ID and DNI — try common field names
            id_fields = ["usuario", "paciente", "nroPaciente", "id_paciente", "user", "username", "login"]
            dni_fields = ["dni", "documento", "clave", "password", "pass", "contrasena"]

            id_filled = False
            dni_filled = False
            for f in id_fields:
                if f in form_data or any(f.lower() in k.lower() for k in form_data):
                    key = next((k for k in form_data if f.lower() in k.lower()), f)
                    form_data[key] = settings.PORTAL_PATIENT_ID
                    id_filled = True
                    break

            for f in dni_fields:
                if f in form_data or any(f.lower() in k.lower() for k in form_data):
                    key = next((k for k in form_data if f.lower() in k.lower()), f)
                    form_data[key] = settings.PORTAL_DNI
                    dni_filled = True
                    break

            # If we couldn't detect fields, try the first two text/password inputs
            inputs = soup.find_all("input", type=lambda t: t in [None, "text", "password", "number"])
            if not id_filled and len(inputs) >= 1:
                form_data[inputs[0].get("name", "usuario")] = settings.PORTAL_PATIENT_ID
            if not dni_filled and len(inputs) >= 2:
                form_data[inputs[1].get("name", "clave")] = settings.PORTAL_DNI

            # Step 2: Submit login
            action = form.get("action", "/")
            if not action.startswith("http"):
                base = settings.PORTAL_URL.rstrip("/")
                action = base + "/" + action.lstrip("/")

            method = form.get("method", "post").lower()
            if method == "post":
                login_resp = await client.post(action, data=form_data)
            else:
                login_resp = await client.get(action, params=form_data)

            # Step 3: Find downloadable study links
            page_soup = BeautifulSoup(login_resp.text, "html.parser")
            links = page_soup.find_all("a", href=True)

            for link in links:
                href = link["href"]
                text = link.get_text(strip=True) or os.path.basename(href)
                if any(kw in href.lower() for kw in [".pdf", "resultado", "estudio", "informe", "reporte", "download"]):
                    full_url = href if href.startswith("http") else settings.PORTAL_URL.rstrip("/") + "/" + href.lstrip("/")
                    try:
                        dl = await client.get(full_url)
                        if dl.status_code == 200 and len(dl.content) > 100:
                            safe = re.sub(r"[^\w\-.]", "_", text)[:80]
                            if not safe.endswith(".pdf"):
                                safe += ".pdf"
                            dest = os.path.join(studies_dir, safe)
                            with open(dest, "wb") as f:
                                f.write(dl.content)
                            downloaded.append(safe)
                    except Exception as e:
                        errors.append(f"{text}: {e}")

            if not downloaded and not errors:
                errors.append("Login exitoso pero no se encontraron estudios descargables. Intentá subir los archivos manualmente.")

        except Exception as e:
            errors.append(str(e))

    return {"downloaded": downloaded, "errors": errors}
