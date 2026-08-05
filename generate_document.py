from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# ── Page margins ──────────────────────────────────────────────────────────────
for section in doc.sections:
    section.top_margin    = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin   = Cm(2.5)
    section.right_margin  = Cm(2.5)

# ── Color palette ─────────────────────────────────────────────────────────────
C_DARK   = RGBColor(0x1A, 0x1A, 0x2E)   # deep navy
C_ACCENT = RGBColor(0x16, 0x71, 0x3E)   # Mercado Verde / brand green
C_MID    = RGBColor(0x2D, 0x6A, 0x4F)   # mid green
C_LIGHT  = RGBColor(0x52, 0xB7, 0x88)   # light green
C_GRAY   = RGBColor(0x55, 0x55, 0x55)
C_WHITE  = RGBColor(0xFF, 0xFF, 0xFF)

# ── Helper: shade a table cell ─────────────────────────────────────────────────
def shade_cell(cell, hex_color: str):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd  = OxmlElement('w:shd')
    shd.set(qn('w:val'),   'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'),  hex_color)
    tcPr.append(shd)

def set_cell_border(cell, **kwargs):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for side in ('top','left','bottom','right','insideH','insideV'):
        tag = OxmlElement(f'w:{side}')
        tag.set(qn('w:val'),   kwargs.get('val',   'single'))
        tag.set(qn('w:sz'),    kwargs.get('sz',    '4'))
        tag.set(qn('w:space'), '0')
        tag.set(qn('w:color'), kwargs.get('color', 'auto'))
        tcBorders.append(tag)
    tcPr.append(tcBorders)

# ── Helper: heading paragraph ──────────────────────────────────────────────────
def heading(text, level=1, color=None, space_before=18, space_after=6):
    p   = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    run.font.size = {1: Pt(20), 2: Pt(15), 3: Pt(12)}.get(level, Pt(11))
    run.font.color.rgb = color or (C_ACCENT if level == 1 else C_DARK)
    pf = p.paragraph_format
    pf.space_before = Pt(space_before)
    pf.space_after  = Pt(space_after)
    return p

def body(text, bold=False, italic=False, color=None, indent=0, space_after=4):
    p   = doc.add_paragraph()
    run = p.add_run(text)
    run.bold   = bold
    run.italic = italic
    run.font.size = Pt(10.5)
    if color:
        run.font.color.rgb = color
    pf = p.paragraph_format
    pf.space_after       = Pt(space_after)
    pf.left_indent       = Cm(indent)
    return p

def bullet(text, bold_prefix=None, indent=0.5):
    p = doc.add_paragraph(style='List Bullet')
    if bold_prefix:
        rb = p.add_run(bold_prefix)
        rb.bold = True
        rb.font.size = Pt(10.5)
    r = p.add_run(text)
    r.font.size = Pt(10.5)
    p.paragraph_format.left_indent  = Cm(indent)
    p.paragraph_format.space_after  = Pt(3)
    return p

def divider():
    p  = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(2)
    pf.space_after  = Pt(2)
    r  = p.add_run('─' * 95)
    r.font.size  = Pt(7)
    r.font.color.rgb = C_LIGHT

# ══════════════════════════════════════════════════════════════════════════════
#  COVER PAGE
# ══════════════════════════════════════════════════════════════════════════════
cover = doc.add_paragraph()
cover.alignment = WD_ALIGN_PARAGRAPH.CENTER
pf = cover.paragraph_format
pf.space_before = Pt(40)
r = cover.add_run('AUTOMATIZACIÓN INTEGRAL')
r.bold = True
r.font.size  = Pt(28)
r.font.color.rgb = C_ACCENT

cover2 = doc.add_paragraph()
cover2.alignment = WD_ALIGN_PARAGRAPH.CENTER
r2 = cover2.add_run('Kommo CRM  ·  WhatsApp Business API  ·  Google Maps Leads  ·  Mercado Libre + IA')
r2.font.size  = Pt(12)
r2.font.color.rgb = C_GRAY

doc.add_paragraph()

