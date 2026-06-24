import type { Metadata } from 'next'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Referral Program | HustleHub Africa',
  description: 'Learn about the HustleHub Africa referral program. Refer friends to our freelance platform and earn referral bonuses when they join.',
  openGraph: {
    title: 'Referral Program | HustleHub Africa',
    description: 'Learn about the HustleHub Africa referral program.',
    url: 'https://hustlehubafrica.com/refer-earn',
    siteName: 'HustleHub Africa',
    locale: 'en_KE',
    type: 'website',
  },
}

export default function ReferralProgram() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="bg-indigo-600 py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Referral Program
            </h1>
            <p className="text-xl text-indigo-100 max-w-2xl mx-auto">
              Know someone who would benefit from freelance opportunities? Share HustleHub Africa with them and earn a referral bonus when they join.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              How the Referral Program Works
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Get Your Referral Link</h3>
                <p className="text-gray-600">
                  After creating an account, you will receive a unique referral link in your dashboard.
                </p>
              </div>

              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Share with Friends</h3>
                <p className="text-gray-600">
                  Share your link with friends, family, or colleagues who might be interested in freelance work.
                </p>
              </div>

              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Earn Referral Bonus</h3>
                <p className="text-gray-600">
                  When someone signs up using your link and completes their registration, you earn a referral bonus.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Program Details */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Program Details
            </h2>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Referral Bonus</h3>
                  <p className="text-gray-600">
                    You earn KES 70 for each person who signs up using your referral link and completes the registration process.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Track Referrals</h3>
                  <p className="text-gray-600">
                    You can track all your referrals and bonus payments in your dashboard under the Referrals section.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment of Bonuses</h3>
                  <p className="text-gray-600">
                    Referral bonuses are added to your account balance and can be withdrawn through the normal withdrawal process via M-Pesa.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Terms</h3>
                  <p className="text-gray-600">
                    The referral program is subject to our Terms of Service. We reserve the right to modify or discontinue the program at any time. Fraudulent referrals will not be eligible for bonuses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              Frequently Asked Questions
            </h2>

            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Who can I refer?</h3>
                <p className="text-gray-600">
                  You can refer anyone who might be interested in freelance work opportunities, such as writers, researchers, or marketing professionals.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">When do I receive my referral bonus?</h3>
                <p className="text-gray-600">
                  Your referral bonus is credited to your account after the referred person completes their account registration and activation.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Is there a limit to how many people I can refer?</h3>
                <p className="text-gray-600">
                  There is no limit to the number of people you can refer. However, all referrals must be genuine and comply with our Terms of Service.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Where do I find my referral link?</h3>
                <p className="text-gray-600">
                  Your unique referral link is available in your dashboard under the Referrals section after you create and activate your account.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-indigo-600">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Start?
            </h2>
            <p className="text-xl text-indigo-100 mb-8">
              Create an account to get your referral link and start sharing HustleHub Africa with your network.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link 
                href="/auth/login"
                className="px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Login to Dashboard
              </Link>
              <p className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg text-center">
                Sign up only via referral link
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
