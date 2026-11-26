import type { APIRoute } from "astro";
import routes from "../../.generated/sitemap.json";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("The sitemap requires Astro's site origin");

  const entries = routes.map(({ url }) => {
    const location = new URL(url, site).href
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
    return `  <url><loc>${location}</loc></url>`;
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
