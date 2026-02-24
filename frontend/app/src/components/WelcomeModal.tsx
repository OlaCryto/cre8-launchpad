import { useState, useEffect } from 'react';

const STORAGE_KEY = 'cre8_welcome_seen';

interface WelcomeModalProps {
  onDismiss: () => void;
}

function WelcomeModalContent({ onDismiss }: WelcomeModalProps) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-cre8-surface border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Content */}
        <div className="px-8 pt-8 pb-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-5">How it works</h2>

          <p className="text-sm text-[#b0b0c0] leading-relaxed mb-6">
            Cre8 allows{' '}
            <span className="text-cre8-red font-medium">anyone</span>{' '}
            to create coins. All coins created on Cre8 are{' '}
            <span className="text-cre8-red font-medium">fair-launch</span>,
            meaning everyone has equal access to buy and sell when the coin is
            first created.
          </p>

          <div className="space-y-2 mb-6 text-sm text-[#b0b0c0]">
            <p>
              <span className="font-bold text-white">Step 1:</span>{' '}
              pick a coin that you like
            </p>
            <p>
              <span className="font-bold text-white">Step 2:</span>{' '}
              buy the coin on the bonding curve
            </p>
            <p>
              <span className="font-bold text-white">Step 3:</span>{' '}
              sell at any time to lock in your profits or losses
            </p>
          </div>

          <p className="text-xs text-[#8B8B9E] mb-6 leading-relaxed">
            By clicking this button, you agree to the{' '}
            <a href="/legal/terms" className="text-cre8-red hover:underline">terms of service</a>{' '}
            and certify that you are over 18 years old.
          </p>

          <button
            onClick={onDismiss}
            className="w-full py-3.5 bg-cre8-red hover:bg-cre8-red/90 text-white text-base font-semibold rounded-xl transition-colors"
          >
            I'm ready to pump
          </button>
        </div>

        {/* Footer links */}
        <div className="border-t border-white/[0.06] py-3 text-center">
          <span className="text-xs text-[#8B8B9E]">
            <a href="/legal/privacy" className="hover:text-white transition-colors">Privacy policy</a>
            <span className="text-white/20 mx-1">|</span>
            <a href="/legal/terms" className="hover:text-white transition-colors">Terms of service</a>
            <span className="text-white/20 mx-1">|</span>
            <a href="/legal/fees" className="hover:text-white transition-colors">Fees</a>
          </span>
        </div>
      </div>
    </div>
  );
}

export function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  return <WelcomeModalContent onDismiss={handleDismiss} />;
}
