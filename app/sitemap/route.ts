import { MetadataRoute } from 'next'

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://hustlehubafrica.com'
  const today = new Date()
  
  const sitemap: MetadataRoute.Sitemap = [
    // Homepage
    {
      url: baseUrl,
      lastModified: today,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    // Public Marketing Pages (only unauthenticated content)
    {
      url: `${baseUrl}/blog`,
      lastModified: today,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/academic-writing`,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sales-marketing`,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/refer-earn`,
      lastModified: today,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: today,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: today,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: today,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    // Blog Posts
    {
      url: `${baseUrl}/blog/why-and-how-affiliate-marketing-is-the-future-of-earning-online`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/quick-ways-to-make-money-online-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/top-ai-tools-for-making-money-online-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/a-guide-to-online-writing-jobs-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/best-freelancing-websites-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/how-to-make-money-on-fiverr-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/how-to-make-money-on-tiktok-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/how-much-can-you-earn-on-a-faceless-youtube-channel`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/how-to-make-money-on-youtube-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.64,
    },
    {
      url: `${baseUrl}/blog/affiliate-marketing-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.51,
    },
    {
      url: `${baseUrl}/blog/how-to-get-additional-sources-of-income-in-kenya`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.51,
    },
    {
      url: `${baseUrl}/blog/how-to-make-money-online-in-kenya-2025`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.51,
    },
    {
      url: `${baseUrl}/blog/how-to-make-money-online-in-kenya-various-ways-2025-guide`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.51,
    },
    {
      url: `${baseUrl}/blog/affiliate-marketing-in-kenya-2025-guide-how-to-get-started`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.51,
    },
    {
      url: `${baseUrl}/blog/guidelines-on-how-to-register`,
      lastModified: today,
      changeFrequency: 'monthly',
      priority: 0.65,
    },
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" 
        xmlns:xhtml="http://www.w3.org/1999/xhtml" 
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" 
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" 
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  ${sitemap.map((item) => `
  <url>
    <loc>${item.url}</loc>
    <lastmod>${item.lastModified.toISOString()}</lastmod>
    <changefreq>${item.changeFrequency}</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join('')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
    },
  })
}
