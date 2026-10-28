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

    await apiRequest("/auth/login", { method: "POST", body: { username: "building-admin", password: "not-a-real-password" } });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.has("Authorization")).toBe(false);
  });

  it("sends the saved token on authenticated non-login requests", async () => {
    window.localStorage.setItem("smartpass360.token", "building-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    globalThis.fetch = fetchMock;

    await apiRequest("/access/operations-summary");

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer building-token");
  });

  it("surfaces the API's building authorization rejection without masking it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Building access required." } }), {
        status: 403,
        headers: { "content-type": "application/json", "x-request-id": "test-request-id" }
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
