import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Rocket, TrendingUp, Trophy, Zap, Lock } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { 
    number: '01', 
    title: 'Launch', 
    description: 'Start with minimal cost. Price begins low and fair for everyone.',
    icon: Rocket
  },
  { 
    number: '02', 
    title: 'Trade', 
    description: 'Buy and sell along the curve. Price rises with demand.',
    icon: TrendingUp
  },
  { 
    number: '03', 
    title: 'Graduate', 
    description: 'At 69,000 AVAX market cap, liquidity automatically moves to Trader Joe.',
    icon: Trophy
  },
];

const modes = [
  {
    name: 'Trenches Mode',
    icon: Zap,
    color: '#F59E0B',
    features: [
      'Launch in seconds',
      'No registration needed',
      'Pure bonding curve',
      'Instant trading',
    ],
  },
  {
    name: 'Forge Mode',
    icon: Rocket,
    color: '#E84142',
    features: [
      'Optional presale',
      'Whitelist window',
      'Team vesting',
      'Creator profile',
    ],
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const modesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const stepCards = stepsRef.current?.querySelectorAll('.step-card');
      if (stepCards) {
        gsap.fromTo(stepCards,
          { y: 50, opacity: 0 },
          {
            y: 0, opacity: 1,
            stagger: 0.15,
            scrollTrigger: {
              trigger: stepsRef.current,
              start: 'top 80%',
              end: 'top 50%',
              scrub: 0.5
            }
          }
        );
      }

      const modeCards = modesRef.current?.querySelectorAll('.mode-card');
      if (modeCards) {
        gsap.fromTo(modeCards,
          { y: 50, opacity: 0 },
          {
            y: 0, opacity: 1,
            stagger: 0.15,
            scrollTrigger: {
              trigger: modesRef.current,
              start: 'top 85%',
              end: 'top 55%',
              scrub: 0.5
            }
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-20 bg-[#0D0D12]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* How It Works Steps */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">How It Works</h2>
          <p className="text-[#8B8B9E]">The fairest launch mechanism in crypto</p>
        </div>

        <div ref={stepsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {steps.map((step, i) => (
            <div key={i} className="step-card bg-[#050508] border border-white/[0.06] rounded-2xl p-6 text-center relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-12 h-12 rounded-xl bg-[#E84142] flex items-center justify-center">
                  <step.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="pt-8">
                <span className="font-mono text-4xl font-bold text-white/10">{step.number}</span>
                <h3 className="text-xl font-bold text-white mt-2 mb-3">{step.title}</h3>
                <p className="text-sm text-[#8B8B9E]">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Dual Mode Comparison */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Choose Your Mode</h2>
          <p className="text-[#8B8B9E]">Two ways to launch. Same fair mechanics.</p>
        </div>

        <div ref={modesRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modes.map((mode, i) => (
            <div key={i} className="mode-card bg-[#050508] border border-white/[0.06] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${mode.color}20` }}>
                  <mode.icon className="w-6 h-6" style={{ color: mode.color }} />
                </div>
                <h3 className="text-xl font-bold text-white">{mode.name}</h3>
              </div>
              <ul className="space-y-3">
                {mode.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2 text-[#8B8B9E]">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: mode.color }} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Token Economics */}
        <div className="mt-16 bg-[#050508] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-[#E84142]" />
            <h3 className="text-lg font-bold text-white">Token Economics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-[#8B8B9E] mb-1">Total Supply</p>
              <p className="font-mono font-bold text-white">1,000,000,000</p>
            </div>
            <div>
              <p className="text-xs text-[#8B8B9E] mb-1">Curve Supply</p>
              <p className="font-mono font-bold text-white">800,000,000 <span className="text-[#8B8B9E] text-xs">(80%)</span></p>
            </div>
            <div>
              <p className="text-xs text-[#8B8B9E] mb-1">Liquidity Reserve</p>
              <p className="font-mono font-bold text-white">200,000,000 <span className="text-[#8B8B9E] text-xs">(20%)</span></p>
            </div>
            <div>
              <p className="text-xs text-[#8B8B9E] mb-1">Graduation Target</p>
              <p className="font-mono font-bold text-[#E84142]">69,000 AVAX</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
