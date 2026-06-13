'use client';

import React, { useState } from 'react';
import { useWeb3 } from '@/context/Web3Context';
import {
  Wallet,
  ChevronDown,
  AlertTriangle,
  Copy,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';

const NAV_LINKS = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/lend', label: 'Lend' },
  { href: '/app/borrow', label: 'Borrow' },
  { href: '/app/portfolio', label: 'Portfolio' },
];

function WalletMenu({
  account,
  chainId,
  qieBalance,
  qieBalanceUSD,
  isCorrectNetwork,
  switchToQIE,
  disconnect,
}: {
  account: string;
  chainId: number | null;
  qieBalance: string | null;
  qieBalanceUSD: string | null;
  isCorrectNetwork: boolean;
  switchToQIE: () => void;
  disconnect: () => void;
}) {
  const [open, setOpen] = useState(false);

  const short = `${account.slice(0, 6)}...${account.slice(-4)}`;
  const usdBalance = (() => {
    if (!qieBalanceUSD) return null;
    const amount = Number.parseFloat(qieBalanceUSD);
    if (!Number.isFinite(amount)) return null;
    if (amount > 0 && amount < 0.01) return '< $0.01';
    return amount.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  })();

  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    toast.success('Address copied!');
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
          isCorrectNetwork
            ? 'border-[#F6C453]/30 bg-[#F6C453]/5 text-white hover:bg-[#F6C453]/10'
            : 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
        }`}
      >
        {!isCorrectNetwork && <AlertTriangle className="w-4 h-4" />}
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#B7791F] to-[#F6C453]" />
        <span>{short}</span>
        {qieBalance && isCorrectNetwork && (
          <span className="text-[#B8B2A6] text-xs">{parseFloat(qieBalance).toFixed(2)} QIE</span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-[#B8B2A6] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#14110B] border border-white/10 shadow-xl z-50 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <p className="text-xs text-[#B8B2A6] mb-1">Connected Wallet</p>
              <p className="text-sm font-mono text-white">{short}</p>
              {qieBalance && (
                <p className="text-sm text-[#F6C453] font-semibold mt-1">
                  {parseFloat(qieBalance).toFixed(4)} QIE
                </p>
              )}
              {usdBalance && <p className="text-xs text-[#B8B2A6] mt-0.5">{usdBalance}</p>}
              <div className="mt-2 flex items-center gap-1 text-xs text-[#B8B2A6]">
                <div className="w-2 h-2 rounded-full bg-[#F6C453]" />
                {isCorrectNetwork ? 'QIE Mainnet' : `Chain ${chainId}`}
              </div>
            </div>

            {!isCorrectNetwork && (
              <button
                onClick={() => {
                  switchToQIE();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Switch to QIE Mainnet
              </button>
            )}

            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#B8B2A6] hover:text-white hover:bg-white/5 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy Address
            </button>

            <a
              href={`https://mainnet.qie.digital/address/${account}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#B8B2A6] hover:text-white hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Explorer
            </a>

            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Navbar() {
  const {
    account,
    chainId,
    qieBalance,
    qieBalanceUSD,
    isConnecting,
    isConnected,
    isCorrectNetwork,
    connect,
    switchToQIE,
    disconnect,
  } = useWeb3();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl md:ml-56">
      <div className="px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Mobile logo */}
        <Link href="/" className="flex items-center gap-2 md:hidden">
          <img
            src="/qiflow-logo-gold.svg"
            alt="QIFlow"
            className="w-7 h-7 rounded-lg object-cover"
          />
          <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-[#F6C453] to-[#B7791F]">
            QIFlow
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href ? 'text-white bg-white/5' : 'text-[#B8B2A6] hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <WalletMenu
              account={account!}
              chainId={chainId}
              qieBalance={qieBalance}
              qieBalanceUSD={qieBalanceUSD}
              isCorrectNetwork={isCorrectNetwork}
              switchToQIE={switchToQIE}
              disconnect={disconnect}
            />
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60 shadow-lg shadow-[#B7791F]/30"
            >
              <Wallet className="w-4 h-4" />
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-[#B8B2A6] hover:text-white hover:bg-white/5"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-[#0B0A07] px-4 py-3 space-y-1">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'text-[#F6C453] bg-[#F6C453]/10'
                  : 'text-[#B8B2A6] hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
