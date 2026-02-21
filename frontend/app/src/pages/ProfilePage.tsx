import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Check, Twitter, Globe, MessageCircle, ExternalLink, Github, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

const profileData = {
  handle: 'pepecreator',
  displayName: 'Pepe Creator',
  avatar: '/images/token_01.jpg',
  bio: 'Creating the dankest memes on Avalanche. Diamond hands only.',
  verified: true,
  socials: {
    twitter: '@pepecreator',
    telegram: 't.me/pepecreator',
    website: 'pepecreator.io',
  },
  project: {
    name: 'PepeKing Protocol',
    description: 'A meme-powered DeFi ecosystem on Avalanche.',
    githubRepo: 'https://github.com/pepeking-protocol',
    whitepaper: 'https://docs.pepeking.io',
  },
  stats: {
    totalTokens: 12,
    graduatedTokens: 3,
    totalVolume: '$2.4M',
    totalFees: '12.5 AVAX',
  },
  tokens: [
    { address: '0x1234', name: 'PepeKing', ticker: '$PEPEK', image: '/images/token_02.jpg', mcap: '45.2K', change: '+128%', status: 'Trading' },
    { address: '0x5678', name: 'DogeMax', ticker: '$DMAX', image: '/images/token_01.jpg', mcap: '12.5K', change: '+45%', status: 'Trading' },
    { address: '0x9abc', name: 'MoonWolf', ticker: '$WOLF', image: '/images/token_05.jpg', mcap: '2.1M', change: '+234%', status: 'Graduated' },
  ],
};

export function ProfilePage() {
  const { address } = useParams();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const isOwnProfile = user ? (
    address === user.xHandle || address === user.wallet.address
  ) : false;

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-dim hover:text-white mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />Back to Dashboard
        </Link>

        {/* Profile Header */}
        <div className="surface p-5 mb-5">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
              <img src={profileData.avatar} alt={profileData.displayName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-bold text-white">{profileData.displayName}</h1>
                {profileData.verified && (
                  <Badge className="bg-cre8-red/15 text-cre8-red text-xs">
                    <Check className="w-3 h-3 mr-1" />Verified
                  </Badge>
                )}
              </div>
              <p className="font-mono text-cre8-red text-sm mb-2">@{profileData.handle}</p>
              <p className="text-dim text-sm mb-3">{profileData.bio}</p>

              <div className="flex gap-2">
                {profileData.socials.twitter && (
                  <a href={`https://x.com/${profileData.socials.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                    <Twitter className="w-3.5 h-3.5" />{profileData.socials.twitter}
                  </a>
                )}
                {profileData.socials.telegram && (
                  <a href={`https://${profileData.socials.telegram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" />Telegram
                  </a>
                )}
                {profileData.socials.website && (
                  <a href={`https://${profileData.socials.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                    <Globe className="w-3.5 h-3.5" />Website
                  </a>
                )}
              </div>
            </div>

            {isOwnProfile && (
              <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="border-white/[0.08] text-white hover:bg-white/[0.04] text-sm">
                <Edit className="w-3.5 h-3.5 mr-1.5" />Edit
              </Button>
            )}
          </div>

          {profileData.project && (
            <div className="mt-5 pt-5 border-t border-white/[0.06]">
              <h3 className="text-xs text-dim mb-1.5">Project</h3>
              <p className="font-medium text-white text-sm mb-0.5">{profileData.project.name}</p>
              <p className="text-sm text-dim mb-3">{profileData.project.description}</p>
              <div className="flex gap-2">
                {profileData.project.githubRepo && (
                  <a href={profileData.project.githubRepo} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                    <Github className="w-3.5 h-3.5" />GitHub
                  </a>
                )}
                {profileData.project.whitepaper && (
                  <a href={profileData.project.whitepaper} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] text-xs text-dim hover:text-white hover:bg-white/[0.06] transition-colors">
                    <FileText className="w-3.5 h-3.5" />Docs
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Tokens Launched', value: profileData.stats.totalTokens },
            { label: 'Graduated', value: profileData.stats.graduatedTokens },
            { label: 'Total Volume', value: profileData.stats.totalVolume },
            { label: 'Fees Earned', value: profileData.stats.totalFees, highlight: true },
          ].map((stat) => (
            <div key={stat.label} className="surface p-4 text-center">
              <p className={`font-mono text-xl font-bold ${stat.highlight ? 'text-cre8-red' : 'text-white'}`}>{stat.value}</p>
              <p className="text-xs text-dim mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Creator Earnings */}
        {isOwnProfile && (
          <div className="surface p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-sm mb-0.5">Creator Earnings</h3>
                <p className="text-xs text-dim">0.2% of all trading volume</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-cre8-red">2.5 AVAX</p>
                <p className="text-xs text-dim">available to claim</p>
              </div>
            </div>
            <Button className="mt-4 bg-cre8-red hover:bg-cre8-red/90 text-white font-medium rounded-lg text-sm">
              Claim Earnings
            </Button>
          </div>
        )}

        {/* Tokens */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Launched Tokens</h2>
          <div className="space-y-2">
            {profileData.tokens.map((token) => (
              <Link
                key={token.address}
                to={`/token/${token.ticker}`}
                className="flex items-center gap-3 p-3 surface-interactive"
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <img src={token.image} alt={token.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm">{token.name}</h4>
                  <p className="font-mono text-xs text-dim">{token.ticker}</p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="font-mono text-white text-sm tabular-nums">${token.mcap}</p>
                  <p className="font-mono text-xs text-green-400">{token.change}</p>
                </div>
                <Badge className={`text-xs ${token.status === 'Graduated' ? 'bg-dim/15 text-dim' : 'bg-green-500/15 text-green-400'}`}>
                  {token.status}
                </Badge>
                <ExternalLink className="w-3.5 h-3.5 text-dim shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
