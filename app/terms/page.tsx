//app/terms/page.tsx
import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-8 sm:px-10 sm:py-12">
            {/* Header Section */}
            <div className="text-center mb-12 border-b border-gray-200 pb-8">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
                Terms & Conditions and Refund Policy
              </h1>
              <p className="text-gray-600">HustleHub Africa - Effective January 1, 2025</p>
            </div>

            {/* Introduction */}
            <div className="mb-8">
              <p className="text-gray-700 leading-relaxed">
                Welcome to HustleHub Africa. By using our platform and participating in our programs, you agree to these simple terms and conditions.
              </p>
            </div>

            {/* Terms Content */}
            <div className="space-y-8 text-gray-700">
              
              {/* Section 1: Agreement */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">1. Your Agreement</h2>
                <p>By signing up and using HustleHub Africa, you agree to follow these terms. If you don&apos;t agree, please don&apos;t use our platform.</p>
              </section>

              {/* Section 2: Eligibility */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">2. Eligibility</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You must be at least 18 years old</li>
                  <li>You must provide accurate and truthful information</li>
                  <li>You are responsible for your account security</li>
                </ul>
              </section>

              {/* Section 3: Account Responsibility */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">3. Your Account</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You are responsible for all activities under your account</li>
                  <li>Keep your password confidential</li>
                  <li>Notify us immediately of any unauthorized access</li>
                </ul>
              </section>

              {/* Section 4: No Refund Policy */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">4. No Refund Policy</h2>
                <div className="space-y-3">
                  <p className="font-semibold text-red-600">All payments, including activation fees, are non-refundable.</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Once you pay the activation fee, the payment cannot be reversed or refunded</li>
                    <li>If you cancel your account, any unpaid earnings are forfeited</li>
                    <li>Deposits are final and cannot be refunded</li>
                    <li>We do not provide refunds for any reason, including account closure or inactivity</li>
                  </ul>
                </div>
              </section>

              {/* Section 5: Restrictions */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">5. What You Cannot Do</h2>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Engage in fraudulent or illegal activities</li>
                  <li>Manipulate or abuse the referral system</li>
                  <li>Share false information</li>
                  <li>Violate anyone&apos;s privacy or rights</li>
                </ul>
              </section>

              {/* Section 6: Changes */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">6. Changes to Terms</h2>
                <p>We may update these terms at any time. Your continued use of the platform means you accept the new terms.</p>
              </section>

              {/* Section 7: Contact */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">7. Contact Us</h2>
                <p>If you have questions about these terms, please contact us at:</p>
                <p className="mt-2 font-semibold">Support: +254 707 871154</p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsPage;
