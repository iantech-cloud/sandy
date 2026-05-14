import type { Metadata } from 'next';
import HomePageClient from './home-client';

export const metadata: Metadata = {
  title: 'HustleHub Africa - Freelance Work Platform',
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
  
  alternates: {
    canonical: '/',
    languages: {
      'en-KE': '/',
    },
  },
  
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://hustlehubafrica.com',
    siteName: 'HustleHub Africa',
    title: 'HustleHub Africa - Freelance Work Platform',
    description: 'Connect with freelance opportunities in content writing, academic writing, surveys, and marketing. A trusted platform for African professionals.',
    images: [
      {
        url: '/og-image.png',
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
    images: ['/og-image.png'],
  },
};

export default function Page() {
  return <HomePageClient />;
}
