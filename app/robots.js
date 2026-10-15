export default function robots() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sheafashions.in').replace(/\/+$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep crawlers off private pages and endless filter/sort/tracking URL variations
        disallow: [
          '/admin',
          '/api/',
          '/cart',
          '/checkout',
          '/account',
          '/login',
          '/register',
          '/wishlist',
          '/orders',
          '/*?*sort=',
          '/*?*filter=',
          '/*?*utm_',
          '/*?*sessionid=',
        ],
      },
      {
        // AI training / scraper bots: block entirely to save function invocations
        userAgent: ['GPTBot', 'CCBot', 'ClaudeBot', 'Bytespider', 'Amazonbot', 'PerplexityBot', 'anthropic-ai'],
        disallow: '/',
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}