# Info table on cover
tbl = doc.add_table(rows=5, cols=2)
tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl.style     = 'Table Grid'
labels = ['Cliente', 'Freelancer', 'Fecha', 'Versión', 'Estado']
values = [
    'Federico C. — SRL, Argentina',
    'Elliot',
    datetime.date.today().strftime('%d de %B de %Y'),
    'MVP v1.0',
    'Plan de Desarrollo Inicial — Entrega en 2 semanas',
]
for i, (lbl, val) in enumerate(zip(labels, values)):
    tbl.cell(i,0).text = lbl
    tbl.cell(i,1).text = val
    shade_cell(tbl.cell(i,0), '1A6B3E')
    for cell in tbl.row_cells(i):
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.size = Pt(10)
        if cell == tbl.cell(i,0):
            for para in cell.paragraphs:
                for run in para.runs:
                    run.bold = True
                    run.font.color.rgb = C_WHITE
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        cell.width = Inches(2.5)

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  1. RESUMEN EJECUTIVO
# ══════════════════════════════════════════════════════════════════════════════
heading('1. Resumen Ejecutivo', level=1)
body(
    'Este documento describe el plan de desarrollo del MVP para la automatización integral '
    'del negocio de Federico C. El proyecto se divide en cuatro módulos independientes que '
    'se comunican entre sí mediante webhooks y APIs REST. Cada módulo puede desplegarse, '
    'actualizarse y mantenerse de forma autónoma sin afectar al resto del sistema.',
    space_after=6
)
body(
    'Todos los componentes corren sobre un único VPS auto-gestionado, lo que elimina '
    'dependencias de plataformas SaaS externas, reduce el costo operativo mensual y '
    'otorga control total sobre los datos y los procesos. '
    'El tiempo total de entrega es de 2 semanas.',
    space_after=6
)

divider()

# ══════════════════════════════════════════════════════════════════════════════
#  2. MÓDULOS DEL PROYECTO
# ══════════════════════════════════════════════════════════════════════════════
heading('2. Módulos del Proyecto (MVP)', level=1)

modules = [
    ('Módulo 1', 'Kommo CRM — Automatización de Flujos', '1A6B3E'),
    ('Módulo 2', 'WhatsApp Business API Oficial (Meta)', '1A6B3E'),
    ('Módulo 3', 'Captación de Leads — Google Maps', '1A6B3E'),
    ('Módulo 4', 'Mercado Libre + Optimización con IA', '1A6B3E'),
]
for tag, title, color in modules:
    p = doc.add_paragraph()
    rb = p.add_run(f'  {tag}  ')
    rb.bold = True
    rb.font.size  = Pt(10)
    rb.font.color.rgb = C_WHITE
    # fake badge via shading trick not possible inline; just bold colored text
    rb.font.color.rgb = C_ACCENT
    rt = p.add_run(title)
    rt.bold = True
    rt.font.size = Pt(11)
    rt.font.color.rgb = C_DARK
    p.paragraph_format.space_after = Pt(2)

divider()

# ── MODULE 1 ──────────────────────────────────────────────────────────────────
heading('2.1  Módulo 1 — Kommo CRM', level=2)

heading('Situación actual', level=3, color=C_MID, space_before=6, space_after=3)
bullet('4 embudos activos con inbox acumulado sin leer.')
bullet('Leads entran por Google Ads y Mercado Libre vía WhatsApp.')
bullet('Sin diferenciación de origen ni flujo de calificación automático.')
bullet('No hay segmento de clientes recurrentes activo.')

heading('Qué se entrega en el MVP', level=3, color=C_MID, space_before=8, space_after=3)
bullet('Auditoría y limpieza de los 4 embudos existentes.', bold_prefix='Orden: ')
bullet('Creación de 3 segmentos de contacto distintos:', bold_prefix='Segmentación: ')
body('      A) Clientes que ya compraron  →  flujo de reactivación y promociones.', indent=1.2)
body('      B) Leads fríos de Google Maps  →  solo 1er contacto automático.', indent=1.2)
body('      C) Leads activos de Google Ads y ML  →  calificación + distribución.', indent=1.2)
bullet('Salesbot configurado para respuesta inmediata < 1 min.', bold_prefix='Salesbot: ')
bullet('Distribución automática al vendedor correcto según etapa del embudo.', bold_prefix='Routing: ')
bullet('Webhooks de Kommo conectados al módulo de WhatsApp y Google Maps.', bold_prefix='Webhooks: ')
bullet('Registro de origen de cada lead (Google Ads / ML) en campo personalizado.', bold_prefix='Tracking: ')

