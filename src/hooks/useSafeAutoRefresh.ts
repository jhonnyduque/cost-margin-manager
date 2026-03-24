import { useEffect, useRef } from 'react';

interface UseSafeAutoRefreshOptions {
  /** Master switch — set to false on routes/states where refresh makes no sense. */
  enabled: boolean;
  /** Polling interval in ms. Default: 60 000 (1 min). */
  intervalMs?: number;
  /** Called every tick when safe to refresh. Keep this cheap — ideally just call the store loaders. */
  onRefresh: () => void | Promise<void>;
  /** Extra pause predicate evaluated every tick — return `true` to skip that tick. */
  shouldPause?: () => boolean;
}

// ── UI Guard helpers ──────────────────────────────────────────

const hasOpenModal = (): boolean =>
  Boolean(
    document.querySelector(
      '.modal-overlay, [role="dialog"][aria-modal="true"], [data-refresh-lock="true"]'
    )
  );

const isEditingFieldFocused = (): boolean => {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

// ── Hook ──────────────────────────────────────────────────────

export const useSafeAutoRefresh = ({
  enabled,
  intervalMs = 60_000,
  onRefresh,
  shouldPause,
}: UseSafeAutoRefreshOptions) => {
  const refreshRef = useRef(onRefresh);
  const isRunningRef = useRef(false);

  // Always keep the latest callback without restarting the interval.
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const tick = async () => {
      // ── 1. Overlap guard: skip if previous tick is still running ──
      if (isRunningRef.current) return;

      // ── 2. UI guards: never refresh while the user is interacting ──
      const blocked =
        document.hidden ||
        hasOpenModal() ||
        isEditingFieldFocused() ||
        (shouldPause?.() ?? false);

      if (blocked) return;

      // ── 3. Execute ──
      isRunningRef.current = true;
      try {
        await refreshRef.current();
      } finally {
        isRunningRef.current = false;
      }
    };

    const timer = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, shouldPause]);
};
