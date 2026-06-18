import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - HustleHub Africa',
  description: 'Privacy Policy for HustleHub Africa',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8 sm:p-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
            <p>
              HustleHub Africa (&quot;we,&quot; &quot;us,&quot; &quot;our,&quot; or &quot;Company&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Information We Collect</h2>
            <p>
              We may collect information about you in a variety of ways. The information we may collect on the site includes:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Data:</strong> Name, email address, phone number, and other identifying information you provide during registration.</li>
              <li><strong>Payment Information:</strong> Billing address, payment method details for processing transactions.</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our platform, including pages visited and time spent.</li>
              <li><strong>Device Information:</strong> Device type, operating system, browser type, and IP address.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Use of Your Information</h2>
            <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the site to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create and manage your account</li>
              <li>Process your transactions and send related information</li>
              <li>Email you regarding your account or order</li>
              <li>Fulfill and manage purchases, orders, payments, and other transactions related to the site</li>
              <li>Generate a personal profile about you for internal marketing and demographic purposes</li>
              <li>Increase the efficiency and operation of the site</li>
              <li>Monitor and analyze usage and trends to improve your experience with the site</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Disclosure of Your Information</h2>
            <p>
              We may share your information in the following situations:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to comply with the law.</li>
              <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us, including payment processors, data analysis providers, and customer service representatives.</li>
              <li><strong>Business Transfers:</strong> If we are involved in a merger, acquisition, or sale of all or a portion of our assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Security of Your Information</h2>
            <p>
              We use administrative, technical, and physical security measures to protect your personal information. However, no method of transmission over the Internet or method of electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Contact Us</h2>
            <p>
              If you have questions or comments about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-4">
              <strong>HustleHub Africa</strong><br />
              Email: privacy@hustlehubafrica.com<br />
              Phone: +254 (0) 123 456 789
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link href="/auth/sign-up" className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
            Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
