import { useEffect, useState, useRef } from 'react';

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Show the GIF animation for 2.8s then fade out
    const timer = setTimeout(() => {
      setFadeOut(true);
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!fadeOut) return;
    // After fade-out transition completes, signal done
    const timer = setTimeout(onComplete, 500);
    return () => clearTimeout(timer);
  }, [fadeOut, onComplete]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-cre8-base transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated Logo GIF */}
      <div className="relative">
        <img
          src="/logo-animation.gif"
          alt="Cre8"
          className="w-48 h-48 md:w-64 md:h-64 object-contain mix-blend-lighten"
        />
        {/* Subtle glow behind the GIF */}
        <div
          className="absolute inset-0 -z-10 scale-150 blur-3xl opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(232, 65, 66, 0.5) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Tagline */}
      <div className="absolute bottom-12 text-center">
        <p className="text-dim text-sm">
          Launch. Trade. Moon.
        </p>
      </div>
    </div>
  );
}
