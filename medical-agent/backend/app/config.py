from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PORTAL_URL: str = "https://miportal.alexanderfleming.org"
    PORTAL_PATIENT_ID: str = "IAF6612"
    PORTAL_DNI: str = "23477001"
    CLAUDE_API_KEY: str = ""
    APP_PASSWORD: str = "medagent2024"
    JWT_SECRET: str = "medical_jwt_secret_change_in_production"
    JWT_EXPIRE_HOURS: int = 72
    STUDIES_DIR: str = "/data/studies"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
