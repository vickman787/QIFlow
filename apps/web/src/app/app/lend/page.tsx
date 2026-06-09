'use client';

import React, { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { useQuery } from '@tanstack/react-query';
import { Wallet, ArrowRight, Info, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

const MARKETS = [
  {
    symbol: 'QIE',
    name: 'QIE (Native)',
    icon: '⚡',
    color: '#00D4FF',
    description: 'The native token of QIE Blockchain',
    status: 'live',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '💵',
    color: '#2775CA',
    description: 'Stablecoin pegged to the US Dollar',
    status: 'launching',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    icon: '₿',
    color: '#F7931A',
    description: 'Bitcoin, wrapped for QIE Blockchain',
    status: 'launching',
  },
];

function useWalletBalance(address: string | null) {
  return useQuery({
    queryKey: ['wallet-balance', address],
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`/api/qie/balance?address=${address}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!address,
    refetchInterval: 30000,
  });
}

function MarketRow({
  market,
  qieBalance,
}: {
  market: (typeof MARKETS)[0];
  qieBalance?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const isLive = market.status === 'live';

  return (
    <div
      className={`rounded-2xl border transition-all ${open ? 'border-[#00D4FF]/30' : 'border-white/5'} bg-[#131B3D] overflow-hidden`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/2 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${market.color}20` }}
        >
          {market.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{market.symbol}</span>
            {!isLive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-semibold">
                Coming Soon
              </span>
            )}
          </div>
          <span className="text-xs text-[#8B9CC8]">{market.name}</span>
        </div>

        <div className="hidden sm:grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-xs text-[#8B9CC8] mb-1">Supply APY</div>
            <div className="text-sm font-bold text-[#8B9CC8]">—</div>
          </div>
          <div>
            <div className="text-xs text-[#8B9CC8] mb-1">Collateral</div>
            <div className="text-sm font-bold text-[#8B9CC8]">—</div>
          </div>
          <div>
            <div className="text-xs text-[#8B9CC8] mb-1">Liquidity</div>
            <div className="text-sm font-bold text-[#8B9CC8]">—</div>
          </div>
        </div>

        <div className="text-[#8B9CC8] ml-2">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          <div className="pt-4 grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[#8B9CC8] uppercase tracking-wider">
                Market Info
              </h4>
              {[
                { label: 'Asset', value: market.name },
                { label: 'Symbol', value: market.symbol },
                { label: 'Collateral Factor', value: '— (set by contract)' },
                { label: 'Supply APY', value: '— (set by contract)' },
                { label: 'Description', value: market.description },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-[#8B9CC8]">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[#8B9CC8] uppercase tracking-wider">
                Your Wallet
              </h4>
              {market.symbol === 'QIE' ? (
                <div className="bg-[#0D1535] rounded-xl p-4">
                  <p className="text-xs text-[#8B9CC8] mb-1">Available to Supply</p>
                  <p className="text-lg font-bold text-[#00D4FF]">
                    {qieBalance ? `${parseFloat(qieBalance).toFixed(4)} QIE` : '—'}
                  </p>
                </div>
              ) : (
                <div className="bg-[#0D1535] rounded-xl p-4 text-center">
                  <p className="text-xs text-[#8B9CC8]">Market launching soon</p>
                </div>
              )}

              {isLive ? (
                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7B2FBE] to-[#00D4FF] text-white font-bold text-sm hover:opacity-90 transition-all">
                  Supply {market.symbol}
                  <span className="text-xs ml-1 opacity-70">(Contracts deploying soon)</span>
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[#8B9CC8] font-bold text-sm cursor-not-allowed"
                >
                  Market Launching Soon
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LendPage() {
  const { account, isConnected, connect, isConnecting } = useWeb3();
  const { data: walletData } = useWalletBalance(account);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Lend</h1>
        <p className="text-sm text-[#8B9CC8] mt-0.5">Supply assets to earn yield from borrowers</p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#00D4FF]/5 border border-[#00D4FF]/15">
        <Info className="w-5 h-5 text-[#00D4FF] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-white font-semibold mb-1">How Lending Works</p>
          <p className="text-[#8B9CC8] text-xs leading-relaxed">
            Supply your assets to the QIFlow liquidity pool. You'll receive qTokens as proof of your
            deposit. Interest accrues every block (~3.6s) and you can withdraw at any time. Your
            supplied assets can also serve as collateral to borrow other assets.
          </p>
        </div>
      </div>

      {/* Wallet Summary */}
      {isConnected && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#8B9CC8] mb-1">QIE Balance</p>
            <p className="text-lg font-bold text-white">
              {walletData?.balanceQIE ? `${parseFloat(walletData.balanceQIE).toFixed(4)}` : '—'}{' '}
              <span className="text-sm text-[#8B9CC8]">QIE</span>
            </p>
          </div>
          <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#8B9CC8] mb-1">Total Supplied</p>
            <p className="text-lg font-bold text-[#8B9CC8]">—</p>
            <p className="text-xs text-[#8B9CC8]">Connect contracts</p>
          </div>
          <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#8B9CC8] mb-1">Net APY</p>
            <p className="text-lg font-bold text-[#00E676]">—</p>
            <p className="text-xs text-[#8B9CC8]">Across all markets</p>
          </div>
        </div>
      )}

      {/* Markets */}
      <div>
        <h2 className="text-sm font-semibold text-[#8B9CC8] uppercase tracking-wider mb-3">
          Available Markets
        </h2>
        <div className="space-y-3">
          {MARKETS.map((m) => (
            <MarketRow key={m.symbol} market={m} qieBalance={walletData?.balanceQIE} />
          ))}
        </div>
      </div>

      {/* Connect Prompt */}
      {!isConnected && (
        <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-8 text-center">
          <Wallet className="w-10 h-10 mx-auto text-[#7B2FBE] mb-3" />
          <h3 className="text-base font-bold text-white mb-2">Connect to Start Lending</h3>
          <p className="text-[#8B9CC8] text-sm mb-5 max-w-xs mx-auto">
            Connect your MetaMask wallet with QIE Mainnet to supply assets and earn yield.
          </p>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#7B2FBE] to-[#00D4FF] text-white font-bold text-sm hover:opacity-90 transition-all"
          >
            <Wallet className="w-4 h-4" />
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </div>
      )}

      {/* Links to QIE Resources */}
      <div className="flex items-center gap-3 pt-2">
        <a
          href="https://mainnet.qie.digital/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#8B9CC8] hover:text-[#00D4FF] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          QIE Explorer
        </a>
        <span className="text-[#8B9CC8]">·</span>
        <a
          href="https://docs.qie.digital/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#8B9CC8] hover:text-[#00D4FF] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          QIE Docs
        </a>
        <span className="text-[#8B9CC8]">·</span>
        <Link
          href="/app/borrow"
          className="flex items-center gap-1.5 text-xs text-[#8B9CC8] hover:text-[#00D4FF] transition-colors"
        >
          Go to Borrow <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
