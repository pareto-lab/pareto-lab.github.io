# houseinus-api

House in Us 백엔드 API. FastAPI + PostgreSQL + Redis + SQLAlchemy + Alembic.

## 요구사항

- Python 3.11+ (개발 기준 3.12)
- PostgreSQL 14+
- Redis 6+
- [uv](https://docs.astral.sh/uv/) (패키지 매니저)
- Playwright Chromium (PDF 생성용 — 아래 초기 세팅 참고)

## 초기 세팅

```sh
# 1. 의존성 설치 (가상환경은 uv가 자동 생성)
uv sync

# 2. 로컬 DB/Redis 실행 (Postgres: 8432, Redis: 8379)
docker compose up -d

# 3. 설정 파일 복사 (gitignore 됨)
cp config.example.json config.json
# config.example.json 기본값이 docker-compose와 맞춰져 있음.
# OAuth 키만 필요한 것들 채워넣으면 됨.

# 4. DB 마이그레이션
uv run alembic upgrade head

# 5. Playwright Chromium 설치 (PDF 생성 기능에 필요)
uv run playwright install --with-deps chromium
```

`docker compose down`으로 중지, `docker compose down -v`로 볼륨까지 초기화.

OAuth 연동 키 발급/등록은 [OAUTH_README.md](OAUTH_README.md) 참고.

## 개발 서버 실행

```sh
# 기본 포트 8098 (config.json의 host/port 사용, --reload 켜짐)
uv run python run_dev.py

# 또는 직접
uv run uvicorn app.main:app --host 127.0.0.1 --port 8098 --reload
```

- API 문서: http://127.0.0.1:8098/api/v1/docs
- OpenAPI JSON: http://127.0.0.1:8098/api/v1/openapi.json
- 헬스체크: http://127.0.0.1:8098/api/v1/health

`houseinus-web`에서 `npm run dev`로 개발 서버를 띄우면 `/api/*` 요청이 이 서버(`127.0.0.1:8098`)로 자동 reverse proxy 됩니다 (vite.config.ts 설정).

## 관리자 Agent Harness

관리자 Web UI에서 agent CLI를 조작하기 위한 로컬 harness입니다. 공통 작업 디렉터리와
per-user agent home은 `config.json`의 `harness.base_path` 아래에 만들어지며, 기본값은
`<houseinus-api>/harness`입니다. 이 디렉터리는 gitignore 됩니다.

현재 provider는 Codex입니다. Codex-specific 구현체는 `codex_bridge_service.py`에 두고,
Web/API 표면은 `/api/v1/admin/agent/*`, `AgentSidePanel`처럼 중립 이름을 씁니다.
나중에 Claude Code CLI로 갈아타면 bridge 구현체만 추가하고 같은 side panel을 재사용하는
방향입니다.

Codex 실행 시:

- cwd: `<harness.base_path>/cwd`
- per-user CODEX_HOME/KORI_HOME: `<harness.base_path>/agent_homes/codex/{user_id}`
- 실행 직전 `agent/AGENTS.md`를 cwd의 `AGENTS.md`로 복사
- 현재 관리자 세션 token을 `houseinus-admin` MCP 서버의 `HOUSEINUS_ADMIN_TOKEN`으로 주입

## 관리자 MCP 서버

Codex CLI 같은 MCP 클라이언트에서 관리자 기능을 쓰기 위한 stdio MCP 서버입니다.
새 권한 모델을 만들지 않고 기존 `/api/v1/admin/*` API를 감싸며, `HOUSEINUS_ADMIN_TOKEN`에
들어 있는 기존 admin/owner Bearer 토큰으로 인증합니다.

```sh
HOUSEINUS_API_BASE_URL=http://127.0.0.1:8098/api/v1 \
HOUSEINUS_ADMIN_TOKEN=<admin-or-owner-token> \
uv run python -m app.mcp.server
```

Codex CLI 설정 예시:

```json
{
  "mcpServers": {
    "houseinus-admin": {
      "command": "uv",
      "args": ["run", "python", "-m", "app.mcp.server"],
      "cwd": "/Users/jeongmin/Workspace/houseinus/houseinus-api",
      "env": {
        "HOUSEINUS_API_BASE_URL": "http://127.0.0.1:8098/api/v1",
        "HOUSEINUS_ADMIN_TOKEN": "<admin-or-owner-token>"
      }
    }
  }
}
```

상태 변경과 고위험 작업은 서버 실행 시 완전히 비활성화할 수 있습니다.

```sh
# 게시/미게시, 복원, 예약 상태 변경, 메뉴 순서 변경 차단
uv run python -m app.mcp.server --disable-status-changes

# 아카이브/삭제, 사용자 ban/unban/role 변경 차단
uv run python -m app.mcp.server --disable-high-risk
```

같은 설정을 환경변수로도 줄 수 있습니다.

```sh
HOUSEINUS_MCP_DISABLE_STATUS_CHANGES=1
HOUSEINUS_MCP_DISABLE_HIGH_RISK=1
```

삭제/아카이브/권한 변경/게시 상태 변경 도구는 모두 `confirm: true`와 비어 있지 않은
`reason`을 요구합니다. `reason`은 API 요청의 `X-Houseinus-MCP-Reason` 헤더에도 실립니다.
파일 업로드 도구는 아직 제공하지 않습니다.

## 프로덕션 서버 실행

```sh
# 기본: 0.0.0.0:38080, workers=4, proxy_headers=ON
uv run python run_prod.py

# 포트/워커 수 변경
uv run python run_prod.py --port 12345 --workers 8
```

실서버에서는 nginx(리버스 프록시) 뒤에 두고, **user systemd 서비스**로 관리합니다.

### systemd user 서비스로 등록

루트 권한 없이 (단, 최초 1회 linger만 root 필요):

```sh
# (최초 1회만) 부팅 시 자동 기동되도록 linger 활성화
sudo loginctl enable-linger $USER

# prod 설치 (서비스명: houseinus-api)
python3 install_service.py

# dev 설치 (서비스명: houseinus-api-dev, 다른 디렉터리에서)
python3 install_service.py --dev

# 기동
systemctl --user start houseinus-api
systemctl --user status houseinus-api
journalctl --user -u houseinus-api -f
```

서비스 유닛 템플릿은 [houseinus-api.service](houseinus-api.service). `{houseinus-api-root}` placeholder만 있고 `install_service.py`가 실제 경로로 치환해서 `~/.config/systemd/user/<name>.service`에 설치합니다.

## PDF 생성 (Playwright)

`/properties/{id}/print-pdf` 엔드포인트는 Playwright Chromium으로 print 페이지를 렌더링해서 PDF를 만든다.

### Chromium 바이너리

```sh
# 초기 설치 및 업데이트 후
uv run playwright install --with-deps chromium
```

`--with-deps`는 Chromium이 필요로 하는 시스템 패키지(libglib, libnss 등)를 함께 설치한다. CI/CD에서 `uv sync` 후 이 명령도 실행해야 한다.

### 한국어 폰트 (서버)

Playwright 헤드리스 Chromium은 시스템 폰트를 사용한다. 서버에 한국어 폰트가 없으면 PDF에서 글자가 깨진다.

```sh
# Ubuntu / Debian
sudo apt-get install -y fonts-noto-cjk fonts-noto-cjk-extra
fc-cache -fv
```

로컬 맥 개발 환경은 시스템에 한국어 폰트가 이미 있으므로 별도 설치 불필요.

### Ghostscript (PDF 압축)

Playwright가 생성한 PDF는 고해상도 이미지를 포함해 파일 크기가 수십 MB에 달할 수 있습니다. Ghostscript를 설치하면 PDF 저장 전 `/printer` 품질(~300 dpi)로 재압축합니다.

```sh
# Ubuntu / Debian
sudo apt install ghostscript
gs --version   # 설치 확인
```

Ghostscript가 없으면 압축 없이 원본 PDF가 그대로 저장됩니다.

### config.json — frontend_url

Playwright가 방문할 프론트엔드 URL. 기본값은 `http://localhost:8080` (로컬 개발).
서버에서는 실제 URL로 변경한다:

```json
{
  "frontend_url": "http://localhost:31080"
}
```

## 배포 워크플로우

개발 서버에 배포되는 흐름:

```
[로컬] master에 커밋 + push
   ↓
[로컬] python3 publish.py --dev     → master를 dev-release로 머지/푸시
   ↓ (3분 이내)
[서버] cron이 release.py --dev 실행 → git pull → uv sync → alembic → systemctl --user restart
   ↓
[서버] 텔레그램 알림 발송
```

### publish.py (로컬에서 실행)

```sh
python3 publish.py --dev     # master → dev-release (push)
python3 publish.py --prod    # master → release (push)
```

인자 없이 실행하면 **안전상 거부**. `--dev`/`--prod` 중 하나 명시 필수. worktree가 dirty 하거나 master가 아니면 거부.

### release.py (서버에서 cron 실행)

`master` 가 아니라 `release` / `dev-release` 브랜치를 감시하며, 새 커밋이 있으면:

1. 서비스 정지 → `git pull` → `uv sync` → `alembic upgrade head` → 서비스 재기동
2. `systemctl --user status` + `/api/v1/health` 헬스체크
3. 성공/실패 텔레그램 알림 (commit 수, 이전/현재 SHA, alembic revision 전후, 롤백 상태 포함)
4. 실패 시 자동 롤백 (`git reset --hard <prev>` + `uv sync` + 서비스 재기동). DB 마이그레이션은 **자동 downgrade 안 함** — 알림으로 수동 판단 유도.

3분 간격 cron 등록 절차는 [houseinus-infra/CRON_README.md](../houseinus-infra/CRON_README.md) 참고. 락 파일(`.release.lock`)로 동시 실행 방지, 자체 로그(`houseinus-release*.log`)에 전체 내역 기록.

## 구성

### 설정 (config.json)

`.env` 대신 `config.json`을 씁니다. `config.example.json`이 템플릿.
우선순위: **init kwargs > config.json > 환경변수 > secrets**.

### 시간대

서버 기준 시간대는 `config.json`의 `timezone` 필드로 설정 (기본 `Asia/Seoul`, UTC+9).
DB에는 항상 UTC(TIMESTAMPTZ)로 저장하고, 응답 시 `app/time_utils.py`의 `to_app_tz()`로 변환해서 씁니다.

### DB 스키마

- `users` — 이메일/비밀번호 + 프로필. OAuth-only 유저는 `password_hash`가 NULL.
- `oauth_accounts` — 유저-프로바이더 링크 테이블. `(provider, provider_user_id)` UNIQUE.
  한 유저가 여러 OAuth 프로바이더를 연결할 수 있음.
- `auth_tokens` — 이메일 인증 / 비밀번호 재설정용 토큰. 토큰 자체는 해시만 저장.

세션은 DB가 아니라 **Redis**에 저장. 키: `session:<sid>` → user_id + 메타데이터.
유저당 세션 추적은 `user_sessions:<user_id>` Set으로. 비밀번호 변경 시 일괄 무효화 가능.

### API 경로

모든 엔드포인트는 `/api/v1/` 아래.

| Method | Path | 설명 |
|---|---|---|
| GET  | `/api/v1/health` | 헬스체크 |
| POST | `/api/v1/auth/register` | 이메일+비번 회원가입 (쿠키 세션 발급) |
| POST | `/api/v1/auth/login` | 이메일+비번 로그인 |
| POST | `/api/v1/auth/logout` | 로그아웃 (세션 폐기 + 쿠키 삭제) |
| GET  | `/api/v1/auth/me` | 현재 로그인한 유저 조회 |
| POST | `/api/v1/auth/password` | 비밀번호 변경 (타 기기 세션 모두 무효화) |
| GET  | `/api/v1/auth/oauth/{provider}/authorize` | OAuth authorize URL 발급 |
| GET  | `/api/v1/auth/oauth/{provider}/callback` | OAuth 콜백 (세션 발급 후 redirect) |
| GET  | `/api/v1/users/me` | 프로필 조회 |
| PATCH| `/api/v1/users/me` | 프로필 수정 |

`{provider}` = `google` | `naver` | `kakao`.

### OAuth 설정

`config.json`의 `oauth.<provider>` 블록에서 enable.
각 프로바이더 개발자 콘솔에 등록할 redirect URI는 config 파일의 `redirect_uri`와 일치해야 함.

기본값은 web 프록시 기준으로 되어 있음:
- `http://localhost:8080/api/v1/auth/oauth/google/callback`
- (vite dev server가 `/api`를 `127.0.0.1:8098`로 프록시하므로 실제 FastAPI가 받음)

프로덕션에서는 실제 도메인으로 바꿔야 함. 자세한 키 발급/등록 절차는 [OAUTH_README.md](OAUTH_README.md).

## 마이그레이션 관리

```sh
# 신규 마이그레이션 생성 (모델 변경 후)
uv run alembic revision --autogenerate -m "add something"

# 적용
uv run alembic upgrade head

# 롤백
uv run alembic downgrade -1
```

## 세션 쿠키

- 이름: `houseinus_session` (config로 변경 가능)
- HttpOnly, SameSite=lax
- 프로덕션에서는 반드시 `session_cookie_secure: true` + HTTPS

## 포트 컨벤션

| 용도 | 포트 | 비고 |
|---|---|---|
| 로컬 개발 API | 8098 | `run_dev.py`, config 기본값 |
| 로컬 Postgres | 8432 | docker-compose |
| 로컬 Redis | 8379 | docker-compose |
| **서버 prod API** | **38080** | `run_prod.py` 기본. nginx가 `/api/*` 프록시 |
| **서버 dev API** | **39080** | `run_prod.py --port 39080` |

## 디렉터리 구조

```
houseinus-api/
├── app/
│   ├── main.py                  # FastAPI 엔트리포인트
│   ├── config.py                # Pydantic Settings (config.json)
│   ├── database.py              # async SQLAlchemy 엔진
│   ├── core/
│   │   ├── security.py          # bcrypt, 토큰 생성
│   │   ├── redis_client.py
│   │   └── session.py           # Redis 세션 관리
│   ├── utils/
│   │   └── time.py              # 시간대 변환
│   ├── models/                  # SQLAlchemy 모델
│   ├── schemas/                 # Pydantic I/O 스키마
│   ├── services/                # 비즈니스 로직 (user / oauth / email / password_reset)
│   └── api/
│       ├── deps.py              # get_current_user / require_role 등 의존성
│       └── v1/
│           ├── router.py
│           ├── auth.py
│           ├── oauth.py
│           ├── admin.py         # 관리자 전용 (유저 목록/검색/차단/권한)
│           └── users.py
├── alembic/
│   ├── env.py
│   └── versions/
├── config.example.json          # config 템플릿
├── config.json                  # 실제 설정 (gitignored)
├── docker-compose.yml           # 로컬 Postgres/Redis
├── houseinus-api.service        # systemd user unit 템플릿
├── install_service.py           # systemd user 서비스 등록 (sudo 불필요)
├── run_dev.py                   # 개발 서버 (--reload)
├── run_prod.py                  # 프로덕션 서버 (multi-worker, proxy headers)
├── publish.py                   # master → release/dev-release 머지/푸시
├── release.py                   # cron으로 서버에서 자동 배포 (gitops-ish)
├── cli.py                       # 운영용 CLI (owner/admin 계정 생성 등)
├── README.md                    # (이 파일)
├── OAUTH_README.md              # Google/Naver/Kakao 연동 상세
├── EMAIL_README.md              # SendGrid 메일 발송 셋업
├── pyproject.toml
└── uv.lock
```

## 관련 문서

- [OAUTH_README.md](OAUTH_README.md) — Google/Naver/Kakao OAuth 키 발급 및 설정
- [EMAIL_README.md](EMAIL_README.md) — SendGrid 트랜잭션 메일(비밀번호 재설정) 연동
- [../houseinus-infra/CRON_README.md](../houseinus-infra/CRON_README.md) — 서버에서 cron 자동 배포 셋업
- [../houseinus-infra/README.md](../houseinus-infra/README.md) — nginx 리버스 프록시 설정
