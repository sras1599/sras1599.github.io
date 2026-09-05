# Analytics recommendation

Research date: 2026-09-05. Site context verified locally by the coordinating agent: rasmalai.dev is a static Astro personal portfolio/blog deployed to GitHub Pages, with a shared `src/layouts/BaseLayout.astro`.

## Recommendation

Start with hosted Umami Cloud for pageviews, referrers, popular posts, and a few intentional outbound/contact events. It avoids running an analytics server and database alongside a static website. Its official FAQ confirms a free Hobby plan; check the current event allowance and retention at signup because the pricing page could not be extracted during this research. [Cloud FAQ](https://docs.umami.is/docs/cloud/faq), [pricing](https://umami.is/pricing).

Use Plausible instead if paying for a focused dashboard and longer history is preferable. Its current Starter plan lists $9/month at 10,000 monthly pageviews, one site, custom events, and three years of retention. Pageviews plus custom events count toward usage. [Pricing](https://plausible.io/#pricing), [billing definitions](https://plausible.io/docs/subscription-plans).

## Alternatives

| Service | Cost and fit | Measurement/privacy |
| --- | --- | --- |
| Umami Cloud | Free Hobby available; recommended starting point | Cookie-free tracker; custom click events; automatic SPA navigation support. [FAQ](https://docs.umami.is/docs/faq), [events](https://docs.umami.is/docs/track-events) |
| Plausible | Paid; useful when longer retained history matters | Cookie-free; automatic outbound links, downloads, and form completions; custom events. [Product and pricing](https://plausible.io/) |
| Cloudflare Web Analytics | Free, works without changing DNS or hosting | Good for basic traffic and performance; currently no custom events or UTM support, and six months of history. [Overview](https://developers.cloudflare.com/web-analytics/about/), [limitations](https://developers.cloudflare.com/web-analytics/faq/) |
| GA4 | Free standard product; more suitable if advertising attribution becomes a requirement | Uses first-party cookies by default; enhanced measurement handles outbound clicks. [Free product](https://marketingplatform.google.com/about/small-business/), [cookies](https://support.google.com/analytics/answer/11397207), [outbound clicks](https://support.google.com/analytics/answer/13566436?hl=en) |

## Proposed setup

1. Register the production domain with Umami Cloud and add its supplied deferred tracking snippet once in the shared Astro layout. Gate it to production and the intended hostname to exclude local development and previews. The tracker uses ordinary HTML and does not require changing GitHub Pages hosting. [Installation](https://docs.umami.is/docs/collect-data).
2. Track pageviews automatically. Add named click events only for meaningful actions such as email, GitHub, LinkedIn, project links, or resume downloads where present. Use fixed event names; avoid sending personal information or arbitrary query strings. [Custom events](https://docs.umami.is/docs/track-events).
3. Validate one pageview per navigation and one event per click in the live dashboard after deployment; exclude personal visits. Review traffic sources, top pages, and contact/project clicks monthly.

No analytics integration or account configuration was performed. The recommendation assumes modest personal-site traffic and no immediate requirement for advertising attribution or user-level tracking.
