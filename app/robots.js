export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tirupurclothinghub.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep crawlers off admin, API, and endless cart/checkout/filter URLs
        disallow: ['/admin', '/api', '/cart', '/checkout', '/*?*sort=', '/*?*filter='],
      },
      {
        // AI training / scraper bots: block entirely to save function invocations
        userAgent: ['GPTBot', 'CCBot', 'ClaudeBot', 'Bytespider', 'Amazonbot', 'PerplexityBot', 'anthropic-ai'],
        disallow: '/',
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}