import type { RequestHandler } from "express";

type WindowEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_ACTIVATION_ATTEMPTS = 40;
const MAX_TRACKED_KEYS = 20_000;

function createWindowLimiter(limit: number, useUsername: boolean): RequestHandler {
  const attempts = new Map<string, WindowEntry>();
  let lastCleanup = 0;

  return (request, response, next) => {
    const now = Date.now();
    const clientIp = request.ip || request.socket.remoteAddress || "unknown";
    const rawUsername = request.body && typeof request.body.username === "string"
      ? request.body.username
      : "";
    const username = rawUsername.trim().toLowerCase().slice(0, 120) || "<missing>";
    const key = useUsername ? `${clientIp}:${username}` : clientIp;

    if (now - lastCleanup > 60_000) {
      for (const [entryKey, entry] of attempts) {
        if (entry.resetAt <= now) attempts.delete(entryKey);
      }
      lastCleanup = now;
    }

    let entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      attempts.set(key, entry);
    }

    if (entry.count >= limit) {
      response.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      response.setHeader("Cache-Control", "no-store");
      response.status(429).json({
        success: false,
        error: {
          code: "TOO_MANY_ATTEMPTS",
          message: "Too many attempts. Try again later."
        }
      });
      return;
    }

    entry.count += 1;

    // Bound memory growth if requests provide many distinct usernames/IPs.
    if (attempts.size > MAX_TRACKED_KEYS) {
      for (const [entryKey, existing] of attempts) {
        if (existing.resetAt <= now || attempts.size > MAX_TRACKED_KEYS * 0.9) {
          attempts.delete(entryKey);
        }
        if (attempts.size <= MAX_TRACKED_KEYS * 0.8) break;
      }
    }

    next();
  };
}

/**
 * Per-process throttling is defense-in-depth, not a substitute for CDN/WAF
 * controls. Only request.ip is used; arbitrary forwarded headers are not trusted.
 */
export const loginRateLimit = createWindowLimiter(MAX_LOGIN_ATTEMPTS, true);
export const kioskActivationRateLimit = createWindowLimiter(MAX_ACTIVATION_ATTEMPTS, false);
