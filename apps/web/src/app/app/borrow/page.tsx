'use client';

import React, { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import { useQuery } from '@tanstack/react-query';
import { QIFLOW_CONTRACTS } from '@/lib/qiflow-contracts';
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
import { toast } from 'sonner';

const BORROW_NATIVE_SELECTOR = '0x884b9343';
const REPAY_NATIVE_SELECTOR = '0xedba8209';
const WEI_PER_QIE = 1_000_000_000_000_000_000n;
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
  return `0x${wei.toString(16)}`;
}

function encodeUint256(value: string) {
  return value.replace(/^0x/, '').padStart(64, '0');
}

function AssetIcon({ market }: { market: (typeof BORROW_MARKETS)[number] }) {
  if (market.symbol === 'QIE') {
    return <img src={QIE_TOKEN_LOGO} alt="QIE" className="h-8 w-8 object-contain" />;
  }

  return <span>{market.icon}</span>;
}

const BORROW_MARKETS = [
  {
    symbol: 'QIE',
    name: 'QIE (Native)',
    icon: '⚡',
    color: '#F6C453',
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

interface ProtocolData {
  qie: {
    collateralFactorPct: number;
    borrowAPYPct: number;
    liquidityQIE: string;
    userSupplyQIE: string;
    userBorrowQIE: string;
    totalCollateralUSD: string;
    totalBorrowUSD: string;
    availableBorrowUSD: string;
    healthFactor: number | null;
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

function formatQie(value?: string | null, decimals = 4) {
  if (!value) return '-';
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return '-';
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

function minNumericString(left?: string, right?: string) {
  const a = Number.parseFloat(left ?? '0');
  const b = Number.parseFloat(right ?? '0');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '0';
  return Math.max(0, Math.min(a, b)).toString();
}

function HealthBar({ value }: { value: number | null }) {
  const pct = value !== null ? Math.min(100, Math.max(0, (value / 3) * 100)) : 0;
  const color = !value ? '#B8B2A6' : value > 1.5 ? '#00E676' : value > 1.1 ? '#FFB74D' : '#FF5252';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-[#B8B2A6]">Health Factor</span>
        <span className="text-sm font-bold" style={{ color }}>
          {value ? value.toFixed(2) : '—'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#0B0A07] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[#B8B2A6] mt-1">
        <span>Liquidation</span>
        <span>Safe</span>
      </div>
    </div>
  );
}

function BorrowMarketRow({
  market,
  account,
  isConnected,
  isCorrectNetwork,
  protocolData,
  connect,
  switchToQIE,
  refetchWallet,
  refetchProtocol,
}: {
  market: (typeof BORROW_MARKETS)[0];
  account: string | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  protocolData?: ProtocolData;
  connect: () => Promise<void>;
  switchToQIE: () => Promise<void>;
  refetchWallet: () => void;
  refetchProtocol: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLive = market.status === 'live';
  const availableToBorrow = minNumericString(
    protocolData?.qie.availableBorrowUSD,
    protocolData?.qie.liquidityQIE
  );
  const hasDebt = Number.parseFloat(protocolData?.qie.userBorrowQIE ?? '0') > 0;

  const refreshAfterTx = () => {
    window.setTimeout(() => {
      refetchWallet();
      refetchProtocol();
    }, 5000);
  };

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

  const handleBorrowNative = async () => {
    if (!(await ensureReady())) return;

    setIsSubmitting(true);
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error('MetaMask is required to borrow QIE.');

      const value = parseQieToWei(borrowAmount);
      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            data: `${BORROW_NATIVE_SELECTOR}${encodeUint256(value)}`,
          },
        ],
      })) as string;

      toast.success(`Borrow transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setBorrowAmount('');
      refreshAfterTx();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to borrow QIE.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepayNative = async () => {
    if (!(await ensureReady())) return;

    setIsSubmitting(true);
    try {
      const ethereum = window.ethereum;
      if (!ethereum) throw new Error('MetaMask is required to repay QIE.');

      const value = parseQieToWei(repayAmount);
      const txHash = (await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: account,
            to: QIFLOW_CONTRACTS.QIFlowPool,
            value,
            data: REPAY_NATIVE_SELECTOR,
          },
        ],
      })) as string;

      toast.success(`Repay transaction sent: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setRepayAmount('');
      refreshAfterTx();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to repay QIE.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all ${open ? 'border-[#B7791F]/30' : 'border-white/5'} bg-[#14110B] overflow-hidden`}
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
                Coming Soon
              </span>
            )}
          </div>
          <span className="text-xs text-[#B8B2A6]">{market.name}</span>
        </div>

        <div className="hidden sm:grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-xs text-[#B8B2A6] mb-1">Borrow APY</div>
            <div className="text-sm font-bold text-[#FFB74D]">
              {isLive && protocolData ? `${protocolData.qie.borrowAPYPct.toFixed(2)}%` : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#B8B2A6] mb-1">Liq. Threshold</div>
            <div className="text-sm font-bold text-white">{market.liquidationThreshold}%</div>
          </div>
          <div>
            <div className="text-xs text-[#B8B2A6] mb-1">Available</div>
            <div className="text-sm font-bold text-[#B8B2A6]">
              {isLive ? `${formatQie(availableToBorrow)} QIE` : '-'}
            </div>
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
                Borrow Details
              </h4>
              {[
                { label: 'Min Collateral Factor', value: `${market.minCollateralFactor}%` },
                { label: 'Liquidation Threshold', value: `${market.liquidationThreshold}%` },
                { label: 'Liquidation Penalty', value: '10%' },
                { label: 'Interest Rate Model', value: 'Jump Rate Model' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-[#B8B2A6]">{label}</span>
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
              <h4 className="text-xs font-semibold text-[#B8B2A6] uppercase tracking-wider">
                Borrow {market.symbol}
              </h4>
              <div className="bg-[#0B0A07] rounded-xl p-4">
                <p className="text-xs text-[#B8B2A6] mb-1">Borrow Limit</p>
                <p className="text-lg font-bold text-white">
                  {isLive ? `${formatQie(protocolData?.qie.availableBorrowUSD)} QIE` : '-'}
                </p>
                <p className="text-xs text-[#B8B2A6] mt-1">
                  {hasDebt
                    ? `${formatQie(protocolData?.qie.userBorrowQIE, 8)} QIE currently borrowed`
                    : 'Supply assets first to create borrow limit'}
                </p>
              </div>

              {isLive ? (
                <div className="space-y-3">
                  <div className="flex items-center rounded-xl border border-white/10 bg-[#0B0A07] px-3">
                    <input
                      value={borrowAmount}
                      onChange={(event) => setBorrowAmount(event.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-[#B8B2A6]/50"
                    />
                    <button
                      onClick={() => setBorrowAmount(availableToBorrow)}
                      className="rounded-lg px-2 py-1 text-xs font-bold text-[#F6C453] hover:bg-[#F6C453]/10"
                    >
                      Max
                    </button>
                  </div>
                  <button
                    onClick={handleBorrowNative}
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white font-bold text-sm hover:opacity-90 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : `Borrow ${market.symbol}`}
                  </button>

                  {hasDebt && (
                    <div className="space-y-2 rounded-xl border border-white/5 bg-[#0B0A07] p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-[#B8B2A6]">Outstanding debt</p>
                        <p className="text-sm font-bold text-white">
                          {formatQie(protocolData?.qie.userBorrowQIE, 8)} QIE
                        </p>
                      </div>
                      <div className="flex items-center rounded-xl border border-white/10 bg-[#14110B] px-3">
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
                        onClick={handleRepayNative}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-[#F6C453]/30 px-4 py-2.5 text-sm font-bold text-[#F6C453] transition-colors hover:bg-[#F6C453]/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Repay QIE
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-[#B8B2A6] font-bold text-sm cursor-not-allowed"
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
  const { account, isConnected, connect, isConnecting, isCorrectNetwork, switchToQIE } = useWeb3();
  const { refetch: refetchWallet } = useWalletBalance(account);
  const { data: protocolData, refetch: refetchProtocol } = useProtocolData(account);
  const availableToBorrow = minNumericString(
    protocolData?.qie.availableBorrowUSD,
    protocolData?.qie.liquidityQIE
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Borrow</h1>
        <p className="text-sm text-[#B8B2A6] mt-0.5">Borrow against your supplied collateral</p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#B7791F]/5 border border-[#B7791F]/15">
        <Info className="w-5 h-5 text-[#B7791F] flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-white font-semibold mb-1">How Borrowing Works</p>
          <p className="text-[#B8B2A6] text-xs leading-relaxed">
            Supply assets as collateral, then borrow up to your collateral factor limit. Interest
            accrues per block on QIE. Keep your health factor above 1.0 to avoid liquidation. Repay
            any time to restore your borrow limit.
          </p>
        </div>
      </div>

      {/* Borrow Limits Summary */}
      {isConnected && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#B8B2A6] mb-1">Borrow Limit</p>
            <p className="text-lg font-bold text-white">
              {formatQie(protocolData?.qie.availableBorrowUSD)} QIE
            </p>
          </div>
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#B8B2A6] mb-1">Used</p>
            <p className="text-lg font-bold text-white">
              {formatQie(protocolData?.qie.userBorrowQIE, 8)} QIE
            </p>
          </div>
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-[#B8B2A6] mb-1">Available</p>
            <p className="text-lg font-bold text-[#F6C453]">{formatQie(availableToBorrow)} QIE</p>
          </div>
          <div className="bg-[#14110B] border border-white/5 rounded-2xl p-4">
            <HealthBar value={protocolData?.qie.healthFactor ?? null} />
          </div>
        </div>
      )}

      {/* Liquidation Warning */}
      {isConnected && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/15">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="text-red-400 font-semibold mb-1">Liquidation Risk</p>
            <p className="text-[#B8B2A6] leading-relaxed">
              Your positions are liquidated automatically if your health factor drops below 1.0.
              Market volatility and accrued interest can lower your health factor. Always maintain a
              buffer above the liquidation threshold.
            </p>
          </div>
        </div>
      )}

      {/* Markets */}
      <div>
        <h2 className="text-sm font-semibold text-[#B8B2A6] uppercase tracking-wider mb-3">
          Borrow Markets
        </h2>
        <div className="space-y-3">
          {BORROW_MARKETS.map((m) => (
            <BorrowMarketRow
              key={m.symbol}
              market={m}
              account={account}
              isConnected={isConnected}
              isCorrectNetwork={isCorrectNetwork}
              protocolData={protocolData}
              connect={connect}
              switchToQIE={switchToQIE}
              refetchWallet={refetchWallet}
              refetchProtocol={refetchProtocol}
            />
          ))}
        </div>
      </div>

      {/* How Health Factor Works */}
      <div className="bg-[#14110B] border border-white/5 rounded-2xl p-5">
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
            <div key={item.range} className="bg-[#0B0A07] rounded-xl p-4">
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
              <p className="text-xs text-[#B8B2A6]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Prompt */}
      {!isConnected && (
        <div className="bg-[#14110B] border border-white/5 rounded-2xl p-8 text-center">
          <ArrowDownUp className="w-10 h-10 mx-auto text-[#B7791F] mb-3" />
          <h3 className="text-base font-bold text-white mb-2">Connect to Borrow</h3>
          <p className="text-[#B8B2A6] text-sm mb-5 max-w-xs mx-auto">
            Connect your wallet to view borrow limits and access liquidity.
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

      {/* External Links */}
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
      </div>
    </div>
  );
}
