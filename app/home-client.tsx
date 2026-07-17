'use client'; 

import React from 'react';
import Link from 'next/link'; 
import Image from 'next/image';
import { ThemeToggle } from './components/ThemeToggle'; 

interface ServiceFeature {
  icon: React.ReactNode;
  name: string;
  description: string;
}

interface ValueProp {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const serviceFeatures: ServiceFeature[] = [
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    name: 'Content Writing', 
    description: 'Create blog posts, articles, and web content for businesses. Get paid for quality writing work.' 
  },
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    name: 'Academic Writing', 
    description: 'Use your expertise to write academic papers and research content for students worldwide.' 
  },
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    name: 'Research Surveys', 
    description: 'Share your opinions through market research surveys from established brands and organizations.' 
  },
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    name: 'Sales & Marketing', 
    description: 'Promote products and services through affiliate marketing and earn commissions on sales.' 
  },
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    name: 'Global Chat', 
    description: 'Chat with international users, provide friendly conversations, and earn based on your engagement and activity.' 
  },
];

const valuePropositions: ValueProp[] = [
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    title: 'Secure Platform', 
    description: 'Your data and transactions are protected with industry-standard security measures.' 
  },
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: 'M-Pesa Payments', 
    description: 'Convenient payment processing through M-Pesa for Kenyan users.' 
  },
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    title: 'Customer Support', 
    description: 'Our support team is available to help you with any questions or issues.' 
  },
  { 
    icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: 'Flexible Work', 
    description: 'Work on your own schedule. Choose projects that fit your availability.' 
  },
];

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header className="flex flex-col sm:flex-row justify-between items-center py-4 px-4 md:px-12 bg-surface shadow-sm sticky top-0 z-50 border-b border-border">
      <div className="flex justify-between items-center w-full sm:w-auto">
        <div className="flex items-center space-x-2">
          <Link href="/" aria-label="Go to HustleHub Africa homepage">
            <Image
              src="/logo.png"
              alt="HustleHub Africa Logo"
              width={50}
              height={50}
              className="rounded-md"
              priority
            />
          </Link>
          <Link
            href="/"
            className="hover:text-indigo-700 transition-colors text-2xl font-bold text-indigo-600 hidden sm:inline"
          >
            HustleHub Africa
          </Link>
        </div>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          <button
            onClick={toggleMenu}
            className="sm:hidden p-2 text-text-muted hover:text-indigo-600 focus:outline-none rounded-lg transition-colors"
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <nav className="hidden sm:flex space-x-4 sm:space-x-8 items-center" aria-label="Primary navigation">
        <Link href="/" className="text-text-muted hover:text-indigo-600 transition-colors">Home</Link>
        <Link href="/about" className="text-text-muted hover:text-indigo-600 transition-colors">About</Link>
        <Link href="/blog" className="text-text-muted hover:text-indigo-600 transition-colors">Blog</Link>
        <Link href="/contact" className="text-text-muted hover:text-indigo-600 transition-colors">Contact</Link>
        <ThemeToggle />
      </nav>

      <nav 
        id="mobile-menu"
        className={`sm:hidden w-full flex-col mt-3 transition-all duration-300 ease-in-out bg-surface ${isOpen ? 'max-h-96 opacity-100 py-2 border-t border-border' : 'max-h-0 opacity-0 overflow-hidden'}`}
        aria-label="Mobile navigation menu"
      >
        <Link href="/" className="block py-2 px-3 text-text hover:bg-bg-subtle rounded-lg transition-colors" onClick={toggleMenu}>Home</Link>
        <Link href="/about" className="block py-2 px-3 text-text hover:bg-bg-subtle rounded-lg transition-colors" onClick={toggleMenu}>About</Link>
        <Link href="/blog" className="block py-2 px-3 text-text hover:bg-bg-subtle rounded-lg transition-colors" onClick={toggleMenu}>Blog</Link>
        <Link href="/contact" className="block py-2 px-3 text-text hover:bg-bg-subtle rounded-lg transition-colors" onClick={toggleMenu}>Contact</Link>
      </nav>
    </header>
  );
};

