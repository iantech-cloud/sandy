'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { sendSupportEmail } from '@/app/actions/email';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // Registration & Account
  {
    question: "How do I create an account on HustleHub Africa?",
    answer: "Creating an account is simple. Click the Sign Up button on our homepage, fill in your details including your email and phone number, complete the registration fee payment, and you will have access to the platform.",
    category: "Registration & Account"
  },
  {
    question: "Is there a registration fee?",
    answer: "Yes, there is a one-time registration fee of KES 90. This covers your account setup and provides access to all platform features.",
    category: "Registration & Account"
  },
  {
    question: "Can I use the same account on multiple devices?",
    answer: "Yes, your HustleHub Africa account can be accessed from any device - phone, tablet, or computer. Simply log in with your credentials.",
    category: "Registration & Account"
  },

  // Services & Opportunities
  {
    question: "What services does HustleHub Africa offer?",
    answer: "We offer various freelance opportunities including content writing, academic writing assistance, research surveys, and sales and marketing projects.",
    category: "Services & Opportunities"
  },
  {
    question: "How does the referral program work?",
    answer: "When you refer someone to HustleHub Africa using your unique referral link and they complete registration, you receive a referral bonus of KES 70.",
    category: "Services & Opportunities"
  },
  {
    question: "What are research surveys?",
    answer: "Research surveys are questionnaires from market research companies. You share your opinions on various topics and receive compensation for completed surveys. Survey availability and compensation varies.",
    category: "Services & Opportunities"
  },
  {
    question: "What types of writing work are available?",
    answer: "We connect writers with opportunities for blog posts, articles, web content, and academic writing assistance. Compensation depends on project complexity and requirements.",
    category: "Services & Opportunities"
  },

  // Payments & Withdrawals
  {
    question: "How do I withdraw funds?",
    answer: "Withdrawals are processed via M-Pesa. Go to your dashboard, click Withdraw, enter your M-Pesa number and amount, and submit your request. The minimum withdrawal is KES 500.",
    category: "Payments & Withdrawals"
  },
  {
    question: "Is there a withdrawal fee?",
    answer: "We charge a processing fee of 2% per withdrawal to cover M-Pesa transaction costs.",
    category: "Payments & Withdrawals"
  },
  {
    question: "What is the minimum withdrawal amount?",
    answer: "The minimum withdrawal amount is KES 500.",
    category: "Payments & Withdrawals"
  },
  {
    question: "How long do withdrawals take?",
    answer: "Withdrawal processing times may vary. Most withdrawals are completed within 24-48 hours during business days.",
    category: "Payments & Withdrawals"
  },

  // Technical Support
  {
    question: "What if I forget my password?",
    answer: "Click Forgot Password on the login page. We will send a reset link to your registered email address. You can also contact our support team for assistance.",
    category: "Technical Support"
  },
  {
    question: "Is my personal information secure?",
    answer: "We use encryption and follow data protection practices to secure your personal and financial information.",
    category: "Technical Support"
  },
  {
    question: "What devices are supported?",
    answer: "HustleHub Africa works on smartphones (Android and iOS), tablets, laptops, and desktop computers.",
    category: "Technical Support"
  },

  // Platform & Support
  {
    question: "Is HustleHub Africa available outside Kenya?",
    answer: "Currently, we primarily serve Kenyan users due to our M-Pesa payment integration.",
    category: "Platform & Support"
  },
  {
    question: "How do I contact customer support?",
    answer: "You can reach our support team via email at support@hustlehubafrica.com or by phone at +254 748 264 231 during business hours.",
    category: "Platform & Support"
  },
  {
    question: "Where can I find more information about your services?",
    answer: "You can learn more about our services on our About page, or contact our support team with specific questions.",
    category: "Platform & Support"
  }
];

const categories = [
  "All Questions",
  "Registration & Account",
  "Services & Opportunities",
  "Payments & Withdrawals",
  "Technical Support",
  "Platform & Support"
];

