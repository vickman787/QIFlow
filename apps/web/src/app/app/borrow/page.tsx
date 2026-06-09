'use client';

import React, { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Wallet,
  Info,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';

const BORROW_MARKETS = [
  {
    symbol: 'QIE',
    name: 'QIE (Native)',
    icon: '⚡',
    color: '#00D4FF',
    minCollateralFactor: 75,
    liquidationThreshold: 80,
    status: 'live',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '💵',
    color: '#2775CA',
    minCollateralFactor: 80,
    liquidationThreshold: 85,
    status: 'launching',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    icon: '₿',
    color: '#F7931A',
    minCollateralFactor: 70,
    liquidationThreshold: 75,
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

function HealthBar({ value }: { value: number | null }) {
  const pct = value !== null ? Math.min(100, Math.max(0, (value / 3) * 100)) : 0;
  const color = !value ? '#8B9CC8' : value > 1.5 ? '#00E676' : value > 1.1 ? '#FFB74D' : '#FF5252';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#8B9CC8]">Health Factor</span>
        <span className="text-sm font-bold" style={{ color }}>
          {value ? value.toFixed(2) : '—'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#0D1535] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[#8B9CC8] mt-1">
        <span>Liquidation</span>
        <span>Safe</span>
      </div>
    </div>
  );
}

function BorrowMarketRow({ market }: { market: (typeof BORROW_MARKETS)[0] }) {
  const [open, setOpen] = useState(false);
  const isLive = market.status === 'live';

  return (
    <div
      className={`rounded-2xl border transition-all ${open ? 'border-[#7B2FBE]/30' : 'border-white/5'} bg-[#131B3D] overflow-hidden`}
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
            <div className="text-xs text-[#8B9CC8] mb-1">Borrow APY</div>
            <div className="text-sm font-bold text-[#FFB74D]">{isLive ? '—' : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-[#8B9CC8] mb-1">Liq. Threshold</div>
            <div className="text-sm font-bold text-white">{market.liquidationThreshold}%</div>
          </div>
          <div>
            <div className="text-xs text-[#8B9CC8] mb-1">Available</div>
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
                Borrow Details
              </h4>
              {[
                { label: 'Min Collateral Factor', value: `${market.minCollateralFactor}%` },
                { label: 'Liquidation Threshold', value: `${market.liquidationThreshold}%` },
                { label: 'Liquidation Penalty', value: '10%' },
                { label: 'Interest Rate Model', value: 'Jump Rate Model' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-[#8B9CC8]">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}

              <div className="mt-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15 flex gap-2">
                <ShieldAlert className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  If health factor drops below 1.0, your collateral will be partially liquidated.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[#8B9CC8] uppercase tracking-wider">
                Borrow {market.symbol}
              </h4>
              <div className="bg-[#0D1535] rounded-xl p-4">
                <p className="text-xs text-[#8B9CC8] mb-1">Borrow Limit</p>
                <p className="text-lg font-bold text-[#8B9CC8]">—</p>
                <p className="text-xs text-[#8B9CC8] mt-1">
                  Supply assets first to create borrow limit
                </p>
              </div>

              {isLive ? (
                <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7B2FBE] to-[#00D4FF] text-white font-bold text-sm hover:opacity-90 transition-all">
                  Borrow {market.symbol}
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

export default function BorrowPage() {
  const { account, isConnected, connect, isConnecting } = useWeb3();
  const { data: _walletData } = useWalletBalance(account);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Borrow</h1>
        <p className="text-sm text-[#8B9CC8] mt-0.5">Borrow against your supplied collateral</p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#7B2FBE]/5 border border-[#7B2FBE]/15">
        <Info className="w-5 h-5 text-[#7B2FBE] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-white font-semibold mb-1">How Borrowing Works</p>
          <p className="text-[#8B9CC8] text-xs leading-relaxed">
            Supply assets as collateral, then borrow up to your collateral factor limit. Interest
            accrues per block on QIE. Keep your health factor above 1.0 to avoid liquidation. Repay
            any time to restore your borrow limit.
          </p>
        </div>
      </div>

      {/* Borrow Limits Summary */}
      {isConnected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#8B9CC8] mb-1">Borrow Limit</p>
            <p className="text-lg font-bold text-white">—</p>
          </div>
          <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#8B9CC8] mb-1">Used</p>
            <p className="text-lg font-bold text-white">—</p>
          </div>
          <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#8B9CC8] mb-1">Available</p>
            <p className="text-lg font-bold text-[#00D4FF]">—</p>
          </div>
          <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-4">
            <HealthBar value={null} />
          </div>
        </div>
      )}

      {/* Liquidation Warning */}
      {isConnected && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/15">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="text-red-400 font-semibold mb-1">Liquidation Risk</p>
            <p className="text-[#8B9CC8] leading-relaxed">
              Your positions are liquidated automatically if your health factor drops below 1.0.
              Market volatility and accrued interest can lower your health factor. Always maintain a
              buffer above the liquidation threshold.
            </p>
          </div>
        </div>
      )}

      {/* Markets */}
      <div>
        <h2 className="text-sm font-semibold text-[#8B9CC8] uppercase tracking-wider mb-3">
          Borrow Markets
        </h2>
        <div className="space-y-3">
          {BORROW_MARKETS.map((m) => (
            <BorrowMarketRow key={m.symbol} market={m} />
          ))}
        </div>
      </div>

      {/* How Health Factor Works */}
      <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Understanding Health Factor</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              range: '> 1.5',
              label: 'Safe',
              color: '#00E676',
              desc: 'Low risk. Comfortable margin above liquidation.',
            },
            {
              range: '1.1 – 1.5',
              label: 'Moderate',
              color: '#FFB74D',
              desc: 'Consider repaying or adding more collateral.',
            },
            {
              range: '< 1.0',
              label: 'Liquidation',
              color: '#FF5252',
              desc: 'Position is liquidated to protect the protocol.',
            },
          ].map((item) => (
            <div key={item.range} className="bg-[#0D1535] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                <span className="text-sm font-bold text-white">{item.range}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: `${item.color}20`, color: item.color }}
                >
                  {item.label}
                </span>
              </div>
              <p className="text-xs text-[#8B9CC8]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Prompt */}
      {!isConnected && (
        <div className="bg-[#131B3D] border border-white/5 rounded-2xl p-8 text-center">
          <ArrowDownUp className="w-10 h-10 mx-auto text-[#7B2FBE] mb-3" />
          <h3 className="text-base font-bold text-white mb-2">Connect to Borrow</h3>
          <p className="text-[#8B9CC8] text-sm mb-5 max-w-xs mx-auto">
            Connect your wallet to view borrow limits and access liquidity.
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

      {/* External Links */}
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
      </div>
    </div>
  );
}
