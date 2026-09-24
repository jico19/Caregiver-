from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "Caregiver Platform API"
    DEBUG: bool = False

    SUPABASE_URL: str = "https://placeholder.supabase.co"
    SUPABASE_ANON_KEY: str = "placeholder"
    SUPABASE_SERVICE_ROLE_KEY: str = "placeholder"

    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    VALID_STATES: List[str] = ["florida", "indiana", "georgia"]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
