# 이메일 연동 가이드 (SendGrid)

houseinus-api 가 발송하는 모든 트랜잭션 메일은 [SendGrid](https://sendgrid.com)를 거칩니다. 현재는 **비밀번호 재설정 메일**이 유일한 발송 채널이고, 추후 이메일 인증 / 알림 등도 같은 통로를 씁니다.

## 0. 어디에 키를 넣는가

`houseinus-api/config.json` 의 `email` 블록:

```json
"email": {
  "sendgrid_api_key": "SG.여기에붙여넣기",
  "from_email": "no-reply@paretolab.kr",
  "from_name": "House in Us",
  "password_reset_url_template": "https://paretolab.kr/reset-password?token={token}",
  "password_reset_token_lifetime_seconds": 1800
}
```

- `sendgrid_api_key` — §2 에서 발급받음
- `from_email` — **반드시 §1 에서 인증한 발신자 / 도메인** 의 주소여야 함. 인증 안 된 주소로 발송하면 SendGrid 가 403 으로 거절
- `from_name` — 메일에 표시될 발신자 이름 (한글 가능)
- `password_reset_url_template` — 메일 링크가 향할 URL. `{token}` 자리에 raw 토큰 치환됨. 환경별로 다르게:
  - 로컬 개발: `http://localhost:8080/reset-password?token={token}`
  - dev: `https://dev.paretolab.kr/reset-password?token={token}`
  - prod: `https://paretolab.kr/reset-password?token={token}`
- `password_reset_token_lifetime_seconds` — 토큰 유효기간. 기본 30분 (1800)

`sendgrid_api_key` 가 빈 문자열이면 **이메일 발송 자체가 비활성**입니다. `/auth/password/forgot` 호출은 200을 반환하지만 메일은 나가지 않고 서버 로그에 경고만 찍힙니다 (정상 동작 — 이메일 enumeration 방지를 위한 의도된 silent failure).

---

## 1. 발신자 인증 (Sender Authentication)

SendGrid 는 인증되지 않은 주소로의 발송을 막습니다. 두 가지 방식 중 하나 필수:

### 1-A. Single Sender Verification (개인 메일, 빠르고 간단)

테스트나 1인 운영 단계에 적합. 도메인 DNS 권한이 없어도 됨.

1. https://app.sendgrid.com → **Settings** → **Sender Authentication** → **Verify a Single Sender** 클릭
2. 폼 입력:
   - **From Name**: `House in Us`
   - **From Email Address**: 실제로 받을 수 있는 메일 주소 (예: `business@paretolab.kr`)
   - **Reply To**: 동일하게
   - **Address / City / Country**: 회사/개인 주소 (CAN-SPAM 컴플라이언스용)
3. **Create**
4. 입력한 메일함에서 SendGrid 인증 메일 → "Verify Single Sender" 버튼 클릭
5. SendGrid 콘솔에서 해당 sender 가 **Verified** 로 바뀌면 끝

이후 `config.json` 의 `from_email` 을 인증한 주소와 **정확히 일치**시켜야 함.

> **한계**: 메일은 발송되지만 **수신자 입장에서 "via sendgrid.net"** 같은 중계 표기가 붙고, 도착률(deliverability)이 떨어질 수 있음. 운영 단계에선 1-B 권장.

### 1-B. Domain Authentication (운영 권장)

도메인 전체를 인증해서 도메인의 어떤 주소로든 발송 가능. SPF/DKIM 통과로 도착률도 향상.

1. https://app.sendgrid.com → **Settings** → **Sender Authentication** → **Authenticate Your Domain** 클릭
2. **DNS Host**: `Other Host (Not Listed)` (직접 DNS 관리하는 경우) 또는 본인의 호스팅사 (Cloudflare/AWS Route53 등)
3. **Domain You Send From**: `paretolab.kr` 입력. ⚠️ subdomain 분리 권장 — `Use a custom return path`/`Use a custom DKIM selector` 옵션 켜고 `em` 같은 서브도메인으로 설정
4. **Next** 클릭하면 SendGrid 가 등록할 DNS 레코드 3개를 제시:

   | Type | Host | Value |
   |---|---|---|
   | CNAME | `em1234.paretolab.kr` | `u1234.wl.sendgrid.net` |
   | CNAME | `s1._domainkey.paretolab.kr` | `s1.domainkey.u1234.wl.sendgrid.net` |
   | CNAME | `s2._domainkey.paretolab.kr` | `s2.domainkey.u1234.wl.sendgrid.net` |

   *(실제 값은 사용자마다 다름)*

5. 도메인 DNS 관리 콘솔(가비아/Cloudflare/Route53 등)에서 위 3개 CNAME 레코드 추가
6. SendGrid 콘솔로 돌아와 **Verify** 클릭 → 모두 ✅ 면 완료
7. 검증까지 보통 수 분, 길면 수십 분 소요

이후 `from_email` 은 `no-reply@paretolab.kr`, `business@paretolab.kr` 등 **해당 도메인의 어떤 주소**로든 사용 가능.

---

## 2. API 키 발급

1. https://app.sendgrid.com → **Settings** → **API Keys** → **Create API Key**
2. **API Key Name**: `houseinus-api-prod` (또는 `dev`)
3. **API Key Permissions**: `Restricted Access` 선택
4. 권한 목록에서 **Mail Send** 만 `Full Access` 로 토글, 나머지는 `No Access` 그대로
5. **Create & View** → 표시된 키 (`SG.xxxxxxxxxx....`) **즉시 복사**. 이 화면을 닫으면 다시 못 봄
6. `config.json` 의 `sendgrid_api_key` 에 붙여넣기

> **dev / prod 분리**: 환경별로 키를 따로 발급하는 걸 권장. 한쪽이 노출되거나 quota 가 비정상적이면 분리해서 즉시 폐기 가능.

---

## 3. 적용

```sh
# 서버에서 (또는 로컬)
cd /home/yeibeen/serve/prod-apps/houseinus-api
# config.json 수정 후
systemctl --user restart houseinus-api
```

dev 환경은 `houseinus-api-dev`.

---

## 4. 동작 확인

### 4-1. 발송 테스트 (외부 호출)

서버 한 번에서:

```sh
curl -X POST http://127.0.0.1:38080/api/v1/auth/password/forgot \
  -H 'Content-Type: application/json' \
  -d '{"email":"본인메일@example.com"}'
```

- HTTP 200 + `{"message": "입력하신 이메일이 등록되어 있다면 ..."}` 반환
- 해당 이메일이 가입된 유저면 받은편지함 (또는 스팸함) 도착

### 4-2. 받지 못했을 때 디버깅 순서

1. **서버 로그 확인**:
   ```sh
   journalctl --user -u houseinus-api -n 100 --no-pager | grep -i 'sendgrid\|password reset'
   ```
   - `SendGrid API key not configured` → `config.json` 키가 빈 문자열. §0 다시
   - `SendGrid returned 401` → 키 잘못됨 / 폐기됨. §2 다시 발급
   - `SendGrid returned 403` (Forbidden) → `from_email` 이 인증되지 않은 주소. §1 다시
   - `failed to create password reset token` → DB / 마이그레이션 문제

2. **SendGrid 콘솔 → Activity Feed**:
   - https://app.sendgrid.com/email_activity 에서 발송 내역 확인 가능
   - `Delivered` / `Bounced` / `Blocked` / `Deferred` 등 상태별로 필터
   - 실수신자가 안 받았으면 여기서 원인 보임 (예: 수신자 도메인 차단, 임시 거부 등)

3. **수신자 스팸함**: 새 도메인은 처음 며칠 도착률이 낮을 수 있음. 도메인 인증(§1-B)이 안 됐다면 더 심함

### 4-3. Email Activity 가 안 보인다면

기본 SendGrid Free 플랜은 Activity Feed 가 **3일 분량만** 보관됨. 그 이상 필요하면 유료 플랜으로 업그레이드.

---

## 5. 프로덕션 주의사항

### 5-1. 발신 한도

- **SendGrid Free**: 일 100통 무료. 비밀번호 재설정 정도엔 충분
- 그 이상이면 유료 플랜 필요. https://sendgrid.com/pricing 확인

### 5-2. SPF / DMARC

도메인 인증을 하면 자동으로 SPF/DKIM이 통과되지만, **DMARC 레코드**는 별도 추가 권장:

```
TXT  _dmarc.paretolab.kr  "v=DMARC1; p=none; rua=mailto:dmarc@paretolab.kr"
```

- `p=none` 은 모니터링만. 안정화되면 `p=quarantine` 또는 `p=reject` 로 강화
- DMARC 가 있으면 피싱/스푸핑 방어 수준이 올라가고 도착률이 더 좋아짐

### 5-3. 발신 도메인 분리 (권장)

`from_email` 을 `no-reply@em.paretolab.kr` 처럼 서브도메인으로 두면 메인 도메인 평판이 트랜잭션 메일 평판과 분리됨. 한 쪽이 망가져도 다른 쪽이 살아남음.

이 경우 §1-B 의 도메인 인증을 **`em.paretolab.kr` 에 대해** 진행하면 됨.

### 5-4. 키 노출

`config.json` 은 `.gitignore` 에 있어 커밋되지 않지만:

- 서버에서 `chmod 600 config.json` 으로 다른 유저가 못 읽게 권한 제한
- 키 노출 의심 시 SendGrid 콘솔에서 **Delete** + 새 키 발급. 그 사이 발송 멈춤은 수 분

### 5-5. Bounce / Spam 관리

SendGrid 는 자동으로 bounce / spam complaint 을 추적해서 해당 주소로의 재발송을 차단함 (Suppression List). 콘솔의 **Suppressions** 메뉴에서 확인/해제 가능. 비정상적으로 많이 차단되면 도메인 평판이 깎이고 있다는 신호.

---

## 6. 토큰 / URL 흐름 (참고)

운영 중 디버깅에 도움되는 내부 흐름:

1. 유저가 `/admin` → "비밀번호 찾기" → 이메일 입력 → POST `/auth/password/forgot`
2. 백엔드: `app/services/password_reset_service.create_password_reset_token()` 호출
   - `secrets.token_urlsafe(32)` 로 raw 토큰 생성 (43자)
   - 기존 미사용 reset 토큰은 모두 `consumed_at = now` 처리 (one-time)
   - DB에는 **SHA-256 해시만** 저장 (raw 토큰은 메모리/메일에만)
   - 만료 = 발급 시각 + `password_reset_token_lifetime_seconds`
3. `password_reset_url_template` 의 `{token}` 자리에 raw 토큰 치환 → SendGrid 로 메일 발송
4. 유저 이메일 → 링크 클릭 → `/reset-password?token=...` 페이지
5. 새 비번 입력 → POST `/auth/password/reset`
6. 백엔드: `consume_password_reset_token()` 으로 검증 (해시 비교, 만료, 사용 여부)
7. 통과 시 `user.password_hash` 갱신 + 토큰 `consumed_at` 마킹 + **모든 세션 강제 로그아웃** (`destroy_all_user_sessions`)

같은 메일을 두 번 받으면 **첫 번째 링크는 무효화**되고 두 번째만 동작함 (one-time + auto-invalidate).

---

## 7. 빠른 체크리스트

설정 끝낸 뒤 확인:

- [ ] SendGrid 콘솔에서 sender 또는 도메인이 **Verified** 표시
- [ ] `config.json` 의 `sendgrid_api_key` 가 `SG.` 로 시작
- [ ] `from_email` 이 인증된 주소와 정확히 일치
- [ ] `password_reset_url_template` 의 호스트가 실제 운영 도메인과 일치 (dev / prod 분리)
- [ ] `systemctl --user restart houseinus-api` 후 status 가 `active`
- [ ] curl 또는 프론트에서 비밀번호 찾기 시도 → 받은편지함 확인
- [ ] (운영) DMARC 레코드 추가
- [ ] (운영) `chmod 600 config.json`
