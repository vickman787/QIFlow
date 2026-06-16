'use client';

import { Coins, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const QUSDC_SWAP_URL = 'https://www.swap.dex.qie.digital/swap';

interface GetQusdcButtonProps {
  className?: string;
  compact?: boolean;
}

export function GetQusdcButton({ className, compact = false }: GetQusdcButtonProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#B7791F] to-[#F6C453] px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90'
          }
        >
          <Coins className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          Get QUSDC
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[min(1040px,calc(100vw-1.5rem))] border border-[#F6C453]/20 bg-[#0B0A07] p-0 text-white">
        <DialogHeader className="border-b border-white/10 px-4 py-3 pr-12">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-bold text-white">Get QUSDC</DialogTitle>
              <DialogDescription className="text-xs text-[#B8B2A6]">
                Swap on QIE DEX without leaving QIFlow.
              </DialogDescription>
            </div>
            <a
              href={QUSDC_SWAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#F6C453] transition-colors hover:bg-white/5"
            >
              Open DEX <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </DialogHeader>
        <div className="h-[min(760px,calc(100vh-9rem))] bg-black">
          <iframe
            title="QIE DEX swap"
            src={QUSDC_SWAP_URL}
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write; encrypted-media"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

