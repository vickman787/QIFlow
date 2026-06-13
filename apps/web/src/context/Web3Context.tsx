'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { QIE_MAINNET_RPC } from '@/lib/qiflow-contracts';
import { toast } from 'sonner';

export const QIE_MAINNET = {
  chainId: '0x7C6', // 1990
  chainName: 'QIE Mainnet',
  nativeCurrency: { name: 'QIE', symbol: 'QIE', decimals: 18 },
  rpcUrls: [QIE_MAINNET_RPC],
  blockExplorerUrls: ['https://mainnet.qie.digital/'],
  iconUrls: ['https://qiflow-rho.vercel.app/qiflow-x-profile-picture.png'],
};

function getEthereum() {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

interface Web3State {
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  qieBalance: string | null;
  qieBalanceUSD: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToQIE: () => Promise<void>;
  addQIENetwork: () => Promise<void>;
}

const Web3Context = createContext<Web3State | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qieBalance, setQieBalance] = useState<string | null>(null);
  const [qieBalanceUSD, setQieBalanceUSD] = useState<string | null>(null);

  const isConnected = !!account;
  const isCorrectNetwork = chainId === 1990;

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const res = await fetch(`/api/qie/balance?address=${addr}`);
      if (res.ok) {
        const data = await res.json();
        setQieBalance(data.balanceQIE);
        setQieBalanceUSD(data.balanceUSD);
      }
    } catch {
      // silent
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      toast.error('MetaMask not found. Please install MetaMask to continue.');
      return;
    }
    setIsConnecting(true);
    try {
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const chainHex = (await eth.request({ method: 'eth_chainId' })) as string;
      const currentChain = parseInt(chainHex, 16);
      setAccount(accounts[0]);
      setChainId(currentChain);

      if (currentChain !== 1990) {
        toast.info('Please switch to QIE Mainnet for the best experience.');
      } else {
        await fetchBalance(accounts[0]);
        toast.success(`Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    } catch (err: unknown) {
      const error = err as { code?: number };
      if (error.code === 4001) {
        toast.error('Connection rejected by user.');
      } else {
        toast.error('Failed to connect wallet.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [fetchBalance]);

  const disconnect = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setQieBalance(null);
    setQieBalanceUSD(null);
    toast.info('Wallet disconnected.');
  }, []);

  const addQIENetwork = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [QIE_MAINNET],
      });
      toast.success('QIE Mainnet added to MetaMask!');
    } catch {
      toast.error('Failed to add QIE network.');
    }
  }, []);

  const switchToQIE = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) return;
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: QIE_MAINNET.chainId }],
      });
    } catch (err: unknown) {
      const error = err as { code?: number };
      if (error.code === 4902) {
        await addQIENetwork();
      }
    }
  }, [addQIENetwork]);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;

    const handleAccountsChanged = (rawAccounts: unknown) => {
      const accounts = rawAccounts as string[];
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
        fetchBalance(accounts[0]);
      }
    };

    const handleChainChanged = (rawChain: unknown) => {
      setChainId(parseInt(rawChain as string, 16));
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    // Auto-reconnect if previously connected
    eth.request({ method: 'eth_accounts' }).then((rawAccounts) => {
      const accounts = rawAccounts as string[];
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const innerEth = getEthereum();
        if (!innerEth) return;
        innerEth.request({ method: 'eth_chainId' }).then((rawHex) => {
          const id = parseInt(rawHex as string, 16);
          setChainId(id);
          if (id === 1990) fetchBalance(accounts[0]);
        });
      }
    });

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect, fetchBalance]);

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        isConnecting,
        isConnected,
        isCorrectNetwork,
        qieBalance,
        qieBalanceUSD,
        connect,
        disconnect,
        switchToQIE,
        addQIENetwork,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error('useWeb3 must be used inside Web3Provider');
  return ctx;
}
