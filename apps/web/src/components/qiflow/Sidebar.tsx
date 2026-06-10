'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowDownUp,
  HandCoins,
  Briefcase,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

const nav = [
  { href: '/app', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { href: '/app/lend', icon: <HandCoins className="w-5 h-5" />, label: 'Lend' },
  { href: '/app/borrow', icon: <ArrowDownUp className="w-5 h-5" />, label: 'Borrow' },
  { href: '/app/portfolio', icon: <Briefcase className="w-5 h-5" />, label: 'Portfolio' },
];

const external = [
  { href: 'https://mainnet.qie.digital/', label: 'Explorer' },
  { href: 'https://docs.qie.digital/', label: 'Docs' },
  { href: 'https://www.qiewallet.me/', label: 'QIE Wallet' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0D1535] border-r border-white/5 py-6 px-3 fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-3 mb-8">
        <img
          src="https://raw.createusercontent.com/4c1916c8-5dfd-43c7-88fb-c7767562deef/"
          alt="QIFlow"
          className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-[#F6C453]/20"
        />
        <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#F6C453] to-[#B7791F]">
          QIFlow
        </span>
      </Link>

      {/* Main Nav */}
      <nav className="flex-1 space-y-1">
        <div className="px-3 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B9CC8]">
            Protocol
          </p>
        </div>
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-gradient-to-r from-[#B7791F]/20 to-[#F6C453]/10 text-[#F6C453] border border-[#F6C453]/20'
                  : 'text-[#8B9CC8] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={active ? 'text-[#F6C453]' : 'text-[#8B9CC8] group-hover:text-white'}>
                {item.icon}
              </span>
              {item.label}
              {active && <ChevronRight className="w-4 h-4 ml-auto text-[#F6C453]/60" />}
            </Link>
          );
        })}

        <div className="px-3 mt-6 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B9CC8]">
            QIE Ecosystem
          </p>
        </div>
        {external.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#8B9CC8] hover:text-white hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            {item.label}
          </a>
        ))}
      </nav>

      {/* Network Badge */}
      <div className="mt-auto px-3">
        <div className="rounded-xl bg-[#131B3D] border border-white/5 p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F6C453] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F6C453]" />
            </span>
            <span className="text-xs font-semibold text-[#F6C453]">QIE Mainnet</span>
          </div>
          <p className="text-[10px] text-[#8B9CC8]">Chain ID: 1990</p>
        </div>
      </div>
    </aside>
  );
}
