# API 에러 코드 규약

API 에러는 항상 안정적인 **에러 코드**를 응답에 실어 보낸다. 사람을 위한
한국어 메시지는 프론트엔드에서 코드 기준으로 결정한다. 백엔드는 사용자에게
보일 한국어를 직접 만들지 않는다.

## 응답 형태

모든 4xx/5xx 응답은 다음 envelope 를 따른다:

```json
{ "code": "<machine-readable-code>", "detail": "<dev-facing message>" }
```

- `code` — `[a-z][a-z0-9_-]*` 형식. 안정적인 식별자(API 컨트랙트의 일부).
  바꾸면 프론트의 메시지 매핑이 깨지므로 신중히 변경한다.
- `detail` — 개발자/로그용. 사용자에게 직접 노출하지 않는다.

422(검증) 응답은 `code: "validation-error"` 로 통일하고 `detail` 에 원본
검증 에러 배열을 담는다.

## 사용 방법

`HTTPException` 대신 `app.core.errors.ApiException` 을 raise 한다:

```python
from app.core.errors import ApiException

if prop is None:
    raise ApiException(404, "self-publish-link-invalid")

if slug_already_taken:
    raise ApiException(409, "slug-taken", detail=f"slug={slug} -> #{other_id}")
```

전역 핸들러는 `app/main.py` 에서 `install_error_handlers(app)` 으로 설치된다.
순수 `HTTPException` 을 raise 해도 자동으로 `code: "http-<status>"` 로 wrap 된다(레거시 호환).

## 코드 네이밍

- 기능 도메인을 prefix 로 두고 kebab-case 로 작성: `self-publish-link-invalid`,
  `inquiry-already-submitted`, `image-too-large`.
- HTTP 상태와 1:1 매칭되지 않아도 된다. 같은 404 라도 의미가 다르면 코드를
  분리한다 (`property-not-found` vs `image-not-found`).
- 메시지/카피는 영어로 가지 말 것 — `code` 는 영어이고, 한국어는 프론트의
  매핑 테이블에서 산다.

## 새 코드를 추가할 때

1. 백엔드에서 `ApiException(status, "<new-code>")` 를 raise.
2. 프론트의 해당 feature 페이지/훅의 `Record<string, string>` 매핑에
   `"<new-code>": "한국어 메시지"` 추가.
3. 매핑이 없는 코드는 `lib/errorMessage.ts` 의 공통 fallback 으로 떨어진다.
