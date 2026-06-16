'use client';

import React, { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { useQuery } from '@tanstack/react-query';
import { QIFLOW_CONTRACTS } from '@/lib/qiflow-contracts';
import { QUSDC_TOKEN } from '@/lib/supported-assets';
import { GetQusdcButton } from '@/components/qiflow/GetQusdcButton';
import { Wallet, ArrowRight, Info, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const SUPPLY_NATIVE_SELECTOR = '0xa49f20dc';
const WITHDRAW_NATIVE_SELECTOR = '0x84276d81';
const SUPPLY_TOKEN_SELECTOR = '0xf2b9fdb8';
const WITHDRAW_TOKEN_SELECTOR = '0xf3fef3a3';
const APPROVE_SELECTOR = '0x095ea7b3';
const WEI_PER_QIE = 1_000_000_000_000_000_000n;
const NATIVE_GAS_BUFFER_WEI = 10_000_000_000_000_000n;
const MAX_UINT256 = (1n << 256n) - 1n;
const QIE_TOKEN_LOGO = '/qie-token-logo.png';

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

function parseTokenToUnits(value: string, decimals: number, symbol: string) {
  const trimmed = value.trim();
  const pattern = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);
  if (!pattern.test(trimmed)) {
    throw new Error(`Enter a valid ${symbol} amount.`);
  }

  const [wholePart, fractionPart = ''] = trimmed.split('.');
  const base = 10n ** BigInt(decimals);
  const units = BigInt(wholePart || '0') * base + BigInt(fractionPart.padEnd(decimals, '0') || '0');

  if (units <= 0n) throw new Error('Amount must be greater than 0.');
  return units;
}

function toHexWei(value: bigint) {
  return `0x${value.toString(16)}`;
}

function encodeUint256(value: bigint) {
  return value.toString(16).padStart(64, '0');
}

function encodeAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
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

function formatTokenAmount(value?: string | null, decimals = 4) {
  if (!value) return '-';
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return '-';
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function formatUsd(value?: number | null, maximumFractionDigits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

function getQieUsdValue(amount?: string | null, price?: number | null) {
  const qieAmount = Number.parseFloat(amount ?? '0');
  if (!Number.isFinite(qieAmount) || typeof price !== 'number' || !Number.isFinite(price)) {
    return null;
  }
  return qieAmount * price;
}

function getTokenUsdValue(amount?: string | null, price?: number | null) {
  const tokenAmount = Number.parseFloat(amount ?? '0');
  if (!Number.isFinite(tokenAmount) || typeof price !== 'number' || !Number.isFinite(price)) {
    return null;
  }
  return tokenAmount * price;
}

function AssetIcon({ market }: { market: (typeof MARKETS)[number] }) {
  if (market.symbol === 'QIE') {
    return <img src={QIE_TOKEN_LOGO} alt="QIE" className="h-8 w-8 object-contain" />;
  }

  if (market.symbol === QUSDC_TOKEN.symbol) {
    return <img src={QUSDC_TOKEN.logo} alt={QUSDC_TOKEN.symbol} className="h-8 w-8 rounded-full object-cover" />;
  }

  return <span>{market.icon}</span>;
}

function getSafeMaxSupplyAmount(balance?: string | null) {
  if (!balance) return '';
  try {
    const balanceWei = parseQieToWei(balance);
    const maxWei = balanceWei > NATIVE_GAS_BUFFER_WEI ? balanceWei - NATIVE_GAS_BUFFER_WEI : 0n;
    const whole = maxWei / WEI_PER_QIE;
    const fraction = (maxWei % WEI_PER_QIE).toString().padStart(18, '0').slice(0, 6);
    return `${whole}.${fraction}`.replace(/\.?0+$/, '');
  } catch {
    return '';
  }
}

const MARKETS = [
  {
    symbol: 'QIE',
    name: 'QIE (Native)',
    icon: '⚡',
    color: '#F6C453',
    description: 'The native token of QIE Blockchain',
    status: 'live',
  },
  {
    symbol: QUSDC_TOKEN.symbol,
    name: QUSDC_TOKEN.name,
    icon: '💵',
    color: '#2E9B7F',
    description: 'QIE Mainnet ERC-20 stablecoin',
    status: 'live',
    tokenAddress: QUSDC_TOKEN.address,
    explorerUrl: QUSDC_TOKEN.explorerUrl,
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

interface ProtocolData {
  qie: {
    collateralFactorPct: number;
    priceUSD: number | null;
    priceSource: string;
    supplyAPYPct: number;
    utilizationPct: number;
    liquidityQIE: string;
    userSupplyQIE: string;
    userBorrowQIE: string;
  };
  qusdc: {
    isListed: boolean;
    isActive: boolean;
    collateralFactorPct: number;
    priceUSD: number;
    supplyAPYPct: number;
    utilizationPct: number;
    liquidity: string;
    userSupply: string;
    userBorrow: string;
  };
}

interface PriceData {
  qie: {
    priceUSD: number | null;
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

function useQiePrice() {
  return useQuery<PriceData>({
    queryKey: ['qie-price'],
    queryFn: async () => {
      const res = await fetch('/api/qie/price');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 30000,
  });
}

function MarketRow({
  market,
  account,
  isConnected,
  isCorrectNetwork,
  qieBalance,
  protocolData,
  qiePrice,
  tokenBalance,
  connect,
  switchToQIE,
  refetchWallet,
  refetchProtocol,
}: {
  market: (typeof MARKETS)[0];
  account: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  qieBalance?: string | null;
  protocolData?: ProtocolData;
  qiePrice?: number | null;
  tokenBalance?: string | null;
  connect: () => Promise<void>;
  switchToQIE: () => Promise<void>;
  refetchWallet: () => void;
  refetchProtocol: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAll, setWithdrawAll] = useState(false);
  const [isSupplying, setIsSupplying] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const isLive = market.status === 'live';
  const isQusdc = market.symbol === QUSDC_TOKEN.symbol;
  const hasSuppliedQie = Number.parseFloat(protocolData?.qie.userSupplyQIE ?? '0') > 0;
  const hasBorrowedQie = Number.parseFloat(protocolData?.qie.userBorrowQIE ?? '0') > 0;
  const qusdcSupply = protocolData?.qusdc.userSupply ?? '0';
  const hasSuppliedQusdc = Number.parseFloat(qusdcSupply) > 0;
  const typedSupplyValueUSD = getQieUsdValue(amount, qiePrice);
  const typedQusdcValueUSD = getTokenUsdValue(amount, QUSDC_TOKEN.priceUSD);

  const ensureReady = async () => {
    if (!isConnected) {
      await connect();
      return false;
    }

    if (!isCorrectNetwork) {
      await switchToQIE();
      return false;
    }

    if (!account || !window.ethereum) {
      toast.error('MetaMask is required to use QIFlow.');
      return false;
    }

    return true;
  };

  const handleSupplyNative = async () => {
    if (!(await ensureReady())) return;

    setIsSupplying(true);
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error('MetaMask is required to supply QIE.');
      const value = parseQieToWei(amount);
      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            value: toHexWei(value),
            data: SUPPLY_NATIVE_SELECTOR,
          },
        ],
      })) as string;

      toast.success(`Supply transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setAmount('');
      window.setTimeout(() => {
        refetchWallet();
        refetchProtocol();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to supply QIE.';
      toast.error(message);
    } finally {
      setIsSupplying(false);
    }
  };

  const handleSupplyQusdc = async () => {
    if (!(await ensureReady())) return;

    setIsSupplying(true);
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error(`MetaMask is required to supply ${QUSDC_TOKEN.symbol}.`);
      const value = parseTokenToUnits(amount, QUSDC_TOKEN.decimals, QUSDC_TOKEN.symbol);
      const encodedAmount = encodeUint256(value);
      const approveHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QUSDC_TOKEN.address,
            data: `${APPROVE_SELECTOR}${encodeAddress(QIFLOW_CONTRACTS.QIFlowPool)}${encodedAmount}`,
          },
        ],
      })) as string;
      toast.success(`Approval sent: ${approveHash.slice(0, 10)}...${approveHash.slice(-6)}`);

      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            data: `${SUPPLY_TOKEN_SELECTOR}${encodeAddress(QUSDC_TOKEN.address)}${encodedAmount}`,
          },
        ],
      })) as string;

      toast.success(`Supply transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setAmount('');
      window.setTimeout(() => {
        refetchWallet();
        refetchProtocol();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to supply ${QUSDC_TOKEN.symbol}.`;
      toast.error(message);
    } finally {
      setIsSupplying(false);
    }
  };

  const handleWithdrawNative = async () => {
    if (!(await ensureReady())) return;

    setIsWithdrawing(true);
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error('MetaMask is required to withdraw QIE.');
      const value = withdrawAll ? MAX_UINT256 : parseQieToWei(withdrawAmount);
      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            data: `${WITHDRAW_NATIVE_SELECTOR}${encodeUint256(value)}`,
          },
        ],
      })) as string;

      toast.success(`Withdraw transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setWithdrawAmount('');
      setWithdrawAll(false);
      window.setTimeout(() => {
        refetchWallet();
        refetchProtocol();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to withdraw QIE.';
      toast.error(message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleWithdrawQusdc = async () => {
    if (!(await ensureReady())) return;

    setIsWithdrawing(true);
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error(`MetaMask is required to withdraw ${QUSDC_TOKEN.symbol}.`);
      const value = withdrawAll
        ? MAX_UINT256
        : parseTokenToUnits(withdrawAmount, QUSDC_TOKEN.decimals, QUSDC_TOKEN.symbol);
      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            data: `${WITHDRAW_TOKEN_SELECTOR}${encodeAddress(QUSDC_TOKEN.address)}${encodeUint256(value)}`,
          },
        ],
      })) as string;

      toast.success(`Withdraw transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setWithdrawAmount('');
      setWithdrawAll(false);
      window.setTimeout(() => {
        refetchWallet();
        refetchProtocol();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to withdraw ${QUSDC_TOKEN.symbol}.`;
      toast.error(message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all ${open ? 'border-[#F6C453]/30' : 'border-white/5'} bg-[#14110B] overflow-hidden`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/2 transition-colors"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${market.color}20` }}
        >
          <AssetIcon market={market} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{market.symbol}</span>
            {!isLive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-semibold">
                {market.symbol === QUSDC_TOKEN.symbol ? 'Pool Pending' : 'Coming Soon'}
              </span>
            )}
          </div>
          <span className="text-xs text-[#B8B2A6]">{market.name}</span>
        </div>

        <div className="hidden sm:grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-xs text-[#B8B2A6] mb-1">Supply APY</div>
            <div className="text-sm font-bold text-[#B8B2A6]">
              {isLive && protocolData
                ? `${(isQusdc ? protocolData.qusdc.supplyAPYPct : protocolData.qie.supplyAPYPct).toFixed(2)}%`
                : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#B8B2A6] mb-1">Collateral</div>
            <div className="text-sm font-bold text-[#B8B2A6]">
              {isLive && protocolData
                ? `${(isQusdc ? protocolData.qusdc.collateralFactorPct : protocolData.qie.collateralFactorPct).toFixed(0)}%`
                : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#B8B2A6] mb-1">Liquidity</div>
            <div className="text-sm font-bold text-[#B8B2A6]">
              {isLive && protocolData
                ? isQusdc
                  ? `${formatTokenAmount(protocolData.qusdc.liquidity, 2)} ${QUSDC_TOKEN.symbol}`
                  : `${formatQie(protocolData.qie.liquidityQIE, 2)} QIE`
                : '-'}
            </div>
            {isLive && protocolData && (
              <div className="text-[10px] text-[#B8B2A6]/70">
                {isQusdc
                  ? formatUsd(getTokenUsdValue(protocolData.qusdc.liquidity, QUSDC_TOKEN.priceUSD))
                  : formatUsd(getQieUsdValue(protocolData.qie.liquidityQIE, protocolData.qie.priceUSD))}
              </div>
            )}
          </div>
        </div>

        <div className="text-[#B8B2A6] ml-2">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          <div className="pt-4 grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[#B8B2A6] uppercase tracking-wider">
                Market Info
              </h4>
              {[
                { label: 'Asset', value: market.name },
                { label: 'Symbol', value: market.symbol },
                {
                  label: 'Collateral Factor',
                  value:
                    isLive && protocolData
                      ? `${(isQusdc ? protocolData.qusdc.collateralFactorPct : protocolData.qie.collateralFactorPct).toFixed(0)}%`
                      : '-',
                },
                {
                  label: 'Supply APY',
                  value:
                    isLive && protocolData
                      ? `${(isQusdc ? protocolData.qusdc.supplyAPYPct : protocolData.qie.supplyAPYPct).toFixed(2)}%`
                      : '-',
                },
                {
                  label: 'Your Supplied',
                  value:
                    isLive && protocolData
                      ? isQusdc
                        ? `${formatTokenAmount(protocolData.qusdc.userSupply, 2)} ${QUSDC_TOKEN.symbol}`
                        : `${formatQie(protocolData.qie.userSupplyQIE)} QIE`
                      : '-',
                },
                {
                  label: 'Your Supplied Value',
                  value:
                    isLive && protocolData
                      ? isQusdc
                        ? formatUsd(getTokenUsdValue(protocolData.qusdc.userSupply, QUSDC_TOKEN.priceUSD))
                        : formatUsd(getQieUsdValue(protocolData.qie.userSupplyQIE, protocolData.qie.priceUSD))
                      : '-',
                },
                {
                  label: 'Your Borrowed',
                  value:
                    isLive && protocolData
                      ? isQusdc
                        ? `${formatTokenAmount(protocolData.qusdc.userBorrow, 2)} ${QUSDC_TOKEN.symbol}`
                        : `${formatQie(protocolData.qie.userBorrowQIE, 8)} QIE`
                      : '-',
                },
                {
                  label: 'Your Borrowed Value',
                  value:
                    isLive && protocolData
                      ? isQusdc
                        ? formatUsd(getTokenUsdValue(protocolData.qusdc.userBorrow, QUSDC_TOKEN.priceUSD))
                        : formatUsd(getQieUsdValue(protocolData.qie.userBorrowQIE, protocolData.qie.priceUSD))
                      : '-',
                },
                {
                  label: 'Utilization',
                  value:
                    isLive && protocolData
                      ? `${(isQusdc ? protocolData.qusdc.utilizationPct : protocolData.qie.utilizationPct).toFixed(2)}%`
                      : '-',
                },
                { label: 'Description', value: market.description },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-[#B8B2A6]">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[#B8B2A6] uppercase tracking-wider">
                Your Wallet
              </h4>
              {market.symbol === 'QIE' ? (
                <div className="bg-[#0B0A07] rounded-xl p-4">
                  <p className="text-xs text-[#B8B2A6] mb-1">Available to Supply</p>
                  <p className="text-lg font-bold text-[#F6C453]">
                    {qieBalance ? `${formatQie(qieBalance)} QIE` : '-'}
                  </p>
                  {qieBalance && protocolData && (
                    <p className="text-xs text-[#B8B2A6]">
                      {formatUsd(getQieUsdValue(qieBalance, protocolData.qie.priceUSD))}
                    </p>
                  )}
                  <div className="mt-4 rounded-xl bg-[#14110B] p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label
                        htmlFor="qie-supply-amount"
                        className="text-[10px] text-[#B8B2A6] font-semibold uppercase tracking-wider"
                      >
                        Amount
                      </label>
                      {qieBalance && (
                        <button
                          type="button"
                          onClick={() => setAmount(getSafeMaxSupplyAmount(qieBalance))}
                          className="text-xs text-[#F6C453] hover:text-white transition-colors"
                        >
                          Max
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="qie-supply-amount"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="min-w-0 flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-[#B8B2A6]/50"
                      />
                      <span className="text-sm font-bold text-[#B8B2A6]">QIE</span>
                    </div>
                    {amount.trim() && (
                      <p className="mt-2 text-xs font-medium text-[#F6C453]">
                        {typedSupplyValueUSD !== null && typeof qiePrice === 'number'
                          ? formatUsd(typedSupplyValueUSD)
                          : 'Fetching QIE price...'}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-[#B8B2A6]/70">
                      Max leaves 0.01 QIE for gas.
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl bg-[#14110B] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] text-[#B8B2A6] font-semibold uppercase tracking-wider">
                          Supplied
                        </p>
                        <p className="text-sm font-bold text-white">
                          {formatQie(protocolData?.qie.userSupplyQIE)} QIE
                        </p>
                        {protocolData && (
                          <p className="text-xs text-[#B8B2A6]">
                            {formatUsd(getQieUsdValue(protocolData.qie.userSupplyQIE, protocolData.qie.priceUSD))}
                          </p>
                        )}
                      </div>
                      {hasSuppliedQie && (
                        <button
                          type="button"
                          onClick={() => {
                            if (hasBorrowedQie) {
                              toast.error('Repay your remaining borrowed QIE before withdrawing all supplied QIE.');
                              return;
                            }
                            setWithdrawAmount(protocolData?.qie.userSupplyQIE ?? '');
                            setWithdrawAll(true);
                          }}
                          className="text-xs text-[#F6C453] hover:text-white transition-colors"
                        >
                          Max
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={withdrawAmount}
                        onChange={(event) => {
                          setWithdrawAmount(event.target.value);
                          setWithdrawAll(false);
                        }}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="min-w-0 flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-[#B8B2A6]/50"
                      />
                      <span className="text-sm font-bold text-[#B8B2A6]">QIE</span>
                    </div>
                    <button
                      onClick={handleWithdrawNative}
                      disabled={isWithdrawing || !withdrawAmount.trim() || !hasSuppliedQie || hasBorrowedQie}
                      className="mt-3 w-full rounded-xl border border-[#F6C453]/30 px-4 py-2.5 text-sm font-bold text-[#F6C453] transition-colors hover:bg-[#F6C453]/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isWithdrawing
                        ? 'Withdrawing...'
                        : hasBorrowedQie
                          ? 'Repay Debt Before Withdraw'
                          : 'Withdraw QIE'}
                    </button>
                    {hasBorrowedQie && (
                      <p className="mt-2 text-xs text-yellow-400">
                        Remaining debt: {formatQie(protocolData?.qie.userBorrowQIE, 8)} QIE. Repay it first to withdraw all supplied QIE.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-[#0B0A07] rounded-xl p-4">
                  <p className="text-xs text-[#B8B2A6] mb-1">Wallet Balance</p>
                  <p className="text-lg font-bold text-[#F6C453]">
                    {formatTokenAmount(tokenBalance, 2)} {market.symbol}
                  </p>
                  {market.symbol === QUSDC_TOKEN.symbol && (
                    <p className="text-xs text-[#F6C453]">
                      {formatUsd(getTokenUsdValue(tokenBalance, QUSDC_TOKEN.priceUSD))} total value
                    </p>
                  )}
                  {isQusdc && (
                    <GetQusdcButton
                      compact
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#F6C453]/30 px-4 py-2 text-xs font-bold text-[#F6C453] transition-colors hover:bg-[#F6C453]/10"
                    />
                  )}
                  {'explorerUrl' in market && market.explorerUrl && (
                    <a
                      href={market.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#B8B2A6] hover:text-[#F6C453] transition-colors"
                    >
                      View token <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {isQusdc && (
                    <>
                      <p className="text-xs text-[#F6C453]">
                        {formatUsd(getTokenUsdValue(tokenBalance, QUSDC_TOKEN.priceUSD))} total value
                      </p>
                      <div className="mt-4 rounded-xl bg-[#14110B] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label
                            htmlFor="qusdc-supply-amount"
                            className="text-[10px] text-[#B8B2A6] font-semibold uppercase tracking-wider"
                          >
                            Amount
                          </label>
                          {tokenBalance && (
                            <button
                              type="button"
                              onClick={() => setAmount(tokenBalance)}
                              className="text-xs text-[#F6C453] hover:text-white transition-colors"
                            >
                              Max
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id="qusdc-supply-amount"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="min-w-0 flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-[#B8B2A6]/50"
                          />
                          <span className="text-sm font-bold text-[#B8B2A6]">QUSDC</span>
                        </div>
                        {amount.trim() && (
                          <p className="mt-2 text-xs font-medium text-[#F6C453]">
                            {formatUsd(typedQusdcValueUSD)}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 rounded-xl bg-[#14110B] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] text-[#B8B2A6] font-semibold uppercase tracking-wider">
                              Supplied
                            </p>
                            <p className="text-sm font-bold text-white">
                              {formatTokenAmount(protocolData?.qusdc.userSupply, 2)} QUSDC
                            </p>
                            <p className="text-xs text-[#B8B2A6]">
                              {formatUsd(getTokenUsdValue(protocolData?.qusdc.userSupply, QUSDC_TOKEN.priceUSD))}
                            </p>
                          </div>
                          {hasSuppliedQusdc && (
                            <button
                              type="button"
                              onClick={() => {
                                setWithdrawAmount(protocolData?.qusdc.userSupply ?? '');
                                setWithdrawAll(true);
                              }}
                              className="text-xs text-[#F6C453] hover:text-white transition-colors"
                            >
                              Max
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            value={withdrawAmount}
                            onChange={(event) => {
                              setWithdrawAmount(event.target.value);
                              setWithdrawAll(false);
                            }}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="min-w-0 flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-[#B8B2A6]/50"
                          />
                          <span className="text-sm font-bold text-[#B8B2A6]">QUSDC</span>
                        </div>
                        <button
                          onClick={handleWithdrawQusdc}
                          disabled={isWithdrawing || !withdrawAmount.trim() || !hasSuppliedQusdc}
                          className="mt-3 w-full rounded-xl border border-[#F6C453]/30 px-4 py-2.5 text-sm font-bold text-[#F6C453] transition-colors hover:bg-[#F6C453]/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isWithdrawing ? 'Withdrawing...' : 'Withdraw QUSDC'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isLive ? (
                <button
                  onClick={isQusdc ? handleSupplyQusdc : handleSupplyNative}
                  disabled={isSupplying || (isConnected && isCorrectNetwork && !amount.trim())}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSupplying
                    ? 'Confirming...'
                    : !isConnected
                      ? 'Connect Wallet'
                      : !isCorrectNetwork
                        ? 'Switch to QIE Mainnet'
                        : `Supply ${market.symbol}`}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[#B8B2A6] font-bold text-sm cursor-not-allowed"
                >
                  Pool Market Not Listed
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
  const {
    account,
    isConnected,
    isCorrectNetwork,
    connect,
    isConnecting,
    switchToQIE,
  } = useWeb3();
  const { data: walletData, refetch: refetchWallet } = useWalletBalance(account);
  const { data: protocolData, refetch: refetchProtocol } = useProtocolData(account);
  const { data: priceData } = useQiePrice();
  const qiePrice = protocolData?.qie.priceUSD ?? priceData?.qie.priceUSD ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Lend</h1>
        <p className="text-sm text-[#B8B2A6] mt-0.5">Supply assets to earn yield from borrowers</p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F6C453]/5 border border-[#F6C453]/15">
        <Info className="w-5 h-5 text-[#F6C453] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-white font-semibold mb-1">How Lending Works</p>
          <p className="text-[#B8B2A6] text-xs leading-relaxed">
            Supply your assets to the QIFlow liquidity pool. You'll receive qTokens as proof of your
            deposit. Interest accrues every block (~3.6s) and you can withdraw at any time. Your
            supplied assets can also serve as collateral to borrow other assets.
          </p>
        </div>
      </div>

      {/* Wallet Summary */}
      {isConnected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#B8B2A6] mb-1">QIE Balance</p>
            <p className="text-lg font-bold text-white">
              {walletData?.balanceQIE ? formatQie(walletData.balanceQIE) : '-'}{' '}
              <span className="text-sm text-[#B8B2A6]">QIE</span>
            </p>
            <p className="text-xs text-[#F6C453]">
              {formatUsd(getQieUsdValue(walletData?.balanceQIE, protocolData?.qie.priceUSD))}
            </p>
          </div>
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#B8B2A6] mb-1">Your Supplied</p>
            <p className="text-lg font-bold text-white">
              {formatQie(protocolData?.qie.userSupplyQIE)}{' '}
              <span className="text-sm text-[#B8B2A6]">QIE</span>
            </p>
            <p className="text-xs text-[#B8B2A6]">
              {formatUsd(getQieUsdValue(protocolData?.qie.userSupplyQIE, protocolData?.qie.priceUSD))}
            </p>
          </div>
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#B8B2A6] mb-1">QUSDC Balance</p>
            <p className="text-lg font-bold text-white">
              {formatTokenAmount(walletData?.tokens?.qusdc?.balance, 2)}{' '}
              <span className="text-sm text-[#B8B2A6]">QUSDC</span>
            </p>
            <p className="text-xs text-[#F6C453]">
              {formatUsd(getTokenUsdValue(walletData?.tokens?.qusdc?.balance, QUSDC_TOKEN.priceUSD))}
            </p>
            <GetQusdcButton
              compact
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#F6C453]/30 px-4 py-2 text-xs font-bold text-[#F6C453] transition-colors hover:bg-[#F6C453]/10"
            />
          </div>
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#B8B2A6] mb-1">Net APY</p>
            <p className="text-lg font-bold text-[#00E676]">
              {protocolData ? `${protocolData.qie.supplyAPYPct.toFixed(2)}%` : '-'}
            </p>
            <p className="text-xs text-[#B8B2A6]">Across all markets</p>
          </div>
        </div>
      )}

      {/* Markets */}
      <div>
        <h2 className="text-sm font-semibold text-[#B8B2A6] uppercase tracking-wider mb-3">
          Available Markets
        </h2>
        <div className="space-y-3">
          {MARKETS.map((m) => (
            <MarketRow
              key={m.symbol}
              market={m}
              account={account}
              isConnected={isConnected}
              isCorrectNetwork={isCorrectNetwork}
              qieBalance={walletData?.balanceQIE}
              protocolData={protocolData}
              qiePrice={qiePrice}
              tokenBalance={m.symbol === QUSDC_TOKEN.symbol ? walletData?.tokens?.qusdc?.balance : null}
              connect={connect}
              switchToQIE={switchToQIE}
              refetchWallet={() => refetchWallet()}
              refetchProtocol={() => refetchProtocol()}
            />
          ))}
        </div>
      </div>

      {/* Connect Prompt */}
      {!isConnected && (
        <div className="bg-[#14110B] border border-white/5 rounded-2xl p-8 text-center">
          <Wallet className="w-10 h-10 mx-auto text-[#B7791F] mb-3" />
          <h3 className="text-base font-bold text-white mb-2">Connect to Start Lending</h3>
          <p className="text-[#B8B2A6] text-sm mb-5 max-w-xs mx-auto">
            Connect your MetaMask wallet with QIE Mainnet to supply assets and earn yield.
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
      )}

      {/* Links to QIE Resources */}
      <div className="flex items-center gap-3 pt-2">
        <a
          href="https://mainnet.qie.digital/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#B8B2A6] hover:text-[#F6C453] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          QIE Explorer
        </a>
        <span className="text-[#B8B2A6]">·</span>
        <a
          href="https://docs.qie.digital/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#B8B2A6] hover:text-[#F6C453] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          QIE Docs
        </a>
        <span className="text-[#B8B2A6]">·</span>
        <Link
          href="/app/borrow"
          className="flex items-center gap-1.5 text-xs text-[#B8B2A6] hover:text-[#F6C453] transition-colors"
        >
          Go to Borrow <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
