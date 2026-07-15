import React from 'react';
import './ui/global.css';
import { timesNewRoman } from './ui/fonts';
import type { Metadata, Viewport } from 'next';
import { DashboardProvider } from './dashboard/DashboardContext';
import SessionProvider from './providers/SessionProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import Script from 'next/script';
import { auth } from '@/auth';
import { Analytics } from "@vercel/analytics/next"
import { warmupDatabaseConnection } from './lib/db-warmup';

export const metadata: Metadata = {
  metadataBase: new URL('https://hustlehubafrica.com'),
  title: {
    template: '%s | HustleHub Africa',
    default: 'HustleHub Africa - Freelance Work Platform',
  },
  description: 'HustleHub Africa connects skilled professionals with freelance opportunities including content writing, academic writing, research surveys, and marketing projects. Based in Kenya, serving Africa.',
  keywords: [
    'freelance jobs kenya',
    'content writing jobs',
    'academic writing',
    'online work kenya',
    'freelance platform africa',
    'writing jobs kenya',
    'hustle hub africa',
  ],
  authors: [{ name: 'HustleHub Africa' }],
  creator: 'HustleHub Africa',
  publisher: 'HustleHub Africa',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/favicon-16x16.png',
        type: 'image/png',
        sizes: '16x16',
      },
      {
        url: '/favicon-32x32.png',
        type: 'image/png',
        sizes: '32x32',
      },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  manifest: '/site.webmanifest',
  
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://hustlehubafrica.com',
    siteName: 'HustleHub Africa',
    title: 'HustleHub Africa - Freelance Work Platform',
    description: 'Connect with freelance opportunities in content writing, academic writing, surveys, and marketing. A trusted platform for African professionals.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'HustleHub Africa - Freelance Work Platform',
        type: 'image/png',
      },
    ],
  },
  
  twitter: {
    card: 'summary_large_image',
    site: '@HustleHubAfrica',
    creator: '@HustleHubAfrica',
    title: 'HustleHub Africa - Freelance Work Platform',
    description: 'Freelance opportunities for African professionals in writing, surveys, and marketing.',
    images: ['/opengraph-image.png'],
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  verification: {
    google: 'your-google-verification-code',
  },
  
  category: 'Business',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4F46E5' },
    { media: '(prefers-color-scheme: dark)', color: '#312E81' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Warm up database connection in background (no await to avoid blocking)
  warmupDatabaseConnection().catch(err => 
    console.error('[v0] Failed to warm up database:', err instanceof Error ? err.message : 'Unknown')
  );

  const session = await auth();

  const contextValue = {
    user: null,
  };

  // Structured Data - Organization Schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'HustleHub Africa',
    url: 'https://hustlehubafrica.com',
    logo: 'https://hustlehubafrica.com/logo.png',
    description: 'A freelance work platform connecting African professionals with legitimate opportunities',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Nairobi',
      addressCountry: 'KE',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+254-707-871154',
      contactType: 'Customer Service',
      areaServed: 'KE',
      availableLanguage: ['English', 'Swahili'],
    },
  };

  // Structured Data - Website Schema
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'HustleHub Africa',
    url: 'https://hustlehubafrica.com',
    description: 'Freelance work platform for African professionals',
  };

  return (
    <html lang="en" className={`${timesNewRoman.variable}`} suppressHydrationWarning>
      <head>
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <Script
          id="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema),
          }}
        />

        {/* MathJax Configuration */}
        <Script
          id="mathjax-config"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.MathJax = {
                tex: {
                  inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                  displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                  processEscapes: true,
                  processEnvironments: true,
                },
                svg: {
                  fontCache: 'global',
                  scale: 1.2,
                },
                startup: {
                  pageReady: () => {
                    return Promise.resolve();
                  },
                },
                options: {
                  ignoreHtmlClass: 'tex2jax_ignore',
                  processHtmlClass: 'tex2jax_process',
                  enableMenu: false,
                },
              };
            `,
          }}
        />
        
        <Script
          id="mathjax-script"
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          strategy="afterInteractive"
        />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
      </head>
      <body className={`${timesNewRoman.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <SessionProvider session={session}>
            <DashboardProvider value={contextValue}>
              {children}
              <Analytics />
            </DashboardProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
