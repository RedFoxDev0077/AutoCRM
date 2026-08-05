import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import FileResponse
from app.config import get_settings

router = APIRouter(prefix="/studies", tags=["studies"])
settings = get_settings()

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt"}


@router.get("")
def list_studies():
    d = settings.STUDIES_DIR
    if not os.path.isdir(d):
        return []
    files = []
    for fname in sorted(os.listdir(d)):
        if fname.startswith("_"):
            continue
        fpath = os.path.join(d, fname)
        stat = os.stat(fpath)
        files.append({
            "name": fname,
            "size": stat.st_size,
            "modified": stat.st_mtime,
        })
    return files


@router.post("/upload")
async def upload_study(file: UploadFile = File(...), note: str = Form(default="")):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido: {ext}")

    dest = os.path.join(settings.STUDIES_DIR, file.filename or "upload")
    os.makedirs(settings.STUDIES_DIR, exist_ok=True)
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Attach note as companion txt file
    if note.strip():
        note_path = dest.rsplit(".", 1)[0] + "_nota.txt"
        with open(note_path, "w", encoding="utf-8") as f:
            f.write(note)

    return {"message": "Archivo subido correctamente", "name": file.filename}


@router.post("/note")
async def save_note(title: str = Form(...), content: str = Form(...)):
    os.makedirs(settings.STUDIES_DIR, exist_ok=True)
    import re
    safe = re.sub(r"[^\w\-]", "_", title)[:60] + ".txt"
    with open(os.path.join(settings.STUDIES_DIR, safe), "w", encoding="utf-8") as f:
        f.write(content)
    return {"message": "Nota guardada", "name": safe}


@router.delete("/{filename}")
def delete_study(filename: str):
    path = os.path.join(settings.STUDIES_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    os.remove(path)
    return {"message": "Eliminado"}


@router.get("/download/{filename}")
def download_study(filename: str):
    path = os.path.join(settings.STUDIES_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(path, filename=filename)
