import Link from 'next/link';
import Image from 'next/image';

const Footer: React.FC = () => (
  <footer className="bg-gray-900 text-gray-400 pt-12 pb-8 px-4 md:px-12">
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
          A freelance work platform connecting skilled African professionals with legitimate opportunities.
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

export default Footer;
