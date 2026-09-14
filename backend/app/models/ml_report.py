from datetime import datetime
from sqlalchemy import String, DateTime, Float, Integer, Text, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class MLReport(Base):
    """One run of the Mercado Libre report (scheduled Monday/Thursday or run by hand)."""
    __tablename__ = "ml_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    run_date: Mapped[str] = mapped_column(String(10), index=True)          # AR date, YYYY-MM-DD
    trigger: Mapped[str] = mapped_column(String(16), default="programado")  # programado | manual
    status: Mapped[str] = mapped_column(String(16), default="running")      # running | ok | parcial | error
    summary: Mapped[dict] = mapped_column(JSON, default=dict)               # metrics, highlights, actions, errors
    file_name: Mapped[str] = mapped_column(String(80), default="")


class MLAdSnapshot(Base):
    """One advertised listing on one report date — the old 'Historico ML - acumulado' CSV row."""
    __tablename__ = "ml_ad_snapshots"
    __table_args__ = (Index("ix_ml_ad_snapshots_fecha_mla", "fecha", "mla"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[str] = mapped_column(String(10), index=True)
    mla: Mapped[str] = mapped_column(String(20))
    titulo: Mapped[str] = mapped_column(Text, default="")
    campana: Mapped[str] = mapped_column(String(120), default="")
    estado: Mapped[str] = mapped_column(String(30), default="")
    impresiones: Mapped[float | None] = mapped_column(Float, nullable=True)
    clics: Mapped[float | None] = mapped_column(Float, nullable=True)
    cpc: Mapped[float | None] = mapped_column(Float, nullable=True)
    ventas_atrib: Mapped[float | None] = mapped_column(Float, nullable=True)
    ingresos: Mapped[float | None] = mapped_column(Float, nullable=True)
    inversion: Mapped[float | None] = mapped_column(Float, nullable=True)
    acos: Mapped[float | None] = mapped_column(Float, nullable=True)
    tacos: Mapped[float | None] = mapped_column(Float, nullable=True)
    roas: Mapped[float | None] = mapped_column(Float, nullable=True)
    visitas_7d: Mapped[float | None] = mapped_column(Float, nullable=True)
    ventas_7d: Mapped[float | None] = mapped_column(Float, nullable=True)
    conversion_7d: Mapped[float | None] = mapped_column(Float, nullable=True)
    precio_lista: Mapped[float | None] = mapped_column(Float, nullable=True)
    precio_final: Mapped[float | None] = mapped_column(Float, nullable=True)
    stock: Mapped[float | None] = mapped_column(Float, nullable=True)
    calidad: Mapped[float | None] = mapped_column(Float, nullable=True)


class MLPositionSnapshot(Base):
    """Where a listing ranked for a search term on one report date — the old 'Posiciones ML' CSV row."""
    __tablename__ = "ml_position_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[str] = mapped_column(String(10), index=True)
    termino: Mapped[str] = mapped_column(String(120))
    total_resultados: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mla: Mapped[str] = mapped_column(String(20))
    titulo: Mapped[str] = mapped_column(Text, default="")
    posicion: Mapped[str] = mapped_column(String(20), default="")  # number, "no aparece" or "no medido"
