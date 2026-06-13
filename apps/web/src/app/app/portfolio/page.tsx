'use client';

import React, { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { useQuery } from '@tanstack/react-query';
import { QIFLOW_CONTRACTS } from '@/lib/qiflow-contracts';
import {
  Briefcase,
  Wallet,
  ExternalLink,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const WITHDRAW_NATIVE_SELECTOR = '0x84276d81';
const REPAY_NATIVE_SELECTOR = '0xedba8209';
const CLAIM_REWARDS_SELECTOR = '0x372500ab';
const WEI_PER_QIE = 1_000_000_000_000_000_000n;
const QIE_TOKEN_LOGO = '/qie-token-logo.png';
const MAX_UINT256 = (1n << 256n) - 1n;

function parseQieToWei(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,18})?$/.test(trimmed)) {
    throw new Error('Enter a valid QIE amount.');
  }

  const [wholePart, fractionPart = ''] = trimmed.split('.');
  const whole = BigInt(wholePart || '0') * WEI_PER_QIE;
  const fraction = BigInt(fractionPart.padEnd(18, '0') || '0');
  const wei = whole + fraction;

  if (wei <= 0n) throw new Error('Amount must be greater than 0.');
  return wei;
}

function encodeUint256(value: bigint) {
  return value.toString(16).padStart(64, '0');
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

interface ProtocolData {
  qie: {
    collateralFactorPct: number;
    supplyAPYPct: number;
    borrowAPYPct: number;
    liquidityQIE: string;
    userSupplyQIE: string;
    userBorrowQIE: string;
    pendingRewardsQIF: string;
    claimedRewardsQIF: string;
  };
}

function useProtocolData(address: string | null) {
  return useQuery<ProtocolData>({
    queryKey: ['qiflow-protocol', address],
    queryFn: async () => {
      const query = address ? `?address=${address}` : '';
      const res = await fetch(`/api/qie/protocol${query}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30000,
  });
}

function EmptyPositions({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="bg-[#0B0A07] rounded-xl p-6 text-center">
      <p className="text-sm font-medium text-[#B8B2A6] mb-1">{title}</p>
      <p className="text-xs text-[#B8B2A6]/60">{subtitle}</p>
    </div>
  );
}

function QieAssetIcon() {
  return <img src={QIE_TOKEN_LOGO} alt="QIE" className="h-8 w-8 object-contain" />;
}

function formatQie(value?: string | null, decimals = 4) {
  if (!value) return '-';
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return '-';
  if (amount > 0 && amount < 10 ** -decimals) {
    return `< 0.${'0'.repeat(Math.max(0, decimals - 1))}1`;
  }
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function getBufferedRepayAmount(value?: string | null) {
  const amount = Number.parseFloat(value ?? '0');
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return (amount + 0.0001).toFixed(8).replace(/\.?0+$/, '');
}

export default function PortfolioPage() {
  const {
    account,
    chainId,
    isConnected,
    connect,
    isConnecting,
    isCorrectNetwork,
    qieBalance,
    switchToQIE,
  } = useWeb3();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRepaying, setIsRepaying] = useState(false);
  const [isClaimingRewards, setIsClaimingRewards] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: walletData, refetch } = useWalletData(account);
  const { data: protocolData, refetch: refetchProtocol } = useProtocolData(account);

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      toast.success('Address copied!');
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">Portfolio</h1>
          <p className="text-sm text-[#B8B2A6] mt-0.5">Your positions, balances, and rewards</p>
        </div>
        <div className="bg-[#14110B] border border-white/5 rounded-2xl p-12 text-center">
          <Briefcase className="w-12 h-12 mx-auto text-[#B7791F] mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">Connect to View Portfolio</h3>
          <p className="text-[#B8B2A6] text-sm mb-6 max-w-xs mx-auto">
            Connect your MetaMask wallet to see your QIFlow positions, balances, and accumulated
            rewards.
          </p>
          <button
            onClick={connect}
            disabled={isConnecting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white font-bold text-sm hover:opacity-90 transition-all"
          >
            <Wallet className="w-4 h-4" />
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  const shortAddress = account ? `${account.slice(0, 8)}...${account.slice(-6)}` : '';
  const networkName = chainId === 1990 ? 'QIE Mainnet' : `Chain ${chainId}`;
  const suppliedQie = Number.parseFloat(protocolData?.qie.userSupplyQIE ?? '0');
  const hasSuppliedQie = Number.isFinite(suppliedQie) && suppliedQie > 0;
  const borrowedQie = Number.parseFloat(protocolData?.qie.userBorrowQIE ?? '0');
  const hasBorrowedQie = Number.isFinite(borrowedQie) && borrowedQie > 0;
  const pendingRewards = Number.parseFloat(protocolData?.qie.pendingRewardsQIF ?? '0');
  const hasPendingRewards = Number.isFinite(pendingRewards) && pendingRewards > 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), refetchProtocol()]);
      toast.success('Portfolio refreshed.');
    } catch {
      toast.error('Failed to refresh portfolio.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWithdrawNative = async (amount: string, all = false) => {
    if (!isCorrectNetwork) {
      await switchToQIE();
      return;
    }

    if (!account || !window.ethereum) {
      toast.error('MetaMask is required to withdraw QIE.');
      return;
    }

    setIsWithdrawing(true);
    try {
      const wei = all ? MAX_UINT256 : parseQieToWei(amount);
      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            data: `${WITHDRAW_NATIVE_SELECTOR}${encodeUint256(wei)}`,
          },
        ],
      })) as string;

      toast.success(`Withdraw transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setWithdrawAmount('');
      setWithdrawAll(false);
      window.setTimeout(() => {
        refetch();
        refetchProtocol();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to withdraw QIE.';
      toast.error(message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleRepayNative = async (amount: string) => {
    if (!isCorrectNetwork) {
      await switchToQIE();
      return;
    }

    if (!account || !window.ethereum) {
      toast.error('MetaMask is required to repay QIE.');
      return;
    }

    setIsRepaying(true);
    try {
      const wei = parseQieToWei(amount);
      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            value: `0x${wei.toString(16)}`,
            data: REPAY_NATIVE_SELECTOR,
          },
        ],
      })) as string;

      toast.success(`Repay transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setRepayAmount('');
      window.setTimeout(() => {
        refetch();
        refetchProtocol();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to repay QIE.';
      toast.error(message);
    } finally {
      setIsRepaying(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!isCorrectNetwork) {
      await switchToQIE();
      return;
    }

    if (!account || !window.ethereum) {
      toast.error('MetaMask is required to claim rewards.');
      return;
    }

    setIsClaimingRewards(true);
    try {
      const txHash = (await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowRewards,
            data: CLAIM_REWARDS_SELECTOR,
          },
        ],
      })) as string;

      toast.success(`Claim transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      window.setTimeout(() => {
        refetchProtocol();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim rewards.';
      toast.error(message);
    } finally {
      setIsClaimingRewards(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Portfolio</h1>
          <p className="text-sm text-[#B8B2A6] mt-0.5">Your positions, balances, and rewards</p>
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

      {/* Wallet Overview */}
      <div className="bg-gradient-to-br from-[#B7791F]/20 to-[#F6C453]/10 border border-[#F6C453]/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#2A2112] flex items-center justify-center text-[#F6C453] flex-shrink-0">
            <Wallet className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white font-mono font-bold text-sm">{shortAddress}</p>
              <button
                onClick={copyAddress}
                className="p-1 rounded-md text-[#B8B2A6] hover:text-white hover:bg-white/10 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a
                href={`https://mainnet.qie.digital/address/${account}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-md text-[#B8B2A6] hover:text-[#F6C453] hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isCorrectNetwork ? 'bg-[#F6C453]/10 text-[#F6C453]' : 'bg-yellow-500/10 text-yellow-400'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {networkName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-[#B8B2A6]">QIE Balance</p>
              <p className="text-xl font-black text-white">
                {walletData?.balanceQIE
                  ? parseFloat(walletData.balanceQIE).toFixed(4)
                  : qieBalance
                    ? parseFloat(qieBalance).toFixed(4)
                    : '—'}
              </p>
              <p className="text-xs text-[#B8B2A6]">QIE</p>
            </div>
          </div>
        </div>
      </div>

      {/* On-chain Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-[#F6C453]" />
            <span className="text-xs text-[#B8B2A6]">Protocol Supply</span>
          </div>
          <p className="text-lg font-bold text-white">
            {formatQie(protocolData?.qie.userSupplyQIE)}
          </p>
          <p className="text-xs text-[#B8B2A6]">QIE supplied</p>
        </div>

        <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-4 h-4 text-[#B7791F]" />
            <span className="text-xs text-[#B8B2A6]">Protocol Borrow</span>
          </div>
          <p className="text-lg font-bold text-white">
            {formatQie(protocolData?.qie.userBorrowQIE, 8)}
          </p>
          <p className="text-xs text-[#B8B2A6]">QIE borrowed</p>
        </div>
      </div>

      {/* Supplied Positions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#B8B2A6] uppercase tracking-wider">
            Supplied Assets
          </h2>
          <Link href="/app/lend" className="text-xs text-[#F6C453] hover:underline">
            + Supply
          </Link>
        </div>
        {hasSuppliedQie ? (
          <div className="bg-[#14110B] border border-[#F6C453]/20 rounded-2xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#F6C453]/10 flex items-center justify-center">
                  <QieAssetIcon />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">QIE (Native)</p>
                  <p className="text-xs text-[#B8B2A6]">Supplied collateral</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-right">
                <div>
                  <p className="text-xs text-[#B8B2A6]">Supplied</p>
                  <p className="text-sm font-bold text-white">
                    {formatQie(protocolData?.qie.userSupplyQIE)} QIE
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#B8B2A6]">Supply APY</p>
                  <p className="text-sm font-bold text-white">
                    {protocolData ? `${protocolData.qie.supplyAPYPct.toFixed(2)}%` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#B8B2A6]">Collateral</p>
                  <p className="text-sm font-bold text-white">
                    {protocolData ? `${protocolData.qie.collateralFactorPct.toFixed(0)}%` : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-[#0B0A07] px-3">
                <input
                  value={withdrawAmount}
                  onChange={(event) => {
                    setWithdrawAmount(event.target.value);
                    setWithdrawAll(false);
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-[#B8B2A6]/50"
                />
                <button
                  onClick={() => {
                    setWithdrawAmount(protocolData?.qie.userSupplyQIE ?? '');
                    setWithdrawAll(true);
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-[#F6C453] hover:bg-[#F6C453]/10"
                >
                  Max
                </button>
              </div>
              <button
                onClick={() => handleWithdrawNative(withdrawAmount, withdrawAll)}
                disabled={isWithdrawing}
                className="rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isWithdrawing ? 'Withdrawing...' : 'Withdraw QIE'}
              </button>
            </div>
          </div>
        ) : (
          <EmptyPositions
            title="No supplied assets yet"
            subtitle="Supply assets on the Lend page to start earning yield."
          />
        )}
      </div>

      {/* Borrowed Positions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#B8B2A6] uppercase tracking-wider">
            Borrowed Assets
          </h2>
          <Link href="/app/borrow" className="text-xs text-[#F6C453] hover:underline">
            + Borrow
          </Link>
        </div>
        {hasBorrowedQie ? (
          <div className="bg-[#14110B] border border-[#B7791F]/20 rounded-2xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#B7791F]/15 flex items-center justify-center">
                  <QieAssetIcon />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">QIE (Native)</p>
                  <p className="text-xs text-[#B8B2A6]">Borrowed debt</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-right">
                <div>
                  <p className="text-xs text-[#B8B2A6]">Borrowed</p>
                  <p className="text-sm font-bold text-white">
                    {formatQie(protocolData?.qie.userBorrowQIE, 8)} QIE
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#B8B2A6]">Borrow APY</p>
                  <p className="text-sm font-bold text-white">
                    {protocolData ? `${protocolData.qie.borrowAPYPct.toFixed(2)}%` : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center rounded-xl border border-white/10 bg-[#0B0A07] px-3">
                <input
                  value={repayAmount}
                  onChange={(event) => setRepayAmount(event.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-[#B8B2A6]/50"
                />
                <button
                  onClick={() =>
                    setRepayAmount(getBufferedRepayAmount(protocolData?.qie.userBorrowQIE))
                  }
                  className="rounded-lg px-2 py-1 text-xs font-bold text-[#F6C453] hover:bg-[#F6C453]/10"
                >
                  Max
                </button>
              </div>
              <button
                onClick={() => handleRepayNative(repayAmount)}
                disabled={isRepaying}
                className="rounded-xl border border-[#F6C453]/30 px-5 py-3 text-sm font-bold text-[#F6C453] transition-colors hover:bg-[#F6C453]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRepaying ? 'Repaying...' : 'Repay QIE'}
              </button>
            </div>
          </div>
        ) : (
          <EmptyPositions
            title="No borrowed assets yet"
            subtitle="Borrow against your collateral on the Borrow page."
          />
        )}
      </div>

      {/* QIF Rewards */}
      <div className="bg-gradient-to-br from-[#14110B] to-[#0B0A07] border border-[#B7791F]/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">QIF Rewards</h2>
            <p className="text-xs text-[#B8B2A6]">
              Governance token earned by suppliers & borrowers
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B7791F]/30 to-[#F6C453]/20 flex items-center justify-center text-sm font-black text-[#F6C453]">
            QIF
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#0B0A07] rounded-xl p-3">
            <p className="text-xs text-[#B8B2A6] mb-1">Pending Rewards</p>
            <p className="text-lg font-bold text-white">
              {formatQie(protocolData?.qie.pendingRewardsQIF)} QIF
            </p>
          </div>
          <div className="bg-[#0B0A07] rounded-xl p-3">
            <p className="text-xs text-[#B8B2A6] mb-1">Claimed Total</p>
            <p className="text-lg font-bold text-white">
              {formatQie(protocolData?.qie.claimedRewardsQIF)} QIF
            </p>
          </div>
        </div>
        <button
          onClick={handleClaimRewards}
          disabled={!hasPendingRewards || isClaimingRewards}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/5 disabled:text-[#B8B2A6] disabled:opacity-60"
        >
          {isClaimingRewards
            ? 'Claiming QIF Rewards...'
            : hasPendingRewards
              ? 'Claim QIF Rewards'
              : 'No QIF Rewards to Claim'}
        </button>
      </div>

      {/* Explorer Link */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <a
          href={`https://mainnet.qie.digital/address/${account}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#B8B2A6] hover:text-[#F6C453] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View on QIE Explorer
        </a>
      </div>
    </div>
  );
}