heading('Acceso requerido', level=3, color=C_MID, space_before=8, space_after=3)
bullet('Invitación como colaborador (rol integración — no consume licencia de usuario).')
bullet('URL de la cuenta Kommo + credenciales de API (OAuth2 token).')

divider()

# ── MODULE 2 ──────────────────────────────────────────────────────────────────
heading('2.2  Módulo 2 — WhatsApp Business API Oficial', level=2)

heading('Por qué API oficial y no soluciones no oficiales', level=3, color=C_MID, space_before=6, space_after=3)
body(
    'Las soluciones no oficiales (Evolution API, WPPConnect) son bloqueadas por Meta '
    'en semanas cuando se usan para mensajes masivos. Para una SRL registrada, la API '
    'oficial es el único camino sostenible a largo plazo.',
    space_after=4
)

heading('Qué se entrega en el MVP', level=3, color=C_MID, space_before=8, space_after=3)
bullet('Migración del número existente a Meta Business API — el número no cambia.', bold_prefix='Migración: ')
bullet('Configuración de plantillas de mensaje aprobadas por Meta (HSM).', bold_prefix='Templates: ')
bullet('Webhook de WhatsApp integrado con Kommo para registrar conversaciones.', bold_prefix='Integración: ')
bullet('Flujo automático: lead nuevo → mensaje de bienvenida → asignación a vendedor.', bold_prefix='Flujo: ')
bullet('Segmento de clientes anteriores: envío de promociones con 1 clic desde Kommo.', bold_prefix='Reactivación: ')

heading('Acceso requerido', level=3, color=C_MID, space_before=8, space_after=3)
bullet('Número de teléfono de WhatsApp a migrar.')
bullet('Nombre legal de la SRL + CUIT (para verificación de Meta Business Manager).')
bullet('Acceso al Facebook Business Manager asociado a la empresa.')

divider()

# ── MODULE 3 ──────────────────────────────────────────────────────────────────
heading('2.3  Módulo 3 — Captación de Leads (Google Maps)', level=2)

heading('Enfoque técnico y legal', level=3, color=C_MID, space_before=6, space_after=3)
body(
    'Se usa la Google Places API oficial (no scraping directo) para cumplir los términos '
    'de servicio de Google y la Ley 25.326 de protección de datos personales de Argentina. '
    'El costo por consulta es bajo y predecible. El primer contacto es automático (1 solo '
    'mensaje); el seguimiento es siempre manual.',
    space_after=4
)

heading('Qué se entrega en el MVP', level=3, color=C_MID, space_before=8, space_after=3)
bullet('Cliente Python de Google Places API con búsqueda por rubro + zona geográfica.', bold_prefix='Scraper: ')
bullet('Cola de procesamiento con deduplicación por teléfono y dirección.', bold_prefix='Cola: ')
bullet('Leads cualificados enviados automáticamente al pipeline de Kommo vía API.', bold_prefix='Pipeline: ')
bullet('1 solo mensaje de primer contacto por WhatsApp — nunca repetido al mismo número.', bold_prefix='Contacto: ')
bullet('Dashboard simple: leads captados / contactados / respondidos / convertidos.', bold_prefix='Métricas: ')

heading('Acceso requerido', level=3, color=C_MID, space_before=8, space_after=3)
bullet('Google Cloud API Key con Places API habilitado (costo ~USD 2–5 / 1.000 consultas).')
bullet('Definir rubros objetivo y zonas geográficas de búsqueda.')

divider()

# ── MODULE 4 ──────────────────────────────────────────────────────────────────
heading('2.4  Módulo 4 — Mercado Libre + Optimización IA', level=2)

