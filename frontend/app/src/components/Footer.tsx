import { Link } from 'react-router-dom';
import { Twitter, MessageCircle, Github, ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050508]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Cre8" className="w-10 h-10 object-contain" />
              <img src="/logo-wide.png" alt="Cre8" className="h-6 object-contain" />
            </Link>
            <p className="text-sm text-[#8B8B9E] mb-4">
              The fairest token launchpad on Avalanche. Launch your token for under $1.
            </p>
            <div className="flex gap-3">
              <a href="https://x.com/cre8launch" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#8B8B9E] hover:text-white hover:bg-white/10 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://discord.gg/cre8" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#8B8B9E] hover:text-white hover:bg-white/10 transition-colors">
                <MessageCircle className="w-5 h-5" />
              </a>
              <a href="https://github.com/cre8launch" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#8B8B9E] hover:text-white hover:bg-white/10 transition-colors">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold text-white mb-4">Platform</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Explore Tokens</Link></li>
              <li><Link to="/create" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Launch Token</Link></li>
              <li><Link to="/portfolio" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">My Portfolio</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-bold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><Link to="/legal/fees" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Fees</Link></li>
              <li><a href="https://github.com/cre8launch" target="_blank" rel="noopener noreferrer" className="text-sm text-[#8B8B9E] hover:text-white transition-colors flex items-center gap-1">GitHub <ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="https://docs.avax.network/" target="_blank" rel="noopener noreferrer" className="text-sm text-[#8B8B9E] hover:text-white transition-colors flex items-center gap-1">Avalanche Docs <ExternalLink className="w-3 h-3" /></a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/legal/terms" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/legal/privacy" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/legal/fees" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Fees</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-[#8B8B9E]">
            &copy; {new Date().getFullYear()} Cre8. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#8B8B9E]">
            <Link to="/legal/privacy" className="hover:text-white transition-colors">Privacy policy</Link>
            <Link to="/legal/terms" className="hover:text-white transition-colors">Terms of service</Link>
            <Link to="/legal/fees" className="hover:text-white transition-colors">Fees</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
