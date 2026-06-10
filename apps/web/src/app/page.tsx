'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  Layers,
  ChevronRight,
  Activity,
  Globe,
  Lock,
  Coins,
} from 'lucide-react';

interface QieStats {
  mainnet: {
    blockNumber: number | null;
    gasPriceGwei: string | null;
    chainId: number;
    online: boolean;
    blockTime: number;
  };
}

function useNetworkStats() {
  return useQuery<QieStats>({
    queryKey: ['qie-stats'],
    queryFn: async () => {
      const res = await fetch('/api/qie/stats');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

function StatPulse({ online }: { online: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {online && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F6C453] opacity-75" />
      )}
      <span
        className={`relative inline-flex rounded-full h-2 w-2 ${online ? 'bg-[#F6C453]' : 'bg-red-500'}`}
      />
    </span>
  );
}

export default function QIFlowLanding() {
  const { data: stats } = useNetworkStats();
  const [blockTick, setBlockTick] = useState(0);

  useEffect(() => {
    if (stats?.mainnet?.blockNumber) {
      setBlockTick(stats.mainnet.blockNumber);
    }
  }, [stats?.mainnet?.blockNumber]);

  const features = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: 'Earn Real Yield',
      desc: 'Supply assets to liquidity pools and earn competitive APY paid in real QIE, not printed tokens.',
      color: '#F6C453',
    },
    {
      icon: <Layers className="w-6 h-6" />,
      title: 'Borrow Instantly',
      desc: 'Unlock liquidity against your collateral in seconds. No credit checks, no paperwork.',
      color: '#B7791F',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Non-Custodial Security',
      desc: 'Smart contract-enforced rules. Your funds are controlled by code, not by us.',
      color: '#F6C453',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: '3.6s Block Finality',
      desc: "QIE's Proof-of-Authority consensus delivers near-instant settlement with near-zero gas.",
      color: '#B7791F',
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Connect Wallet',
      desc: 'Add QIE Mainnet to MetaMask and connect in one click.',
    },
    {
      num: '02',
      title: 'Supply Assets',
      desc: 'Deposit QIE or supported tokens to start earning interest immediately.',
    },
    {
      num: '03',
      title: 'Borrow or Earn',
      desc: 'Use your supplied collateral to borrow, or just sit back and earn yield.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/qiflow-logo-gold.svg"
              alt="QIFlow Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-[#F6C453]/20"
            />
            <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#F6C453] to-[#B7791F]">
              QIFlow
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live network indicator */}
            {stats && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14110B] border border-white/10 text-xs text-[#B8B2A6]">
                <StatPulse online={stats.mainnet.online} />
                <span>Block #{blockTick?.toLocaleString()}</span>
              </div>
            )}
            <Link
              href="/app"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-[#B7791F]/30"
            >
              Launch App <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-32 px-4 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#B7791F]/20 rounded-full blur-[120px]" />
          <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-[#F6C453]/10 rounded-full blur-[80px]" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F6C453]/20 bg-[#F6C453]/5 text-[#F6C453] text-xs font-semibold uppercase tracking-wider mb-8">
            <Zap className="w-3 h-3" />
            Built on QIE Blockchain · EVM Compatible · Chain ID: 1990
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Flow Into{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#F6C453] via-[#B7791F] to-[#F6C453]">
              Decentralized
            </span>
            <br />
            Finance
          </h1>

          <p className="text-[#B8B2A6] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            QIFlow is the premier lending protocol on QIE Blockchain — supply assets to earn yield
            or borrow against your collateral at transparent, algorithm-driven rates.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
              className="flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white text-lg font-bold hover:opacity-90 transition-all shadow-lg shadow-[#B7791F]/30 w-full sm:w-auto justify-center"
            >
              Launch App <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://docs.qie.digital/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 bg-white/5 text-white text-lg font-bold hover:bg-white/10 transition-all w-full sm:w-auto justify-center"
            >
              Read Docs <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Live Network Stats */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Network',
                value: stats?.mainnet.online ? 'Online' : 'Connecting...',
                sub: 'QIE Mainnet',
                icon: <Globe className="w-4 h-4 text-[#F6C453]" />,
                live: true,
              },
              {
                label: 'Latest Block',
                value: stats?.mainnet.blockNumber
                  ? `#${stats.mainnet.blockNumber.toLocaleString()}`
                  : '—',
                sub: 'Chain ID: 1990',
                icon: <Activity className="w-4 h-4 text-[#B7791F]" />,
                live: true,
              },
              {
                label: 'Gas Price',
                value: stats?.mainnet.gasPriceGwei ? `${stats.mainnet.gasPriceGwei} Gwei` : '—',
                sub: 'Current',
                icon: <Zap className="w-4 h-4 text-[#F6C453]" />,
                live: false,
              },
              {
                label: 'Block Time',
                value: '~3.6s',
                sub: 'Proof of Authority',
                icon: <Lock className="w-4 h-4 text-[#B7791F]" />,
                live: false,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-[#14110B] border border-white/5 rounded-2xl p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#B8B2A6] font-medium">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    {item.live && stats?.mainnet.online && <StatPulse online />}
                    {item.icon}
                  </div>
                </div>
                <div className="text-lg font-bold text-white">{item.value}</div>
                <div className="text-xs text-[#B8B2A6]">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Why QIFlow?</h2>
            <p className="text-[#B8B2A6] max-w-xl mx-auto">
              Designed from the ground up for the QIE ecosystem — fast, secure, and transparent.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-[#14110B] border border-white/5 rounded-2xl p-6 hover:border-[#F6C453]/20 transition-all"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${f.color}20`, color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-[#B8B2A6] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Get Started in Minutes</h2>
            <p className="text-[#B8B2A6] max-w-xl mx-auto">
              Connect your wallet, supply assets, and start earning in three simple steps.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#F6C453]/30 to-transparent" />
            {steps.map((s, i) => (
              <div key={s.num} className="relative text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#B7791F]/30 to-[#F6C453]/30 border border-[#F6C453]/20 flex items-center justify-center text-2xl font-black text-[#F6C453] mb-4">
                  {s.num}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-[#B8B2A6] text-sm leading-relaxed">{s.desc}</p>
                {i < 2 && (
                  <ChevronRight className="hidden md:block absolute top-4 -right-3 w-6 h-6 text-[#F6C453]/40" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Add Network CTA */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl border border-[#F6C453]/20 bg-gradient-to-br from-[#14110B] to-[#0B0A07] p-8 md:p-12 text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#B7791F]/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="relative">
              <Coins className="w-12 h-12 mx-auto mb-4 text-[#F6C453]" />
              <h2 className="text-3xl md:text-4xl font-black mb-3">Ready to Flow?</h2>
              <p className="text-[#B8B2A6] mb-8 max-w-lg mx-auto">
                Add QIE Mainnet to your MetaMask and start lending in under 60 seconds.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/app"
                  className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-[#B7791F]/30"
                >
                  Launch QIFlow App
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* X/Twitter Banner Showcase */}
      <section className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-center text-[#B8B2A6] mb-4 uppercase tracking-wider font-semibold">
            Official QIFlow Banner
          </p>
          <div className="rounded-2xl overflow-hidden border border-white/5 shadow-2xl shadow-[#B7791F]/10">
            <img
              src="/qiflow-banner-solar-gold.png"
              alt="QIFlow Protocol Banner"
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-white/5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[#B8B2A6] text-sm">
          <div className="flex items-center gap-2">
            <img
              src="/qiflow-logo-gold.svg"
              alt="QIFlow"
              className="w-7 h-7 rounded-lg object-cover"
            />
            <span>© 2026 QIFlow Protocol — Built on QIE Blockchain</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://www.qie.digital/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              QIE Network
            </a>
            <a
              href="https://docs.qie.digital/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Docs
            </a>
            <a
              href="https://mainnet.qie.digital/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Explorer
            </a>
            <a
              href="https://reddit.com/r/QIEBlockchain"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Reddit
            </a>
            <a
              href="https://github.com/vickman787/QIFlow"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