heading('Contexto', level=3, color=C_MID, space_before=6, space_after=3)
body(
    'Federico tiene menos de 50 publicaciones activas y es MercadoLíder. Ese nivel '
    'requiere mantener métricas altas (reputación, velocidad de respuesta, calidad de '
    'publicación). La IA propone mejoras; el operador aprueba siempre antes de publicar '
    '— nada se aplica automáticamente sin revisión humana.',
    space_after=4
)

heading('Qué se entrega en el MVP', level=3, color=C_MID, space_before=8, space_after=3)
bullet('Integración con la API de ML para leer publicaciones existentes.', bold_prefix='Lectura: ')
bullet('Análisis automático: títulos débiles, descripciones genéricas, palabras clave faltantes.', bold_prefix='Análisis IA: ')
bullet('Claude API genera título + descripción optimizados para el buscador interno de ML.', bold_prefix='Generación: ')
bullet('Panel de revisión: publicación original vs. propuesta de IA lado a lado.', bold_prefix='Panel: ')
bullet('Aprobación con 1 clic → la mejora se aplica vía API de ML.', bold_prefix='Publicación: ')
bullet('Módulo documentado para que puedas subir publicaciones futuras sin depender de nadie.', bold_prefix='Autónomo: ')

heading('Acceso requerido', level=3, color=C_MID, space_before=8, space_after=3)
bullet('App registrada en Mercado Libre Developers con permisos: read + write listings.')
bullet('Access token OAuth2 de tu cuenta de vendedor.')

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  3. INFRAESTRUCTURA
# ══════════════════════════════════════════════════════════════════════════════
heading('3. Infraestructura del Servidor', level=1)

body(
    'Todo el sistema corre en un único VPS propio. Esto elimina costos recurrentes de '
    'plataformas SaaS, da control total sobre los datos y permite escalar componentes '
    'de forma independiente.',
    space_after=6
)

# Infrastructure table
infra_rows = [
    ('VPS / Sistema Operativo',  'Ubuntu 24 LTS', 'DigitalOcean, Contabo o Hetzner (opción más económica de calidad). Recomendación: Hetzner CX22 — ~EUR 4/mes, 2 vCPU, 4 GB RAM, suficiente para el MVP completo.'),
    ('Web Server',               'Nginx',         'Reverse proxy delante de todos los servicios. Sirve el frontend React en estático y redirige /api/* al backend FastAPI.'),
    ('Gestor de Procesos',       'Supervisor',    'Mantiene los servicios Python vivos. Reinicio automático ante caídas. Alternativa: PM2 si se agrega algún servicio Node.'),
    ('Backend',                  'FastAPI + Uvicorn', 'API REST para todos los módulos. Uvicorn como servidor ASGI de alto rendimiento. Endpoints para webhooks de Kommo, WhatsApp y ML.'),
    ('Frontend',                 'React → archivos estáticos', 'Panel de control compilado a HTML/CSS/JS estático. Nginx lo sirve directamente, sin Node en producción.'),
    ('Base de Datos Principal',  'PostgreSQL',    'Almacena leads, logs de mensajes, historial de publicaciones ML y colas de procesamiento. Auto-hospedado en el mismo VPS.'),
    ('Caché / Colas',            'Redis',         'Cola de tareas asíncronas (leads de Google Maps), caché de tokens OAuth2, deduplicación de contactos. Auto-hospedado.'),
    ('SSL / HTTPS',              'Certbot (Let\'s Encrypt)', 'Certificados gratuitos con renovación automática. HTTPS obligatorio para webhooks de Meta y Mercado Libre.'),
    ('Contenedores',             'Docker + Docker Compose', 'Cada módulo corre en su propio contenedor. Fácil de reiniciar, actualizar o reemplazar de forma independiente sin afectar al resto.'),
]

tbl2 = doc.add_table(rows=len(infra_rows)+1, cols=3)
tbl2.style = 'Table Grid'
tbl2.alignment = WD_TABLE_ALIGNMENT.CENTER