const Footer: React.FC = () => (
  <footer className="bg-gray-900 dark:bg-gray-950 text-gray-400 dark:text-gray-500 pt-12 pb-8 px-4 md:px-12">
    <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
      <div className="col-span-1 sm:col-span-2 md:col-span-1">
        <div className="flex items-center space-x-2 mb-4">
          <Image
            src="/logo.png"
            alt="HustleHub Africa Logo"
            width={40}
            height={40}
            className="rounded-full"
          />
          <h3 className="text-xl font-bold text-white">HustleHub Africa</h3>
        </div>
        <p className="text-sm text-gray-400">
          A platform for freelance work opportunities in Kenya and across Africa.
        </p>
      </div>

      <div>
        <h4 className="text-white font-semibold mb-3">Company</h4>
        <ul className="space-y-2 text-sm">
          <li><Link href="/about" className="hover:text-indigo-400 transition-colors">About Us</Link></li>
          <li><Link href="/contact" className="hover:text-indigo-400 transition-colors">Contact</Link></li>
          <li><Link href="/blog" className="hover:text-indigo-400 transition-colors">Blog</Link></li>
          <li><Link href="/faq" className="hover:text-indigo-400 transition-colors">FAQ</Link></li>
        </ul>
      </div>

      <div>
        <h4 className="text-white font-semibold mb-3">Legal</h4>
        <ul className="space-y-2 text-sm">
          <li><Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms of Service</Link></li>
          <li><Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link></li>
          <li><Link href="/cookies" className="hover:text-indigo-400 transition-colors">Cookie Policy</Link></li>
        </ul>
      </div>

      <div>
        <h4 className="text-white font-semibold mb-3">Contact</h4>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="mailto:support@hustlehubafrica.com" className="hover:text-indigo-400 transition-colors">
              support@hustlehubafrica.com
            </a>
          </li>
          <li>+254 707 871154</li>
          <li>Nairobi, Kenya</li>
        </ul>
      </div>
    </div>

    <div className="max-w-7xl mx-auto border-t border-gray-700 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center text-xs">
      <p>2025 HustleHub Africa. All rights reserved.</p>
      <div className="flex space-x-4 mt-3 md:mt-0">
        <Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms</Link>
        <span className="text-gray-700">|</span>
        <Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy</Link>
        <span className="text-gray-700">|</span>
        <Link href="/cookies" className="hover:text-indigo-400 transition-colors">Cookies</Link>
      </div>
    </div>
  </footer>
);

const HeroSection: React.FC = () => (
  <section className="py-16 md:py-24 px-4 md:px-12 bg-gradient-to-b from-indigo-50 to-bg dark:from-slate-900 dark:to-bg">
    <div className="max-w-6xl mx-auto text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-heading mb-6 leading-tight text-balance">
        Freelance Opportunities for African Professionals
      </h1>
      <p className="text-xl text-text-muted mb-8 max-w-3xl mx-auto text-pretty">
        HustleHub Africa connects skilled professionals with legitimate freelance work opportunities including content writing, academic writing, surveys, and marketing projects.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
        {/* Auth buttons temporarily disabled */}
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl overflow-hidden shadow-xl border border-gray-200 max-w-4xl">
          <Image
            src="/hero-desktop.png"
            width={900}
            height={500}
            className="hidden md:block w-full h-auto"
            alt="HustleHub Africa platform dashboard preview"
          />
          <Image
            src="/hero-mobile.png"
            width={400}
            height={500}
            className="block md:hidden w-full h-auto"
            alt="HustleHub Africa mobile dashboard preview"
          />
        </div>
      </div>
    </div>
  </section>
);

const ServicesSection: React.FC = () => (
  <section id="services" className="py-16 px-4 md:px-12 bg-bg">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-heading mb-4">
          Our Services
        </h2>
        <p className="text-lg text-text-muted max-w-2xl mx-auto">
          We offer various freelance opportunities for skilled professionals looking for legitimate work.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {serviceFeatures.map((feature, index) => (
          <div key={index} className="bg-bg-subtle p-6 rounded-xl border border-border hover:shadow-lg transition-shadow">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 text-indigo-600">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-heading mb-2">{feature.name}</h3>
                <p className="text-text-muted">{feature.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const WhyChooseUsSection: React.FC = () => (
  <section id="why-us" className="py-16 px-4 md:px-12 bg-bg-subtle">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-heading mb-4">
          Why Choose HustleHub Africa
        </h2>
        <p className="text-lg text-text-muted max-w-2xl mx-auto">
          We are committed to providing a trustworthy platform for freelancers and businesses alike.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {valuePropositions.map((prop, index) => (
          <div key={index} className="bg-surface p-6 rounded-xl border border-border text-center hover:shadow-lg transition-shadow">
            <div className="flex justify-center mb-4 text-indigo-600">
              {prop.icon}
            </div>
            <h3 className="text-lg font-semibold text-heading mb-2">{prop.title}</h3>
            <p className="text-text-muted text-sm">{prop.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const HowItWorksSection: React.FC = () => (
  <section className="py-16 px-4 md:px-12 bg-bg">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-heading mb-4">
          How It Works
        </h2>
        <p className="text-lg text-text-muted max-w-2xl mx-auto">
          Getting started with HustleHub Africa is simple and straightforward.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
            1
          </div>
          <h3 className="text-xl font-semibold text-heading mb-2">Create Your Account</h3>
          <p className="text-text-muted">
            Sign up with your email and complete your profile with your skills and experience.
          </p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
            2
          </div>
          <h3 className="text-xl font-semibold text-heading mb-2">Browse Opportunities</h3>
          <p className="text-text-muted">
            Explore available projects that match your skills and interests.
          </p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
            3
          </div>
          <h3 className="text-xl font-semibold text-heading mb-2">Complete Work & Get Paid</h3>
          <p className="text-text-muted">
            Deliver quality work and receive payment through M-Pesa.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const CTASection: React.FC = () => (
  <section className="py-16 px-4 md:px-12 bg-indigo-600">
    <div className="max-w-4xl mx-auto text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
        Ready to Get Started?
      </h2>
      <p className="text-xl text-indigo-100 mb-8">
        Join our community of freelancers and start working on projects that match your skills.
      </p>
      
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
        {/* Auth buttons temporarily disabled */}
      </div>
    </div>
  </section>
);

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-grow">
        <HeroSection />
        <ServicesSection />
        <WhyChooseUsSection />
        <HowItWorksSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
