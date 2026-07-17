'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

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

export default Header;