# Header row
headers = ['Componente', 'Tecnología', 'Descripción']
for j, h in enumerate(headers):
    cell = tbl2.cell(0, j)
    cell.text = h
    shade_cell(cell, '1A6B3E')
    for para in cell.paragraphs:
        for run in para.runs:
            run.bold = True
            run.font.size  = Pt(9.5)
            run.font.color.rgb = C_WHITE
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

# Data rows
for i, (comp, tech, desc) in enumerate(infra_rows, start=1):
    row = tbl2.row_cells(i)
    row[0].text = comp
    row[1].text = tech
    row[2].text = desc
    if i % 2 == 0:
        shade_cell(row[0], 'EAF4EE')
        shade_cell(row[1], 'EAF4EE')
        shade_cell(row[2], 'EAF4EE')
    for cell in row:
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.size = Pt(9.5)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

# Column widths
tbl2.columns[0].width = Inches(1.8)
tbl2.columns[1].width = Inches(1.6)
tbl2.columns[2].width = Inches(3.4)

divider()

heading('Arquitectura de Contenedores Docker', level=2)
body('docker-compose.yml define los siguientes servicios independientes:', space_after=4)

services = [
    ('kommo-service',   'Python / FastAPI', 'Webhooks entrantes de Kommo + lógica de Salesbot'),
    ('whatsapp-service','Python / FastAPI', 'Webhook Meta + envío de mensajes + templates'),
    ('leads-service',   'Python',           'Scraper Google Places API + cola Redis + push a Kommo'),
    ('ml-service',      'Python / FastAPI', 'API ML + Claude API para optimización de publicaciones'),
    ('frontend',        'Nginx + React',    'Panel de control estático, sirve la UI del operador'),
    ('postgres',        'PostgreSQL 16',    'Base de datos compartida (volumen persistente)'),
    ('redis',           'Redis 7',          'Caché y colas (volumen persistente)'),
    ('nginx-proxy',     'Nginx',            'Reverse proxy principal + SSL Certbot'),
]

tbl3 = doc.add_table(rows=len(services)+1, cols=3)
tbl3.style = 'Table Grid'
tbl3.alignment = WD_TABLE_ALIGNMENT.CENTER

hdrs3 = ['Contenedor', 'Stack', 'Responsabilidad']
for j, h in enumerate(hdrs3):
    cell = tbl3.cell(0, j)
    cell.text = h
    shade_cell(cell, '2D6A4F')
    for para in cell.paragraphs:
        for run in para.runs:
            run.bold = True
            run.font.size  = Pt(9.5)
            run.font.color.rgb = C_WHITE

for i, (svc, stack, resp) in enumerate(services, start=1):
    row = tbl3.row_cells(i)
    row[0].text = svc
    row[1].text = stack
    row[2].text = resp
    if i % 2 == 0:
        for c in row:
            shade_cell(c, 'F2F8F4')
    for cell in row:
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.size = Pt(9.5)

tbl3.columns[0].width = Inches(1.7)
tbl3.columns[1].width = Inches(1.5)
tbl3.columns[2].width = Inches(3.6)

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  4. PLAN DE DESARROLLO PASO A PASO
# ══════════════════════════════════════════════════════════════════════════════
heading('4. Plan de Desarrollo — Paso a Paso', level=1)

