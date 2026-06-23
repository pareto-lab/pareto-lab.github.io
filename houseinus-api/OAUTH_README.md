# OAuth 연동 가이드

houseinus-api에서 Google / Naver / Kakao 로그인을 켜기 위한 절차. (2026년 4월 기준, 각 공식 문서 교차 확인 완료)

## 전체 흐름

1. 각 프로바이더 개발자 콘솔에서 애플리케이션 등록 → Client ID / Client Secret 발급
2. Redirect URI(Callback URL)를 콘솔에 등록
3. 발급받은 값을 `houseinus-api/config.json`의 `oauth.<provider>` 블록에 입력 + `"enabled": true`로 변경
4. (카카오/네이버) 동의항목/권한 설정
5. 서버 재시작

### Redirect URI 규칙

개발 환경 기준 Redirect URI는 **`http://localhost:8080/api/v1/auth/oauth/<provider>/callback`** 을 사용합니다.

- 브라우저가 접속하는 URL은 Vite 개발 서버(`localhost:8080`)이고, `/api/*`는 FastAPI(`127.0.0.1:8098`)로 프록시되므로 `8080`을 써야 합니다.
- 세 프로바이더 모두 콘솔에 등록한 값과 요청 파라미터의 `redirect_uri`가 **문자 하나까지 정확히** 일치해야 합니다 (http/https, 포트, 경로, trailing slash 포함).
- 프로덕션에서는 실제 도메인(`https://paretolab.kr/api/v1/auth/oauth/<provider>/callback`)으로 교체.

### config.json 입력 위치

```json
{
  ...
  "oauth": {
    "google": {
      "enabled": true,
      "client_id": "여기에 붙여넣기",
      "client_secret": "여기에 붙여넣기",
      "redirect_uri": "http://localhost:8080/api/v1/auth/oauth/google/callback"
    },
    "naver":  { "enabled": true, "client_id": "...", "client_secret": "...", "redirect_uri": "http://localhost:8080/api/v1/auth/oauth/naver/callback" },
    "kakao":  { "enabled": true, "client_id": "...", "client_secret": "...", "redirect_uri": "http://localhost:8080/api/v1/auth/oauth/kakao/callback" }
  }
}
```

`config.json`은 `.gitignore`에 포함되어 있어 커밋되지 않습니다.

---

## 1. Google Login

### 1-1. 프로젝트 / OAuth 동의 화면 준비

1. https://console.cloud.google.com 접속 후 프로젝트 생성 (또는 기존 프로젝트 선택).
2. 왼쪽 메뉴 → **"Google Auth Platform"** → **"Branding"** 진입.
   - 이전 UI에서는 "APIs & Services > OAuth consent screen" 경로. 현재는 "Google Auth Platform"으로 개편됨.
   - "Get started" 버튼을 누르고 다음 값을 입력:
     - **App name**: House in Us
     - **User support email**: 운영자 이메일
     - **Audience**: 개인 Google 계정 유저를 받으려면 **External**, 같은 Google Workspace 도메인만 받으려면 **Internal**.
     - **Contact email**: 관리자 이메일
3. Audience 탭에서 **Publishing status**를 확인.
   - "Testing" 상태에서는 **Test users**에 등록된 Gmail 주소만 로그인 가능. 로컬 테스트용 계정을 여기에 추가.
   - 외부에 오픈할 때는 "Publish app"으로 프로덕션 상태 전환.

### 1-2. OAuth 2.0 Client ID 생성

1. 왼쪽 메뉴 → **"Google Auth Platform"** → **"Clients"** (또는 고전 경로: **"APIs & Services" → "Credentials"**).
2. **Create client** 클릭.
3. **Application type**: `Web application` 선택.
4. **Name**: `houseinus-web-local` 같이 식별 가능한 이름.
5. **Authorized redirect URIs**에 다음 값 추가:
   ```
   http://localhost:8080/api/v1/auth/oauth/google/callback
   ```
   운영용 도메인이 준비되면 함께 추가.
6. **Create** → 팝업에 `Client ID`와 `Client secret`이 표시됨. 두 값 복사.

### 1-3. config.json 반영

```json
"google": {
  "enabled": true,
  "client_id": "123456789-abcdefg.apps.googleusercontent.com",
  "client_secret": "GOCSPX-xxxxxxxxxxxxxxxx",
  "redirect_uri": "http://localhost:8080/api/v1/auth/oauth/google/callback"
}
```

### 1-4. 참고

- 구글은 `localhost`/`127.0.0.1` redirect URI에 대해서만 HTTP를 허용. 그 외는 HTTPS 필수.
- 설정 변경 후 반영까지 5분~수 시간 지연될 수 있음 (Google 공식 언급).
- 서버가 사용하는 scope은 `openid email profile` (코드에 하드코딩).

