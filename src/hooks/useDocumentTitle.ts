import { useEffect } from "react";

const DEFAULT_TITLE = "하우스인어스 | 단독주택 라이프스타일 포트폴리오";

/**
 * SPA 내 라우트 이동 시 브라우저 탭 제목을 동기화한다.
 * unmount 시 항상 기본 제목으로 복원하므로, 새 페이지에서 hook 호출을
 * 깜빡해도 직전 페이지 제목이 남아있는 사고가 발생하지 않는다.
 *
 * 동적 데이터(fetch 결과)에 의존하는 경우 데이터 도착 전에는 undefined를
 * 넘기면 된다 — 그동안은 직전 set 결과 또는 기본 제목이 표시된다.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (title) document.title = title;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