steps = [
    ('Paso 1', 'Semana 1 — Días 1 a 3', 'Setup de infraestructura y Kommo CRM', [
        'Contratar VPS (Hetzner CX22 recomendado) — Ubuntu 24 LTS.',
        'Instalar Docker, Docker Compose, Nginx, Certbot.',
        'Configurar dominio + certificado SSL (HTTPS obligatorio para webhooks).',
        'Crear repositorio privado Git con estructura de módulos.',
        'Auditar los 4 embudos en Kommo: renombrar etapas, archivar contactos muertos.',
        'Crear los 3 segmentos: clientes anteriores, leads fríos, leads activos.',
        'Configurar campos personalizados en Kommo: "Origen" (Google Ads / ML / Maps).',
        'Instalar kommo-service (FastAPI) y conectar webhooks de Kommo al VPS.',
        'Primera prueba end-to-end: lead entra → Kommo lo registra con origen correcto.',
    ]),
    ('Paso 2', 'Semana 1 — Días 4 a 7', 'WhatsApp Business API — Migración y flujos', [
        'Registrar número existente en Meta Business Manager (verificación de SRL).',
        'Configurar número en Meta WhatsApp Business API.',
        'Crear y aprobar plantillas HSM: bienvenida, seguimiento, promoción.',
        'Instalar whatsapp-service y conectar webhook de Meta al VPS.',
        'Integrar whatsapp-service con Kommo: conversación visible en el CRM.',
        'Probar flujo completo: lead entra → Kommo → WhatsApp → respuesta registrada.',
        'Configurar Salesbot en Kommo para disparar mensajes según etapa del embudo.',
    ]),
    ('Paso 3', 'Semana 2 — Días 1 a 4', 'Captación de Leads — Google Maps API', [
        'Crear proyecto en Google Cloud + habilitar Places API + generar API Key.',
        'Desarrollar leads-service: búsqueda por rubro y zona, parseo de resultados.',
        'Implementar cola Redis: deduplicación por teléfono y dirección.',
        'Mapear cada lead captado al pipeline de Kommo (segmento "Leads Fríos").',
        'Trigger automático: nuevo lead en Kommo → WhatsApp envía 1er contacto.',
        'Activar flag anti-duplicado: si el número ya existe en Kommo, no contactar.',
        'Dashboard básico: leads captados / contactados / respondidos.',
    ]),
    ('Paso 4', 'Semana 2 — Días 5 a 7', 'Mercado Libre + Optimización con IA (Claude)', [
        'Registrar app en Mercado Libre Developers con permisos read + write.',
        'Instalar ml-service: leer las ~50 publicaciones activas vía API ML.',
        'Implementar análisis de calidad: título < 60 chars, descripción < 200 chars, palabras clave.',
        'Conectar Claude API: generar título y descripción optimizados por publicación.',
        'Construir panel de revisión React: original vs. propuesta IA, botón Aprobar.',
        'Al aprobar: ml-service aplica el cambio vía API de ML automáticamente.',
        'Documentar el módulo: guía para subir publicaciones nuevas sin depender del freelancer.',
        'QA final: probar los 4 módulos integrados, corregir bugs, entregar.',
    ]),
]

for step_tag, week, title, tasks in steps:
    p = doc.add_paragraph()
    rb = p.add_run(f'{step_tag}  ·  {week}  — ')
    rb.bold = True
    rb.font.size  = Pt(12)
    rb.font.color.rgb = C_ACCENT
    rt = p.add_run(title)
    rt.bold = True
    rt.font.size  = Pt(12)
    rt.font.color.rgb = C_DARK
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after  = Pt(4)
    for task in tasks:
        bullet(task)
    divider()

# ══════════════════════════════════════════════════════════════════════════════
#  5. TECH STACK COMPLETO
# ══════════════════════════════════════════════════════════════════════════════
heading('5. Stack Tecnológico Completo', level=1)

stack_sections = [
    ('Infraestructura', [
        ('VPS', 'Ubuntu 24 LTS — DigitalOcean, Contabo o Hetzner'),
        ('Contenedores', 'Docker + Docker Compose'),
        ('Web server', 'Nginx (reverse proxy + servidor estático)'),
        ('Proceso manager', 'Supervisor (Python) / PM2 (Node si se necesita)'),
        ('SSL', 'Certbot — Let\'s Encrypt (renovación automática, gratuito)'),
    ]),
    ('Backend', [
        ('Framework', 'FastAPI con Uvicorn (Python 3.11+)'),
        ('Tareas asíncronas', 'Celery + Redis como broker'),
        ('ORM', 'SQLAlchemy + Alembic para migraciones'),
        ('Validación', 'Pydantic v2'),
        ('HTTP client', 'httpx (async)'),
    ]),
    ('Frontend', [
        ('Framework', 'React 18 + TypeScript'),
        ('UI', 'Tailwind CSS'),
        ('Estado', 'Zustand'),
        ('HTTP', 'Axios'),
        ('Build', 'Vite → archivos estáticos servidos por Nginx'),
    ]),
    ('Bases de Datos', [
        ('Principal', 'PostgreSQL 16 (auto-hospedado)'),
        ('Caché / Colas', 'Redis 7 (auto-hospedado)'),
    ]),
    ('APIs Externas', [
        ('CRM', 'Kommo API v4 (OAuth2)'),
        ('Mensajería', 'Meta WhatsApp Business API (Graph API v19)'),
        ('Leads', 'Google Places API (New)'),
        ('Marketplace', 'Mercado Libre API v3 (OAuth2)'),
        ('IA', 'Anthropic Claude API (claude-sonnet-4-6)'),
    ]),
]

