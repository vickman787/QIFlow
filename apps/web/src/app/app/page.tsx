'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWeb3 } from '@/context/Web3Context';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  TrendingUp,
  ArrowDownUp,
  Wallet,
  AlertTriangle,
  RefreshCw,
  HandCoins,
  Briefcase,
  Globe,
  Zap,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface QieStats {
  mainnet: {
    blockNumber: number | null;
    gasPriceGwei: string | null;
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
  });
}

function useWalletData(address: string | null) {
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

function StatCard({
  label,
  value,
  sub,
  icon,
  live,
  gradient,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  live?: boolean;
  gradient?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 border ${gradient ? 'bg-gradient-to-br from-[#B7791F]/20 to-[#F6C453]/10 border-[#F6C453]/20' : 'bg-[#14110B] border-white/5'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#F6C453]">
          {icon}
        </div>
        {live && (
          <span className="flex items-center gap-1 text-xs text-[#F6C453] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F6C453]" />
            LIVE
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-[#B8B2A6] font-medium uppercase tracking-wider">{label}</div>
      {sub && <div className="text-xs text-[#B8B2A6] mt-0.5">{sub}</div>}
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-[#14110B] border border-white/5 rounded-2xl p-5 hover:border-[#F6C453]/20 transition-all flex items-start gap-4"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#B7791F]/20 to-[#F6C453]/20 flex items-center justify-center text-[#F6C453] flex-shrink-0 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F6C453]/10 text-[#F6C453] font-semibold">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-[#B8B2A6] leading-relaxed">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#B8B2A6] group-hover:text-[#F6C453] transition-colors flex-shrink-0 mt-1" />
    </Link>
  );
}

export default function Dashboard() {
  const { account, isConnected, connect, isConnecting, isCorrectNetwork, switchToQIE } = useWeb3();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useNetworkStats();
  const { data: walletData, refetch: refetchWallet } = useWalletData(account);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const copyValue = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(label);
    toast.success(`Copied: ${value}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const networkFields = [
    { label: 'Network Name', value: 'QIE Mainnet' },
    { label: 'RPC URL', value: 'https://rpc2mainnet.qie.digital' },
    { label: 'Chain ID', value: '1990' },
    { label: 'Symbol', value: 'QIE' },
    { label: 'Block Explorer', value: 'https://mainnet.qie.digital/' },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchStats(), refetchWallet()]);
      toast.success('Dashboard refreshed.');
    } catch {
      toast.error('Failed to refresh dashboard.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-sm text-[#B8B2A6] mt-0.5">QIFlow Protocol — QIE Blockchain</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-[#B8B2A6] hover:text-white hover:bg-white/5 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Network not connected warning */}
      {isConnected && !isCorrectNetwork && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-yellow-400">Wrong Network</p>
              <p className="text-xs text-[#B8B2A6]">
                Please switch to QIE Mainnet (Chain ID: 1990) to use QIFlow.
              </p>
            </div>
          </div>
          <button
            onClick={switchToQIE}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-yellow-500 text-black text-xs font-bold hover:bg-yellow-400 transition-colors"
          >
            Switch Network
          </button>
        </div>
      )}

      {/* Live Network Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[#B8B2A6] uppercase tracking-wider">
            Live Network
          </h2>
          {stats?.mainnet.online && (
            <span className="flex items-center gap-1 text-xs text-[#F6C453]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F6C453]" />
              Online
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Latest Block"
            value={
              stats?.mainnet.blockNumber
                ? `#${stats.mainnet.blockNumber.toLocaleString()}`
                : statsLoading
                  ? '...'
                  : '—'
            }
            sub="QIE Mainnet"
            icon={<Activity className="w-5 h-5" />}
            live={stats?.mainnet.online}
          />
          <StatCard
            label="Gas Price"
            value={stats?.mainnet.gasPriceGwei ? `${stats.mainnet.gasPriceGwei} Gwei` : '—'}
            sub="Current"
            icon={<Zap className="w-5 h-5" />}
          />
          <StatCard
            label="Block Time"
            value="~3.6s"
            sub="Proof of Authority"
            icon={<Globe className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Wallet Section */}
      {isConnected && isCorrectNetwork ? (
        <div>
          <h2 className="text-sm font-semibold text-[#B8B2A6] uppercase tracking-wider mb-3">
            Your Wallet
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard
              label="QIE Balance"
              value={
                walletData?.balanceQIE
                  ? `${parseFloat(walletData.balanceQIE).toFixed(4)} QIE`
                  : '...'
              }
              sub={account ? `${account.slice(0, 8)}...${account.slice(-6)}` : ''}
              icon={<Wallet className="w-5 h-5" />}
              gradient
            />
            <StatCard
              label="Transactions"
              value={walletData?.txCount != null ? walletData.txCount.toString() : '...'}
              sub="Lifetime on QIE"
              icon={<RefreshCw className="w-5 h-5" />}
            />
            <StatCard
              label="Explorer"
              value="View Account"
              sub={`${account?.slice(0, 6)}...${account?.slice(-4)}`}
              icon={<ArrowRight className="w-5 h-5" />}
            />
          </div>
        </div>
      ) : !isConnected ? (
        <div className="bg-[#14110B] border border-white/5 rounded-2xl p-8 text-center">
          <Wallet className="w-12 h-12 mx-auto text-[#B7791F] mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Connect Your Wallet</h3>
          <p className="text-[#B8B2A6] text-sm mb-6 max-w-sm mx-auto">
            Connect MetaMask with QIE Mainnet to view your balances and start lending or borrowing.
          </p>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white font-bold hover:opacity-90 transition-all disabled:opacity-60"
          >
            <Wallet className="w-5 h-5" />
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </div>
      ) : null}

      {/* Protocol Actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#B8B2A6] uppercase tracking-wider mb-3">
          Protocol
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <ActionCard
            href="/app/lend"
            icon={<HandCoins className="w-6 h-6" />}
            title="Lend / Supply"
            desc="Supply your QIE or supported tokens to earn real yield from borrowers."
            badge="Earn"
          />
          <ActionCard
            href="/app/borrow"
            icon={<ArrowDownUp className="w-6 h-6" />}
            title="Borrow"
            desc="Unlock liquidity by borrowing against your supplied collateral at protocol rates."
            badge="Leverage"
          />
          <ActionCard
            href="/app/portfolio"
            icon={<Briefcase className="w-6 h-6" />}
            title="Portfolio"
            desc="View all your open positions, health factor, and claimable rewards."
          />
          <ActionCard
            href="https://docs.qie.digital/"
            icon={<TrendingUp className="w-6 h-6" />}
            title="QIE Docs"
            desc="Learn about the QIE Blockchain, its architecture, and developer resources."
          />
        </div>
      </div>

      {/* Add Network Instructions */}
      <div className="bg-[#14110B] border border-[#B7791F]/20 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">📌 Add QIE Mainnet to MetaMask</h3>
        <div className="space-y-2">
          {networkFields.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 bg-[#0B0A07] rounded-xl px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-[#B8B2A6] font-semibold uppercase tracking-wider mb-0.5">
                  {label}
                </p>
                <p className="text-sm text-white font-mono break-all leading-snug">{value}</p>
              </div>
              <button
                onClick={() => copyValue(label, value)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-[#F6C453]/10 text-[#B8B2A6] hover:text-[#F6C453] transition-all"
                title={`Copy ${label}`}
              >
                {copiedKey === label ? (
                  <Check className="w-3.5 h-3.5 text-[#00E676]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
