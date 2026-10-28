import type { RequestHandler } from "express";

type WindowEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_TRACKED_KEYS = 20_000;
const attempts = new Map<string, WindowEntry>();
let lastCleanup = 0;

/**
 * Lightweight per-process throttling for credential endpoints.
 * This is a defense-in-depth layer, not a replacement for CDN/WAF controls.
 * The app deliberately does not trust arbitrary X-Forwarded-For headers.
 */
export const loginRateLimit: RequestHandler = (request, response, next) => {
  const now = Date.now();
  const rawUsername = request.body && typeof request.body.username === "string"
    ? request.body.username
    : "";
  const username = rawUsername.trim().toLowerCase().slice(0, 120) || "<missing>";
  const clientIp = request.ip || request.socket.remoteAddress || "unknown";
  const key = `${clientIp}:${username}`;

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

  if (entry.count >= MAX_ATTEMPTS) {
    response.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
    response.setHeader("Cache-Control", "no-store");
    response.status(429).json({
      success: false,
      error: {
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many login attempts. Try again later."
      }
    });
    return;
  }

  entry.count += 1;

  // Bound memory growth if requests provide many distinct usernames.
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