for section_title, items in stack_sections:
    heading(section_title, level=2, space_before=10, space_after=4)
    t = doc.add_table(rows=len(items), cols=2)
    t.style = 'Table Grid'
    for i, (key, val) in enumerate(items):
        t.cell(i,0).text = key
        t.cell(i,1).text = val
        if i % 2 == 0:
            shade_cell(t.cell(i,0), 'EAF4EE')
            shade_cell(t.cell(i,1), 'EAF4EE')
        for col in [0,1]:
            for para in t.cell(i,col).paragraphs:
                for run in para.runs:
                    run.font.size = Pt(9.5)
                    if col == 0:
                        run.bold = True
    t.columns[0].width = Inches(2.0)
    t.columns[1].width = Inches(4.7)

doc.add_page_break()

# ══════════════════════════════════════════════════════════════════════════════
#  6. HITOS Y PAGOS
# ══════════════════════════════════════════════════════════════════════════════
heading('6. Hitos y Pagos (Workana Escrow)', level=1)

milestone_rows = [
    ('Hito 1', 'Sem 1 · Día 3', 'Kommo limpio + Salesbot + webhooks funcionando',        '25 %'),
    ('Hito 2', 'Sem 1 · Día 7', 'WhatsApp API oficial integrado con Kommo',              '25 %'),
    ('Hito 3', 'Sem 2 · Día 4', 'Módulo Google Maps captando y enviando leads a Kommo',  '25 %'),
    ('Hito 4', 'Sem 2 · Día 7', 'ML + IA operativo + documentación + QA final',          '25 %'),
]

tbl4 = doc.add_table(rows=len(milestone_rows)+1, cols=4)
tbl4.style = 'Table Grid'
tbl4.alignment = WD_TABLE_ALIGNMENT.CENTER

for j, h in enumerate(['Hito', 'Semana', 'Entregable', 'Pago']):
    cell = tbl4.cell(0, j)
    cell.text = h
    shade_cell(cell, '1A6B3E')
    for para in cell.paragraphs:
        for run in para.runs:
            run.bold = True
            run.font.size  = Pt(10)
            run.font.color.rgb = C_WHITE

for i, (hito, semana, entregable, pago) in enumerate(milestone_rows, start=1):
    row = tbl4.row_cells(i)
    row[0].text = hito
    row[1].text = semana
    row[2].text = entregable
    row[3].text = pago
    if i % 2 == 0:
        for c in row: shade_cell(c, 'EAF4EE')
    for cell in row:
        for para in cell.paragraphs:
            for run in para.runs:
                run.font.size = Pt(10)

tbl4.columns[0].width = Inches(0.7)
tbl4.columns[1].width = Inches(0.8)
tbl4.columns[2].width = Inches(4.0)
tbl4.columns[3].width = Inches(0.8)

divider()

# ══════════════════════════════════════════════════════════════════════════════
#  7. ACCESOS NECESARIOS
# ══════════════════════════════════════════════════════════════════════════════
heading('7. Accesos Necesarios para Arrancar', level=1)

