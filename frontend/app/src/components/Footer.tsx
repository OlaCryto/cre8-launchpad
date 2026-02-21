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
              <img 
                src="/logo.png" 
                alt="Cre8" 
                className="w-10 h-10 object-contain"
              />
              <img 
                src="/logo-wide.png" 
                alt="Cre8" 
                className="h-6 object-contain"
              />
            </Link>
            <p className="text-sm text-[#8B8B9E] mb-4">
              The fairest dual-mode token launchpad on Avalanche. 
              Launch in Trenches or Forge your legacy.
            </p>
            <div className="flex gap-3">
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#8B8B9E] hover:text-white hover:bg-white/10 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#8B8B9E] hover:text-white hover:bg-white/10 transition-colors">
                <MessageCircle className="w-5 h-5" />
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#8B8B9E] hover:text-white hover:bg-white/10 transition-colors">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-bold text-white mb-4">Platform</h4>
            <ul className="space-y-2">
              <li><Link to="/explore" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Explore Tokens</Link></li>
              <li><Link to="/create" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Launch Token</Link></li>
              <li><Link to="/portfolio" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">My Portfolio</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-bold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-[#8B8B9E] hover:text-white transition-colors flex items-center gap-1">Documentation <ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="#" className="text-sm text-[#8B8B9E] hover:text-white transition-colors flex items-center gap-1">GitHub <ExternalLink className="w-3 h-3" /></a></li>
              <li><a href="#" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">FAQ</a></li>
              <li><a href="#" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Bonding Curve</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-sm text-[#8B8B9E] hover:text-white transition-colors">Risks</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/[0.06]">
          <p className="text-xs text-[#8B8B9E] text-center mb-2">
            ⚠️ Trade responsibly. Memecoins are highly volatile. Never invest more than you can afford to lose.
          </p>
          <p className="text-xs text-[#8B8B9E] text-center">
            © 2026 Cre8. All rights reserved. Built on Avalanche C-Chain.
          </p>
        </div>
      </div>
    </footer>
  );
}