---

## 2. Kakao Login

### 2-1. 애플리케이션 생성

1. https://developers.kakao.com/console/app 접속 → 카카오 계정 로그인.
2. **애플리케이션 추가하기** 클릭.
   - **앱 이름**: House in Us
   - **사업자명**: 개인/회사명
   - **카테고리**: 적절히 선택
3. 생성된 앱 진입.

### 2-2. 앱 키 / 플랫폼 / 로그인 설정

1. 좌측 **"앱 설정 > 요약 정보"** → **앱 키**에서 **REST API 키**를 복사. 이것이 `client_id`.
2. 좌측 **"앱 설정 > 플랫폼"** → **Web 플랫폼 등록** → **사이트 도메인**에 다음을 추가:
   ```
   http://localhost:8080
   ```
   (도메인만. 경로나 포트 없이 스키마+호스트+포트까지만.)
3. 좌측 **"제품 설정 > 카카오 로그인"** 진입.
   - **활성화 설정** 토글을 **ON**. (기본은 OFF라서 켜지 않으면 인증 거부됨.)
   - **Redirect URI** 등록 영역에 다음 추가:
     ```
     http://localhost:8080/api/v1/auth/oauth/kakao/callback
     ```

### 2-3. Client Secret 발급 (필수)

카카오 정책 변경으로 **Client Secret이 REST API 키에 기본 활성화**됩니다. 키가 없으면 토큰 요청이 실패할 수 있으니 반드시 확인:

1. **"제품 설정 > 카카오 로그인 > 보안"** 진입.
2. **Client Secret 코드 생성**(없으면) → 값 복사.
3. **활성화 상태**를 `사용함`으로 설정.

이 값이 `client_secret`.

### 2-4. 동의항목 설정

1. **"제품 설정 > 카카오 로그인 > 동의항목"** 진입.
2. 서버에서 사용하는 최소 동의항목:
   - **닉네임** (`profile_nickname`) — "필수 동의" 또는 "선택 동의"
   - **프로필 사진** (`profile_image`) — 선택
   - **카카오계정(이메일)** (`account_email`) — **비즈 앱 전환 필요 또는 "선택 동의"**로 설정 가능. 다만 "필수 동의"로 하려면 비즈니스 심사 필요.

> **주의**: 이메일은 유저가 카카오 계정을 이메일로 만들지 않았거나 동의하지 않으면 null로 내려옵니다. 서버 코드(`app/services/user_service.py`)는 이 경우 `{provider}_{provider_user_id}@placeholder.local` 형태의 대체 이메일로 유저를 생성합니다.

### 2-5. config.json 반영

```json
"kakao": {
  "enabled": true,
  "client_id": "앱 설정 > 요약 정보의 REST API 키",
  "client_secret": "제품 설정 > 카카오 로그인 > 보안의 Client Secret",
  "redirect_uri": "http://localhost:8080/api/v1/auth/oauth/kakao/callback"
}
```

### 2-6. 참고

- 엔드포인트: `https://kauth.kakao.com/oauth/authorize` / `https://kauth.kakao.com/oauth/token` / `https://kapi.kakao.com/v2/user/me` — 서버 코드에 내장.
- 서버가 요청하는 scope: `account_email profile_nickname` (`app/services/oauth_service.py`).
- 공식 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api

---

## 3. Naver Login

### 3-1. 애플리케이션 등록

1. https://developers.naver.com/apps/#/register 접속 → 네이버 계정 로그인.
2. **애플리케이션 등록** 양식 입력:
   - **애플리케이션 이름**: `House in Us` (외부에 보이는 이름)
   - **사용 API**: 목록에서 **"네이버 로그인"** 선택.
   - **제공 정보 선택**: 아래 3개를 "필수"로 설정 (선택이면 프로필에 없을 수 있음)
     - **회원이름** 또는 **별명**
     - **이메일 주소**
     - **프로필 사진** (선택)
3. **환경 추가**에서 **"PC웹"** 추가:
   - **서비스 URL**: `http://localhost:8080` (프로덕션에선 실제 도메인)
   - **네이버 로그인 Callback URL**: `http://localhost:8080/api/v1/auth/oauth/naver/callback`
4. **등록하기** 클릭.

### 3-2. Client ID / Client Secret 확인

등록 완료 후 **"내 애플리케이션 > [앱 이름] > 개요"** 로 이동:
- **Client ID** — 복사
- **Client Secret** — "보기" 버튼을 눌러 표시한 뒤 복사

### 3-3. config.json 반영

```json
"naver": {
  "enabled": true,
  "client_id": "발급받은 Client ID",
  "client_secret": "발급받은 Client Secret",
  "redirect_uri": "http://localhost:8080/api/v1/auth/oauth/naver/callback"
}
```