access_items = [
    ('SEMANA 1 — Días 1 a 3 (Módulo 1 · Kommo)', [
        'Kommo: invitación como colaborador (rol integración, sin costo de licencia).',
        'URL de la cuenta Kommo + Client ID + Client Secret de la app API.',
    ]),
    ('SEMANA 1 — Días 4 a 7 (Módulo 2 · WhatsApp)', [
        'Número de WhatsApp a migrar a la API oficial.',
        'Nombre legal de la SRL + CUIT.',
        'Acceso al Facebook Business Manager (administrador o invitación).',
    ]),
    ('SEMANA 2 — Días 1 a 4 (Módulo 3 · Google Maps)', [
        'Google Cloud: crear proyecto → habilitar Places API → compartir API Key.',
        'Rubros y zonas geográficas objetivo para la búsqueda de leads.',
    ]),
    ('SEMANA 2 — Días 5 a 7 (Módulo 4 · Mercado Libre)', [
        'Mercado Libre Developers: crear app → compartir App ID + Secret + Access Token.',
        'Confirmar las ~50 publicaciones activas que se van a optimizar.',
    ]),
]

for week_label, items in access_items:
    heading(week_label, level=3, color=C_ACCENT, space_before=10, space_after=3)
    for item in items:
        bullet(item)

divider()

# ══════════════════════════════════════════════════════════════════════════════
#  8. PREGUNTAS FRECUENTES
# ══════════════════════════════════════════════════════════════════════════════
heading('8. Preguntas Frecuentes', level=1)

faqs = [
    ('¿El número de WhatsApp va a cambiar?',
     'No. El número sigue siendo el mismo para tus clientes. Solo cambia la forma en que '
     'se conecta al sistema — de la app manual a la API oficial de Meta.'),
    ('¿Se pueden mandar mensajes masivos a todos los contactos?',
     'A clientes que ya tuvieron interacción, sí (dentro de las ventanas de 24 h de Meta). '
     'A leads completamente fríos, se puede enviar plantillas HSM aprobadas. El módulo '
     'Google Maps envía solo 1 mensaje por contacto y nunca repite.'),
    ('¿Qué pasa si Meta rechaza una plantilla?',
     'Se redacta nuevamente siguiendo las guías de Meta y se vuelve a someter. El proceso '
     'de aprobación tarda 24–48 h. Esto está contemplado en la primera semana, días 4 a 7.'),
    ('¿La IA publica automáticamente en Mercado Libre?',
     'No. La IA propone el título y la descripción mejorados. Vos los revisás en el panel '
     'y aprobás con un clic. Solo entonces se aplica el cambio. Nada se publica sin tu OK.'),
    ('¿Cuánto cuesta el VPS por mes?',
     'Hetzner CX22: ~EUR 4/mes (≈ USD 4.30). Suficiente para el MVP. Si el volumen crece '
     'se puede escalar verticalmente (más RAM/CPU) sin cambiar nada de la arquitectura.'),
    ('¿Puedo seguir usando Kommo normalmente mientras se configura?',
     'Sí. Los cambios en Kommo se hacen de forma incremental y sin interrumpir el uso '
     'diario. Los embudos viejos se archivan, no se borran.'),
]

for q, a in faqs:
    body(f'Q: {q}', bold=True, space_after=2)
    body(f'A: {a}', indent=0.3, color=C_GRAY, space_after=8)

divider()

# ══════════════════════════════════════════════════════════════════════════════
#  9. CONTACTO
# ══════════════════════════════════════════════════════════════════════════════
heading('9. Contacto y Comunicación', level=1)
body('Comunicación principal: Workana (mensajes del proyecto).', space_after=4)
body('Una vez confirmado el primer hito: WhatsApp para coordinación rápida.', space_after=4)
body('Reporte semanal de avance incluido en cada entrega de hito.', space_after=4)
body('Tiempo de respuesta: < 4 horas en horario laboral (GMT-3, Argentina).', space_after=4)

doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('Documento preparado por Elliot  ·  ' + datetime.date.today().strftime('%d/%m/%Y'))
r.font.size  = Pt(9)
r.font.color.rgb = C_GRAY
r.italic = True

# ── Save ──────────────────────────────────────────────────────────────────────
output_path = r'f:\workana_work1\Federico C\Plan_Desarrollo_MVP_Federico.docx'
doc.save(output_path)
print(f'Document saved: {output_path}')
