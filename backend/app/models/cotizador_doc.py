from datetime import datetime
from sqlalchemy import String, DateTime, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class CotizadorDoc(Base):
    """One JSON document of the quoting tool (settings, a price list chunk, a saved quote…).

    The tool keeps its state as small documents addressed by (collection, doc_id),
    so the page can load everything in one request and save each piece on its own.
    """
    __tablename__ = "cotizador_docs"
    __table_args__ = (UniqueConstraint("collection", "doc_id", name="uq_cotizador_docs_collection_doc"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    collection: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    doc_id: Mapped[str] = mapped_column(String(120), nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
