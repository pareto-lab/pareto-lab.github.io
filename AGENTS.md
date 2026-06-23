# Git Branch 작업 규칙

## 기능 개발
- 기능을 새로 만들 때는 별도 브랜치에서 작업한다.
- 작업 중 유효한 체크포인트마다 커밋하고 원격(`origin`)에 푸시한다.

## 테스트 및 머지 순서
- 로컬 테스트가 끝나면 변경한 기능뿐 아니라 기존 기능(안 건드린 기능)도 전부 확인한다.
- 확인이 끝나면 `master`에 머지한다.
- `dev-release` 브랜치에 `master`를 머지한다.
- `https://dev.paretolab.kr`에서 다시 한 번 테스트한다.
- 이후 `release` 브랜치에 `master`를 머지한다.

## 브랜치 작업 권한
- 브랜치 생성/머지는 사용자가 명시적으로 요청한 경우에만 수행한다.

# API 에러 코드 규약

API 에러는 코드 기반으로 처리한다. **사용자에게 보이는 한국어 메시지는
프론트에서 코드를 보고 결정**하며, 백엔드의 `detail` 문자열은 그대로 노출하지
않는다. (백엔드 측 컨벤션은 `houseinus-api/AGENTS.md` 참고.)

## 응답 envelope

```ts
{ code: string;  // [a-z][a-z0-9_-]*, 안정적인 식별자
  detail: unknown;  // dev-facing — UI 에 직접 표시 금지
}
```

응답이 envelope 를 따르지 않으면 (네트워크/프록시 에러 등) `code` 는 자동으로
`http-<status>` 또는 `network-error` 로 폴백된다.

## 사용 방법

`apiClient` 가 던지는 `ApiError` 의 `.code` 를 분기 기준으로 쓴다. 직접 비교
하지 말고 `lib/errorMessage.ts` 의 `messageForError` 헬퍼를 거친다:

```ts
import { messageForError } from "@/lib/errorMessage";

const FEATURE_MESSAGES: Record<string, string> = {
  "self-publish-link-invalid": "매물을 찾을 수 없거나 링크가 만료되었습니다.",
  "validation-error": "유효하지 않은 링크입니다.",
};

try {
  await api(...);
} catch (err) {
  setError(messageForError(err, FEATURE_MESSAGES, "게시 링크를 열 수 없습니다."));
}
```

- 기능별로 작은 `Record<code, message>` 매핑을 그 페이지/훅 안에 둔다.
- 공통 코드 (`http-401`, `http-403`, `http-404`, `validation-error` 등) 는
  `lib/errorMessage.ts` 의 `COMMON_MESSAGES` 가 처리한다.
- 매핑되지 않은 코드는 호출자의 fallback 문구로 떨어진다.

## 하지 말 것

- `err.message` / `err.detail` / `String(err)` 를 사용자에게 그대로 노출하지
  않는다 (영어 또는 검증 객체 dump 가 새어 나간다).
- HTTP status 로 분기하지 않는다 — 같은 404 라도 의미가 다르므로 코드로
  분기한다.
- 백엔드에서 한국어 메시지를 만들어 내려보내지 않는다. 메시지의 source of
  truth 는 프론트의 매핑 테이블이다.
