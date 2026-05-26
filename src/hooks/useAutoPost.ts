import { useEffect, useRef, useState, useCallback } from "react";
import { triggerAutoPost, getPostHistory } from "../utils/api";
import type { AgentConfig, PostLog } from "../types/agent";
import type { Platform } from "../types/platform";
import { ALL_PLATFORMS } from "../types/platform";

interface AutoPostState {
  isRunning: boolean;
  lastCheck: number | null;
  lastPost: number | null;
  nextCheck: number | null;
  recentResults: Array<{
    platform: string;
    success: boolean;
    error?: string;
    time: number;
  }>;
}

/**
 * Hook that automatically triggers posting based on the agent's schedule.
 * Runs a check every `checkIntervalMs` (default 5 minutes) while the
 * dashboard is open and the agent is active.
 *
 * The backend handles:
 * - Which platforms to post to based on schedule
 * - Anti-duplicate logic (won't re-post within minInterval)
 * - Content generation + direct API posting
 *
 * This hook just pings the cron endpoint on an interval.
 */
export function useAutoPost(
  agent: AgentConfig | null,
  onNewPosts?: (posts: PostLog[]) => void,
) {
  const [state, setState] = useState<AutoPostState>({
    isRunning: false,
    lastCheck: null,
    lastPost: null,
    nextCheck: null,
    recentResults: [],
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);

  // Calculate check interval from agent schedule
  // For N posts/day, check every few minutes so posts are spread across the day
  const getCheckIntervalMs = useCallback((): number => {
    if (!agent?.schedule) return 5 * 60 * 1000; // default 5 min

    let hasEnabledPlatform = false;

    for (const platform of ALL_PLATFORMS) {
      const sched = agent.schedule?.[platform];
      if (sched?.enabled) hasEnabledPlatform = true;
    }

    if (!hasEnabledPlatform) return 10 * 60 * 1000;

    // Check every 5 minutes — the backend handles anti-duplicate logic
    // so frequent checks are safe and ensure timely posting
    return 5 * 60 * 1000;
  }, [agent]);

  // Calculate min posting interval from schedule (posts per day -> min gap between posts)
  const getMinPostIntervalMs = useCallback((): number => {
    if (!agent?.schedule) return 30 * 60 * 1000; // default 30 min

    let minGapMs = 24 * 60 * 60 * 1000; // start at 24h

    for (const platform of ALL_PLATFORMS) {
      const sched = agent.schedule?.[platform];
      if (!sched?.enabled) continue;

      const postsPerDay = Math.max(1, sched.postsPerDay || 1);
      const gapMs = Math.floor((24 * 60 * 60 * 1000) / postsPerDay * 0.8);
      if (isFinite(gapMs) && gapMs > 0) {
        minGapMs = Math.min(minGapMs, gapMs);
      }
    }

    // At least 10 minutes between posts
    const result = Math.max(10 * 60 * 1000, minGapMs);
    return isFinite(result) ? result : 30 * 60 * 1000;
  }, [agent]);

  const runCheck = useCallback(async () => {
    if (!isActiveRef.current) return;

    const now = Date.now();
    setState((s) => ({ ...s, lastCheck: now }));

    try {
      const minInterval = getMinPostIntervalMs();
      const result = await triggerAutoPost(false, minInterval);

      if (result?.results && result.results.length > 0) {
        const newResults = result.results.map(
          (r: { platform: string; success: boolean; error?: string }) => ({
            ...r,
            time: Date.now(),
          })
        );

        const anySuccess = result.results.some(
          (r: { success: boolean }) => r.success
        );

        setState((s) => ({
          ...s,
          lastPost: anySuccess ? Date.now() : s.lastPost,
          recentResults: [...newResults, ...s.recentResults].slice(0, 20),
        }));

        // Refresh post history if any post succeeded
        if (anySuccess && onNewPosts) {
          try {
            const history = await getPostHistory(20);
            onNewPosts(history.posts || []);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Silently fail — we'll retry next interval
    }

    // Schedule next check
    const checkInterval = getCheckIntervalMs();
    setState((s) => ({
      ...s,
      nextCheck: Date.now() + checkInterval,
    }));
  }, [getCheckIntervalMs, getMinPostIntervalMs, onNewPosts]);

  // Start/stop the auto-poster based on agent status
  useEffect(() => {
    const shouldRun = agent?.status === "active";

    if (shouldRun && !isActiveRef.current) {
      // Start
      isActiveRef.current = true;
      const checkInterval = getCheckIntervalMs();

      setState((s) => ({
        ...s,
        isRunning: true,
        nextCheck: Date.now() + 10000, // first check in 10 seconds
      }));

      // Initial check after 10 seconds (let the dashboard load first)
      const initialTimeout = setTimeout(() => {
        runCheck();
      }, 10000);

      // Then check on interval
      intervalRef.current = setInterval(() => {
        runCheck();
      }, checkInterval);

      return () => {
        clearTimeout(initialTimeout);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else if (!shouldRun && isActiveRef.current) {
      // Stop
      isActiveRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setState((s) => ({
        ...s,
        isRunning: false,
        nextCheck: null,
      }));
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [agent?.status, getCheckIntervalMs, runCheck]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return state;
}
