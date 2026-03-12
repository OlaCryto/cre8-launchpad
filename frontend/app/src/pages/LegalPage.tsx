import { useParams, Link } from 'react-router-dom';

const PAGES: Record<string, { title: string; content: string[] }> = {
  terms: {
    title: 'Terms of Service',
    content: [
      'Last updated: February 24, 2026',
      '1. Acceptance of Terms — By accessing or using the Cre8 platform ("Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.',
      '2. Eligibility — You must be at least 18 years old and legally able to enter binding contracts to use the Platform. You are responsible for compliance with local laws.',
      '3. Platform Description — Cre8 is a decentralized token launchpad on the Avalanche C-Chain. It enables users to create ERC-20 tokens with bonding curve pricing and automatic DEX graduation. Cre8 does not custody funds, hold private keys, or control smart contracts after deployment.',
      '4. Account & Wallet — When you sign in, a non-custodial wallet is generated client-side. Your private key is stored encrypted in your browser. Cre8 cannot recover lost private keys. You are solely responsible for securing your credentials.',
      '5. Token Creation — Tokens created on Cre8 are deployed as smart contracts on the Avalanche blockchain. Once deployed, token parameters (name, symbol, supply) cannot be changed. You are solely responsible for any tokens you create.',
      '6. Trading — All trades are executed on-chain via bonding curve smart contracts. Prices are determined algorithmically. A 1% fee is applied to all trades (0.8% platform, 0.2% creator). Trades are irreversible once confirmed on-chain.',
      '7. Graduation — When a token reaches the graduation threshold (420 AVAX market cap), liquidity is automatically migrated to TraderJoe DEX and LP tokens are locked for 1 year.',
      '8. Risks — Cryptocurrency trading involves substantial risk of loss. Token prices can drop to zero. Past performance does not guarantee future results. You should only trade with funds you can afford to lose.',
      '9. No Investment Advice — Nothing on the Platform constitutes financial, investment, legal, or tax advice. Cre8 does not endorse any token created on the Platform.',
      '10. Prohibited Conduct — You agree not to: (a) create tokens that infringe intellectual property, (b) manipulate markets, (c) use bots to circumvent anti-bot protections, (d) use the Platform for money laundering or fraud, (e) attempt to exploit smart contract vulnerabilities.',
      '11. Limitation of Liability — Cre8 is provided "as is" without warranties. To the maximum extent permitted by law, Cre8 shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.',
      '12. Modifications — We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance.',
      '13. Governing Law — These Terms shall be governed by and construed in accordance with applicable laws.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    content: [
      'Last updated: February 24, 2026',
      '1. Information We Collect — When you sign in with Google, we receive your public profile information (display name, handle, avatar). We generate a wallet address for your account. We do not collect email addresses, phone numbers, or government IDs.',
      '2. Wallet & Keys — Your private key is generated client-side and stored encrypted in your browser\'s localStorage. Private keys are never transmitted to or stored on Cre8 servers.',
      '3. On-Chain Data — All transactions (token creation, buys, sells) are recorded on the Avalanche blockchain, which is publicly accessible. Cre8 does not control or own this data.',
      '4. Usage Data — We may collect anonymous usage metrics (page views, feature usage) to improve the Platform. We do not use tracking cookies or third-party analytics.',
      '5. Data Sharing — We do not sell, rent, or share your personal information with third parties for marketing purposes.',
      '6. Data Retention — Your X profile data is stored in session only and cleared on sign-out. On-chain data is permanent and cannot be deleted.',
      '7. Security — We implement industry-standard security measures. However, no system is 100% secure. You are responsible for securing your browser and device.',
      '8. Your Rights — You may disconnect your X account and clear your browser data at any time. Due to the decentralized nature of blockchain, on-chain transactions cannot be reversed or deleted.',
      '9. Changes — We may update this Privacy Policy from time to time. We will notify users of material changes.',
    ],
  },
  fees: {
    title: 'Fees',
    content: [
      'Last updated: February 24, 2026',
      'Token Creation Fee — A flat fee of 0.02 AVAX is charged to create a new token on the Platform. This covers the gas cost of deploying the token and bonding curve smart contracts.',
      'Trading Fee — A 1% fee is applied to all buy and sell transactions on the bonding curve. This fee is split as follows: 0.8% goes to the Cre8 platform treasury, and 0.2% goes to the token creator as a reward.',
      'Graduation — When a token graduates to TraderJoe DEX, the remaining AVAX in the bonding curve is used to create a liquidity pool. No additional fee is charged for graduation.',
      'Gas Fees — All transactions on the Avalanche C-Chain require gas fees paid in AVAX. These fees go to Avalanche validators, not to Cre8. Gas fees on Avalanche are typically very low (< $0.01).',
      'No Hidden Fees — There are no deposit fees, withdrawal fees, listing fees, or subscription fees. The only fees are those described above.',
      'Fee Changes — Cre8 reserves the right to adjust fee structures. Any changes will be announced in advance and reflected in the smart contracts.',
    ],
  },
};

export function LegalPage() {
  const { page } = useParams<{ page: string }>();
  const data = PAGES[page || ''];

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-3">Page not found</h1>
          <Link to="/" className="text-sm text-cre8-red hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[680px] mx-auto px-4 py-8">
        <Link to="/" className="text-xs text-dim hover:text-white mb-4 inline-block">&larr; Back</Link>
        <h1 className="text-2xl font-bold text-white mb-6">{data.title}</h1>
        <div className="space-y-4">
          {data.content.map((paragraph, i) => (
            <p key={i} className={`text-sm leading-relaxed ${i === 0 ? 'text-dim' : 'text-white/70'}`}>{paragraph}</p>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-dim">
          &copy; Cre8 {new Date().getFullYear()}. All rights reserved.
        </div>
      </div>
    </div>
  );
}
