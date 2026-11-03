import { describe, expect, it } from "vitest";
import { assertPublicUrl, BlockedUrlError, isPrivateAddress } from "../safe-fetch";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://10.0.0.5",
    "http://user:pass@example.com",
    "not a url",
  ])("rejects %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it("accepts a public IP literal", async () => {
    await expect(assertPublicUrl("https://1.1.1.1/")).resolves.toBeInstanceOf(URL);
  });
});