### 3-4. 참고

- 엔드포인트: `https://nid.naver.com/oauth2.0/authorize` / `https://nid.naver.com/oauth2.0/token` / `https://openapi.naver.com/v1/nid/me` — 서버 코드에 내장.
- 네이버는 authorize 단계에서 별도 scope 파라미터가 필요하지 않음 (동의항목은 개발자센터의 "제공 정보 선택"으로 결정).
- 검수 없이도 자기 네이버 계정으로는 테스트 가능. 외부 사용자에게 오픈하려면 "검수 신청" 필요.
- Callback URL 불일치가 가장 흔한 오류. 포트/경로까지 글자 단위로 맞출 것.

---

## 4. 동작 확인

세팅 후:

```sh
cd houseinus-api
uv run python run_dev.py
```

브라우저 테스트:

1. http://127.0.0.1:8098/api/v1/docs 열기.
2. `GET /api/v1/auth/oauth/{provider}/authorize` 실행 → 응답의 `authorization_url` 복사.
3. 해당 URL을 새 탭에 열어 프로바이더 로그인 완료.
4. 콜백이 `http://localhost:8080/api/v1/auth/oauth/{provider}/callback?code=...&state=...`으로 리다이렉트됨.
   - 이 경로는 Vite 프록시를 통해 FastAPI까지 전달되므로 `houseinus-web`의 `npm run dev`가 켜져 있어야 함.
5. FastAPI가 토큰 교환 → 프로필 조회 → 유저 생성/링크 → 세션 쿠키 세팅 → `/`로 302 리다이렉트.
6. `GET /api/v1/auth/me`로 로그인 상태 확인.

---

## 5. 흔한 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| `redirect_uri_mismatch` | 콘솔 등록값과 요청값 불일치 | 포트/경로/trailing slash까지 1:1로 맞추기. 구글은 반영에 수 분 걸릴 수 있음. |
| Kakao 토큰 요청이 `invalid_client` | Client Secret 활성화 안 됨 | "제품 설정 > 카카오 로그인 > 보안"에서 Client Secret을 생성 후 **활성화** |
| Kakao `KOE101` (앱 없음) | Redirect URI 또는 플랫폼 도메인 미등록 | "플랫폼"에 도메인 등록 + "카카오 로그인" 활성화 |
| Naver 프로필에 email이 `null` | "제공 정보 선택"에서 이메일이 누락 또는 "선택" | 이메일을 "필수"로 바꾸고 재동의 필요 |
| Google "Access blocked" | Testing 모드이고 해당 계정이 test user에 없음 | OAuth Platform > Audience에 test user 추가, 또는 Publish |
| `state` mismatch | Redis가 꺼져 있거나 10분 초과 | `docker compose up -d`로 Redis 확인, 빠르게 재시도 |

---

## 6. 프로덕션 전환 체크리스트

- [ ] 각 프로바이더 콘솔에 **프로덕션 도메인**의 redirect URI 추가
- [ ] `config.json`의 `redirect_uri`를 `https://...` 로 교체
- [ ] `config.json`의 `session_cookie_secure`를 `true`로
- [ ] `cors_allowed_origins`에 실제 프론트 도메인만 포함
- [ ] Kakao: 이메일 필수 동의가 필요하면 비즈 앱 심사 신청
- [ ] Naver: 외부 유저에게 열려면 "검수 요청" 제출
- [ ] Google: OAuth consent screen을 "In production"으로 Publish

---

## 참고 문서

이 가이드 작성 시 교차 확인한 공식/1차 자료:

### Google
- [Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) — 엔드포인트/파라미터 레퍼런스
- [Setting up OAuth 2.0](https://support.google.com/cloud/answer/6158849?hl=en) — 콘솔 설정 절차
- [Manage OAuth Clients](https://support.google.com/cloud/answer/15549257?hl=en) — 최신 Google Auth Platform 콘솔 가이드

### Kakao
- [카카오 로그인 REST API 문서](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api) — 엔드포인트/파라미터
- [카카오 로그인 구현하기 (튜토리얼)](https://developers.kakao.com/docs/latest/ko/tutorial/login) — 콘솔 설정 절차
- [Kakao Developers 콘솔](https://developers.kakao.com/console/app) — 앱 관리 화면

### Naver
- [네이버 개발자센터 애플리케이션 목록](https://developers.naver.com/apps/#/list) — 앱 관리
- [애플리케이션 등록 가이드 (naver-openapi-guide)](https://naver.github.io/naver-openapi-guide/appregister.html)
- [Naver OAuth endpoints 정리](https://logto.io/oauth-providers-explorer/naver)