const FAQItemComponent: React.FC<{ item: FAQItem }> = ({ item }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <button
        className="w-full px-6 py-5 text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="text-lg font-semibold text-gray-900 pr-4">{item.question}</span>
        <span className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div className={`px-6 pb-5 transition-all duration-300 ${isOpen ? 'block' : 'hidden'}`}>
        <div className="border-t border-gray-200 pt-4">
          <p className="text-gray-700 leading-relaxed">{item.answer}</p>
        </div>
      </div>
    </div>
  );
};

const SearchBar: React.FC<{ searchTerm: string; setSearchTerm: (term: string) => void }> = ({ 
  searchTerm, 
  setSearchTerm 
}) => (
  <div className="relative max-w-2xl mx-auto mb-12">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
    </div>
    <input
      type="text"
      placeholder="Search for answers..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </div>
);

const CategoryFilter: React.FC<{ 
  selectedCategory: string; 
  setSelectedCategory: (category: string) => void 
}> = ({ selectedCategory, setSelectedCategory }) => (
  <div className="flex flex-wrap justify-center gap-3 mb-12">
    {categories.map((category) => (
      <button
        key={category}
        onClick={() => setSelectedCategory(category)}
        className={`px-4 py-2 rounded-full font-medium transition-all duration-300 text-sm ${
          selectedCategory === category
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {category}
      </button>
    ))}
  </div>
);

const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const result = await sendSupportEmail(formData);
      
      if (result.success) {
        setSubmitStatus({
          type: 'success',
          message: 'Thank you for your message. We will respond within 24-48 hours.'
        });
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setSubmitStatus({
          type: 'error',
          message: result.error || 'Failed to send your message. Please try again.'
        });
      }
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: 'An error occurred. Please try again or email us directly at support@hustlehubafrica.com'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-16 px-4 md:px-12 bg-indigo-600 text-white">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Still Have Questions?</h2>
          <p className="text-xl text-indigo-100">
            Contact our support team and we will get back to you.
          </p>
        </div>

        <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8">
          {submitStatus.type && (
            <div className={`mb-6 p-4 rounded-lg ${
              submitStatus.type === 'success' 
                ? 'bg-green-500 bg-opacity-20 border border-green-400' 
                : 'bg-red-500 bg-opacity-20 border border-red-400'
            }`}>
              <p className={submitStatus.type === 'success' ? 'text-green-200' : 'text-red-200'}>
                {submitStatus.message}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white bg-opacity-20 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                  placeholder="Your name"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white bg-opacity-20 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                  placeholder="your@email.com"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div>
              <label htmlFor="subject" className="block text-sm font-medium mb-2">Subject</label>
              <input
                type="text"
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white bg-opacity-20 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                placeholder="What is your question about?"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">Message</label>
              <textarea
                id="message"
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-white bg-opacity-20 border border-white border-opacity-30 text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 resize-none"
                placeholder="Describe your question..."
                required
                disabled={isSubmitting}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full font-semibold py-3 px-6 rounded-lg transition-colors ${
                isSubmitting
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-white text-indigo-600 hover:bg-gray-100'
              }`}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default function FAQPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Questions');

  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = searchTerm === '' || 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All Questions' || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="bg-indigo-600 py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-indigo-100">
              Find answers to common questions about HustleHub Africa.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 px-4 md:px-12 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
            <CategoryFilter selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />

            {filteredFAQs.length > 0 ? (
              <div className="space-y-4">
                {filteredFAQs.map((faq, index) => (
                  <FAQItemComponent key={index} item={faq} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No questions found matching your search.</p>
                <p className="text-gray-500 mt-2">Try a different search term or category.</p>
              </div>
            )}
          </div>
        </section>

        {/* Contact Section */}
        <ContactSection />

        {/* CTA Section */}
        <section className="py-16 px-4 md:px-12 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Create an account and explore freelance opportunities on HustleHub Africa.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                href="/auth/sign-up"
                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Create Account
              </Link>
              <Link 
                href="/contact"
                className="px-8 py-3 border-2 border-indigo-600 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
