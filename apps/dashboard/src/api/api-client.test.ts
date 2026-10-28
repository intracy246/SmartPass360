import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { apiRequest, ApiError } from "./api-client";

describe("apiRequest authorization header", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("does not forward an old saved token on the login request", async () => {
    window.localStorage.setItem("smartpass360.token", "old-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    globalThis.fetch = fetchMock;

    await apiRequest("/auth/login", { method: "POST", body: { username: "owner-user", password: "not-a-real-password" } });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("sends the saved token on authenticated non-login requests", async () => {
    window.localStorage.setItem("smartpass360.token", "owner-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    globalThis.fetch = fetchMock;

    await apiRequest("/auth/buildings");

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer owner-token");
  });

  it("surfaces the Owner API's 403 without masking its reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Owner access required." } }), {
        status: 403,
        headers: { "content-type": "application/json", "x-request-id": "test-owner-request-id" }
      })
    );
    globalThis.fetch = fetchMock;

    await expect(apiRequest("/auth/buildings")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Owner access required."
    } satisfies Partial<ApiError>);
  });

  it("surfaces the Building API's 403 without masking its reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Building access required." } }), {
        status: 403,
        headers: { "content-type": "application/json", "x-request-id": "test-building-request-id" }
      })
    );
    globalThis.fetch = fetchMock;

    await expect(apiRequest("/vehicle-access/requests")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Building access required."
    } satisfies Partial<ApiError>);
  });
});
