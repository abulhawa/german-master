import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("favicon configuration", () => {
  it("wires a browser tab icon in client/index.html", () => {
    const indexPath = path.resolve(__dirname, "..", "client", "index.html");
    const indexHtml = readFileSync(indexPath, "utf8");

    expect(indexHtml).toContain('rel="icon"');
    expect(indexHtml).toContain('href="/favicon.png"');
  });

  it("ships the favicon asset in public/", () => {
    const faviconPath = path.resolve(__dirname, "..", "client", "public", "favicon.png");

    expect(existsSync(faviconPath)).toBe(true);
    expect(statSync(faviconPath).size).toBeGreaterThan(0);
  });
});

describe("search indexing metadata", () => {
  const publicDir = path.resolve(__dirname, "..", "client", "public");
  const canonicalOrigin = "https://germanmaster.qortxai.com";

  it("ships a sitemap with canonical public URLs", () => {
    const sitemapPath = path.join(publicDir, "sitemap.xml");
    const sitemap = readFileSync(sitemapPath, "utf8");

    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(sitemap).toContain(`<loc>${canonicalOrigin}/</loc>`);
    expect(sitemap).toContain(`<loc>${canonicalOrigin}/privacy</loc>`);
    expect(sitemap).toContain(`<loc>${canonicalOrigin}/delete-account</loc>`);
    expect(sitemap).not.toContain("germanverbmaster.com");
  });

  it("points crawlers at the sitemap from robots.txt", () => {
    const robotsPath = path.join(publicDir, "robots.txt");
    const robots = readFileSync(robotsPath, "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain(`Sitemap: ${canonicalOrigin}/sitemap.xml`);
    expect(robots).not.toContain("germanverbmaster.com");
  });
});
