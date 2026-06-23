import { useEffect } from "react";

/**
 * Browser-level guard: blocks tab close / refresh while ``dirty`` is true.
 * Doesn't block in-app navigation (use react-router's <Prompt>/blocker for that),
 * but is enough for the most common "I forgot to save" case.
 *
 * Also publishes a module-level dirty count so other components (e.g. the agent
 * panel) can check whether any form currently has unsaved edits before doing
 * something destructive like invalidating cached server data.
 */

let dirtyCount = 0;

export function hasDirtyForms(): boolean {
  return dirtyCount > 0;
}

export function useDirtyGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    dirtyCount += 1;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      dirtyCount = Math.max(0, dirtyCount - 1);
    };
  }, [dirty]);
}
