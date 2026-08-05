from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AutoCRM Backend"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://autocrm:autocrm@postgres:5432/autocrm"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Kommo CRM
    KOMMO_CLIENT_ID: str = ""
    KOMMO_CLIENT_SECRET: str = ""
    KOMMO_BASE_URL: str = ""          # e.g. https://youraccount.kommo.com
    KOMMO_ACCESS_TOKEN: str = ""
    KOMMO_REFRESH_TOKEN: str = ""

    # WhatsApp (Meta Business API)
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""
    WHATSAPP_VERIFY_TOKEN: str = "autocrm_verify_2024"
    WHATSAPP_BUSINESS_ID: str = ""

    # Google Places API
    GOOGLE_PLACES_API_KEY: str = ""

    # Mercado Libre
    ML_APP_ID: str = ""
    ML_APP_SECRET: str = ""
    ML_ACCESS_TOKEN: str = ""
    ML_REFRESH_TOKEN: str = ""
    ML_USER_ID: str = ""

    # Meta Graph API (Instagram + Facebook publishing)
    META_ACCESS_TOKEN: str = ""
    META_PAGE_ID: str = ""
    META_IG_ACCOUNT_ID: str = ""

    # WhatsApp Business phone number (digits only, e.g. 5491155554444)
    WA_BUSINESS_PHONE: str = ""

    # Claude AI
    ANTHROPIC_API_KEY: str = ""

    # Admin auth
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "autocrm2024"
    JWT_SECRET: str = "autocrm_jwt_secret_change_in_production"
    JWT_EXPIRE_HOURS: int = 72

    # Web Push (VAPID)
    VAPID_PUBLIC_KEY: str = "BO70W1l6Me_DyBEpdInbJFOO_SuBxHymQre_9g6hLY6xaRSJ5M3fUFYmQdWPWdoDUv9amlo5tIcU5np39wowu6Y"
    VAPID_PRIVATE_KEY: str = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgyV6mp3_YutvH08LFRhkHPqF9nvy8uR6XUHsWMUe5AB-hRANCAATu9FtZejHvw8gRKXSJ2yRTjv0rgcR8pkK3v_YOoS2OsWkUieTN31BWJkHVj1naA1L_WppaObSHFOZ6d_cKMLum"
    VAPID_EMAIL: str = "mailto:info@indumentariasegura.com.ar"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
