from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    slskd_url: str = "http://slskd:5030"
    slskd_api_key: str | None = None
    navidrome_url: str = "http://navidrome:4533"
    navidrome_user: str
    navidrome_pass: str
    music_dir: str = "/music"
    lastfm_api_key: str | None = None


settings = Settings()
