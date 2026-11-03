import { afterEach, describe, expect, it, vi } from "vitest";
import { UpstreamError, geocode } from "../osm";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const row = [{ lat: "30.27", lon: "-97.74", display_name: "Austin, Travis County, Texas, USA" }];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("map service resilience", () => {
  it("retries a transient failure once", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(ok(row));
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocode("Retry City")).resolves.toMatchObject({ lat: 30.27 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("gives up after one retry with a clear error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocode("Down City")).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 15_000);

  it("serves a stale cached answer when the service is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(row)));
    const fresh = await geocode("Stale City");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000); // past the 10-minute fresh window
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));
    await expect(geocode("Stale City")).resolves.toEqual(fresh);
  }, 15_000);

  it("does not retry a client error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(geocode("Bad City")).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 15_000);
});
