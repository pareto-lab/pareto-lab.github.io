# houseinus-infra

`houseinus-infra`는 Houseinus 서비스의 웹 프론트엔드 정적 파일을 Nginx로 서빙하고, `/api/` 요청을 호스트에서 실행 중인 `houseinus-api`로 프록시하기 위한 Docker Compose 설정 저장소입니다.

현재 구성은 단일 베어메탈 Ubuntu 서버에서 직접 운영하는 것을 전제로 합니다. 서버에서는 이 저장소를 `git pull`로 갱신하며, compose 파일 안에 서버 로컬 절대 경로가 포함되어 있습니다.

## 저장소 구조

```text
houseinus-infra/
├── AGENTS.md
├── README.md
├── dev/
│   ├── docker-compose.yml
│   └── nginx.conf
└── prod/
    ├── docker-compose.yml
    └── nginx.conf
```

## 구성 요약

| 환경 | Compose 경로 | 컨테이너 이름 | 외부 포트 | 웹 루트 볼륨 | API 프록시 대상 |
| --- | --- | --- | --- | --- | --- |
| Prod | `prod/docker-compose.yml` | `houseinus-nginx` | `30080:80` | `/home/yeibeen/serve/houseinus-web:/app:ro` | `host.docker.internal:38080` |
| Dev | `dev/docker-compose.yml` | `houseinus-nginx-dev` | `31080:80` | `/home/yeibeen/serve/houseinus-web-dev:/app:ro` | `host.docker.internal:39080` |

Nginx는 컨테이너 내부의 `/app/dist`를 웹 루트로 사용합니다. 따라서 각 웹 저장소에는 빌드 결과물인 `dist/` 디렉터리가 존재해야 합니다.

## 서버 디렉터리

이 저장소는 서버에서 다음 위치에 배치되는 것을 기준으로 작성되어 있습니다.

```text
/home/yeibeen/serve/houseinus-infra
```

관련 애플리케이션 저장소는 서버 내 다음 경로들을 사용합니다.

```text
/home/yeibeen/serve/houseinus-web
/home/yeibeen/serve/houseinus-web-dev
```

`AGENTS.md`에는 prod/dev 애플리케이션 저장소가 각각 `/home/yeibeen/serve/prod-apps`, `/home/yeibeen/serve/dev-apps` 아래에 위치한다고 적혀 있습니다. 반면 현재 compose 파일은 위의 `houseinus-web`, `houseinus-web-dev` 절대 경로를 직접 마운트합니다. 서버 경로를 바꿀 때는 compose 파일의 `volumes` 설정도 함께 확인해야 합니다.

## Nginx 동작

두 환경의 Nginx 설정은 포트만 다르고 기본 동작은 같습니다.

- `/` 요청은 `/app/dist` 아래 정적 파일을 서빙합니다.
- SPA 라우팅을 위해 정적 파일이 없으면 `/index.html`로 fallback합니다.
- `/api/` 요청은 호스트에서 실행 중인 `houseinus-api`로 프록시합니다.
- WebSocket 요청을 위해 `Upgrade`, `Connection` 헤더를 전달합니다.
- SSE 응답을 위해 `proxy_buffering`과 `proxy_cache`를 끕니다.
- 장시간 연결을 위해 `proxy_read_timeout`, `proxy_send_timeout`을 `3600s`로 설정합니다.
- gzip 압축을 활성화합니다.

Linux Docker 환경에서 컨테이너가 호스트의 API 서버에 접근할 수 있도록 compose 파일에 다음 설정이 들어 있습니다.

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## 실행 방법

### Prod 실행

```bash
cd /home/yeibeen/serve/houseinus-infra/prod
docker compose up -d
```

Prod Nginx는 서버의 `30080` 포트로 노출됩니다.

### Dev 실행

```bash
cd /home/yeibeen/serve/houseinus-infra/dev
docker compose up -d
```

Dev Nginx는 서버의 `31080` 포트로 노출됩니다.

## 운영 명령

### 상태 확인

```bash
docker compose ps
```

### 로그 확인

```bash
docker compose logs -f nginx
```

### 설정 반영

`docker-compose.yml` 또는 `nginx.conf`를 변경한 뒤에는 해당 환경 디렉터리에서 컨테이너를 다시 생성합니다.

```bash
docker compose up -d
```

### 중지

```bash
docker compose down
```

## 호스트 사전 준비 (최초 1회)

API 서버(`houseinus-api`)는 Docker 없이 호스트에서 직접 실행되므로, 아래 항목은 호스트에 직접 설치해야 합니다.

### Playwright Chromium

PDF 생성 기능(`/properties/{id}/print-pdf`)에 필요합니다. `uv sync` 이후 아래 명령을 실행합니다.

```bash
cd /home/yeibeen/serve/houseinus-api   # 또는 houseinus-api-dev 경로
uv run playwright install --with-deps chromium
```

`--with-deps`는 Chromium 실행에 필요한 시스템 의존성(libglib, libnss 등)도 함께 설치합니다.
배포 자동화(`release.py`)가 `uv sync`를 수행한 뒤에는 이 명령도 함께 실행되어야 합니다 — 현재는 수동으로 실행하거나 `release.py`에 추가하세요.

### 한국어 폰트

Playwright 헤드리스 Chromium은 시스템 폰트를 사용합니다. 서버에 한국어 폰트가 없으면 PDF 본문이 깨집니다.

```bash
sudo apt-get install -y fonts-noto-cjk fonts-noto-cjk-extra
fc-cache -fv
```

### Ghostscript (PDF 압축)

Playwright가 생성한 PDF를 `/printer` 품질(~300 dpi)로 재압축하여 용량을 줄입니다.

```bash
sudo apt install ghostscript
gs --version   # 설치 확인
```

설치하지 않아도 동작하지만 PDF 파일 크기가 커질 수 있습니다.

### config.json — frontend_url

API가 Playwright에 전달하는 프론트엔드 URL을 설정해야 합니다. (`houseinus-api/config.json`)

| 환경 | 값 |
|---|---|
| Prod | `http://localhost:30080` |
| Dev | `http://localhost:31080` |

```json
{
  "frontend_url": "http://localhost:30080"
}
```

## 배포 체크리스트

1. 웹 저장소에서 프론트엔드 빌드가 완료되어 `dist/`가 생성되어 있는지 확인합니다.
2. API 서버가 호스트에서 실행 중인지 확인합니다.
   - Prod: `127.0.0.1:38080`
   - Dev: `127.0.0.1:39080`
3. 이 저장소에서 최신 설정을 가져옵니다.

```bash
cd /home/yeibeen/serve/houseinus-infra
git pull
```

4. 변경된 환경 디렉터리에서 compose를 재실행합니다.

```bash
cd /home/yeibeen/serve/houseinus-infra/prod
docker compose up -d
```

또는 dev 환경인 경우:

```bash
cd /home/yeibeen/serve/houseinus-infra/dev
docker compose up -d
```

## 주의사항

- compose 파일은 서버 로컬 절대 경로에 의존합니다. 로컬 개발 머신이나 다른 서버에서 그대로 실행하면 웹 볼륨 경로가 맞지 않을 수 있습니다.
- 웹 볼륨은 읽기 전용(`:ro`)으로 마운트됩니다. 컨테이너 안에서 빌드 산출물을 수정하지 않습니다.
- `/api/` 프록시는 API 서버가 컨테이너가 아니라 호스트에서 실행 중인 구조를 전제로 합니다.
- 외부 도메인, HTTPS 인증서, 상위 리버스 프록시 설정은 이 저장소에 포함되어 있지 않습니다.
