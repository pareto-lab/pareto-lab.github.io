from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import (
    BaseSettings,
    JsonConfigSettingsSource,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config.json"


class DatabaseConfig(BaseModel):
    host: str = "localhost"
    port: int = 8432
    user: str = "dev"
    password: str = "devpassword"
    name: str = "houseinusdev"
    echo: bool = False

    @property
    def async_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.name}"
        )

    @property
    def sync_url(self) -> str:
        # psycopg3 supports both sync and async from the same driver string.
        return (
            f"postgresql+psycopg://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.name}"
        )


class RedisConfig(BaseModel):
    host: str = "localhost"
    port: int = 8379
    db: int = 0
    password: str | None = None
    # 같은 Redis 인스턴스를 여러 환경(dev/prod)이 공유할 때 키 충돌 방지용.
    # 모든 키 앞에 자동으로 붙는다. 빈 문자열이면 prefix 없음.
    prefix: str = "houseinus:"

    @property
    def url(self) -> str:
        auth = f":{self.password}@" if self.password else ""
        return f"redis://{auth}{self.host}:{self.port}/{self.db}"


class OAuthProviderConfig(BaseModel):
    enabled: bool = False
    client_id: str = ""
    client_secret: str = ""
    redirect_uri: str = ""


class OAuthConfig(BaseModel):
    google: OAuthProviderConfig = Field(default_factory=OAuthProviderConfig)
    naver: OAuthProviderConfig = Field(default_factory=OAuthProviderConfig)
    kakao: OAuthProviderConfig = Field(default_factory=OAuthProviderConfig)


class StorageConfig(BaseModel):
    """Local filesystem storage for uploaded images/files. Switching to S3
    later only requires changing storage_service implementation."""

    # Default: <houseinus-api>/uploads.  Absolute path also supported.
    base_path: str = "uploads"
    # URL prefix exposed to the frontend. Backend serves these via
    # FastAPI StaticFiles, nginx/vite then proxy.
    public_url_prefix: str = "/uploads"
    # Max single-upload size in bytes (30 MB default).
    max_upload_bytes: int = 30 * 1024 * 1024
    # Allowed image mimetypes for property uploads.
    allowed_image_types: list[str] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "image/webp"]
    )
    allowed_file_types: list[str] = Field(
        default_factory=lambda: ["application/pdf"]
    )

    def resolve_base_path(self, project_root: Path) -> Path:
        p = Path(self.base_path)
        return p if p.is_absolute() else (project_root / p)


class HarnessConfig(BaseModel):
    """Local state used by the admin agent harness.

    Specific bridge implementations may keep per-user CLI home directories and
    generated config under this base path. Keep it out of git.
    """

    base_path: str = "harness"
    provider: str = "codex"
    # Leave empty/null to let the installed Codex CLI choose its current default.
    default_model: str | None = None
    codex_command: str = "codex"
    api_base_url: str = "http://127.0.0.1:8098/api/v1"
    mcp_http_timeout_seconds: float = 15.0
    mcp_tool_timeout_seconds: int = 25
    mcp_disable_status_changes: bool = False
    mcp_disable_high_risk: bool = True
    seed_codex_home: str | None = None

    # codex_socket_bridge가 잡을 TCP 포트 범위 (loopback only).
    # 동일 호스트에서 다른 사용자/서비스가 점유한 대역을 피하려고 따로 노출함.
    bridge_port_min: int = 50000
    bridge_port_max: int = 59999
    # 브릿지가 TCP client 0인 상태로 이 시간만큼 지나면 자기 codex 자식까지
    # SIGTERM 하고 종료. 좀비 codex 방지용. 0 또는 음수면 자기 종료 비활성화.
    bridge_idle_shutdown_seconds: int = 60
    # 브릿지 첫 기동 후 이 시간 안에 단 한 번도 클라이언트 연결이 없으면 종료.
    bridge_startup_grace_seconds: int = 30
    # Redis에 등록되는 브릿지 엔트리 TTL. heartbeat 주기는 그 절반 미만으로 박는다.
    bridge_redis_ttl_seconds: int = 30

    def resolve_base_path(self, project_root: Path) -> Path:
        p = Path(self.base_path)
        return p if p.is_absolute() else (project_root / p)


class EmailConfig(BaseModel):
    # SMTP server settings. Gmail example:
    #   smtp_host="smtp.gmail.com", smtp_port=587, smtp_use_starttls=True,
    #   smtp_username="<gmail address>", smtp_password="<app password>".
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_starttls: bool = True
    smtp_use_ssl: bool = False  # set True for implicit-TLS port 465

    from_email: str = "no-reply@paretolab.kr"
    from_name: str = "House in Us"

    # 6-digit verification code used by the user-facing email signup + reset
    # flow. Codes live in Redis with this TTL; verification tokens issued
    # after a successful confirm live the same length.
    verification_code_lifetime_seconds: int = 10 * 60  # 10 minutes
    verification_token_lifetime_seconds: int = 30 * 60  # 30 minutes

    @property
    def enabled(self) -> bool:
        return bool(self.smtp_host) and bool(self.smtp_username) and bool(self.smtp_password)


class TelegramConfig(BaseModel):
    """Bot used to push notifications to admins (inquiries, MBTI etc.)."""

    bot_token: str = ""

    @property
    def enabled(self) -> bool:
        return bool(self.bot_token)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        json_file=str(CONFIG_PATH),
        json_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "houseinus-api"
    debug: bool = False
    timezone: str = "Asia/Seoul"

    host: str = "127.0.0.1"
    port: int = 8098

    frontend_url: str = "http://localhost:8080"

    session_secret: str = "dev-only-change-me"
    session_lifetime_seconds: int = 60 * 60 * 24 * 14  # 14 days

    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8080", "http://127.0.0.1:8080"]
    )

    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    redis: RedisConfig = Field(default_factory=RedisConfig)
    oauth: OAuthConfig = Field(default_factory=OAuthConfig)
    email: EmailConfig = Field(default_factory=EmailConfig)
    storage: StorageConfig = Field(default_factory=StorageConfig)
    harness: HarnessConfig = Field(default_factory=HarnessConfig)
    telegram: TelegramConfig = Field(default_factory=TelegramConfig)

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Priority: explicit init > config.json > env > secrets.
        return (
            init_settings,
            JsonConfigSettingsSource(settings_cls),
            env_settings,
            file_secret_settings,
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
