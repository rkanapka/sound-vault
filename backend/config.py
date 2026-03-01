from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    slskd_url: str = "http://slskd:5030"
    navidrome_url: str = "http://navidrome:4533"
    navidrome_user: str
    navidrome_pass: str


settings = Settings()
