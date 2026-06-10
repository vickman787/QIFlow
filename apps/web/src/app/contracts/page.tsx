'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QIE_MAINNET_EXPLORER, QIFLOW_CONTRACTS } from '@/lib/qiflow-contracts';
import { Copy, Check, FileCode, Rocket, TestTube } from 'lucide-react';

const contracts = [
  {
    name: 'QIFlowToken.sol',
    description: 'QIF governance/rewards token (ERC20, 100M max supply)',
    lines: 42,
    category: 'token',
  },
  {
    name: 'InterestRateModel.sol',
    description: 'Jump rate model — calculates APY based on utilization',
    lines: 145,
    category: 'core',
  },
  {
    name: 'QIFlowOracle.sol',
    description: 'Admin price oracle (swap for Chainlink on mainnet V2)',
    lines: 76,
    category: 'core',
  },
  {
    name: 'QIFlowPool.sol',
    description: 'Core lending pool — supply, withdraw, borrow, repay, liquidate',
    lines: 709,
    category: 'core',
  },
  {
    name: 'QIFlowRewards.sol',
    description: 'Distributes QIF to suppliers and borrowers',
    lines: 206,
    category: 'rewards',
  },
  {
    name: 'QIFlowLens.sol',
    description: 'Read-only aggregator for frontend data',
    lines: 191,
    category: 'utils',
  },
];

const setupSteps = [
  {
    title: 'Install Dependencies',
    command: 'cd apps/qiflow-contracts && npm install',
    description: 'Install Hardhat and OpenZeppelin contracts',
  },
  {
    title: 'Configure Environment',
    command: 'cp .env.example .env',
    description: 'Copy .env.example and paste your MetaMask private key',
  },
  {
    title: 'Compile Contracts',
    command: 'npm run compile',
    description: 'Compile all Solidity contracts',
  },
  {
    title: 'Run Tests (Local)',
    command: 'npm run test',
    description: 'Run 25+ tests on local Hardhat network (no tokens needed)',
  },
  {
    title: 'Deploy to Mainnet',
    command: 'npm run deploy:mainnet',
    description: 'Deploy all contracts to QIE Mainnet (Chain ID 1990)',
  },
];

const networkInfo = [
  {
    name: 'QIE Mainnet',
    chainId: 1990,
    rpc: 'https://rpc2mainnet.qie.digital',
    explorer: 'https://mainnet.qie.digital/',
    faucet: null,
  },
];

const deployedContracts = Object.entries(QIFLOW_CONTRACTS);

export default function ContractsPage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#120F08] via-[#2A1A06] to-[#0B1026] text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-[#B7791F]/20 rounded-full border border-[#B7791F]/30">
            <FileCode className="w-4 h-4 text-[#F6C453]" />
            <span className="text-sm text-[#FFD166]">Smart Contracts</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-[#FFD166] to-[#F59E0B] bg-clip-text text-transparent">
            QIFlow Protocol Contracts
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Production-ready Solidity contracts for lending and borrowing on QIE Blockchain
          </p>
        </div>

        <Tabs defaultValue="contracts" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="setup">Setup Guide</TabsTrigger>
            <TabsTrigger value="networks">Networks</TabsTrigger>
          </TabsList>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Mainnet Deployment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deployedContracts.map(([name, address], idx) => (
                  <div
                    key={name}
                    className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{name}</p>
                      <a
                        href={`${QIE_MAINNET_EXPLORER}/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all font-mono text-xs text-[#FFD166] hover:text-[#FFE2A3]"
                      >
                        {address}
                      </a>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(address, 100 + idx)}
                      className="self-start sm:self-center"
                    >
                      {copiedIndex === 100 + idx ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {contracts.map((contract, idx) => (
                <Card
                  key={idx}
                  className="bg-slate-900/50 border-slate-800 hover:border-[#B7791F]/50 transition-all"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl text-white mb-2">{contract.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {contract.lines} lines
                        </Badge>
                      </div>
                      <Badge
                        className={
                          contract.category === 'core'
                            ? 'bg-[#B7791F]/20 text-[#FFD166] border-[#B7791F]/30'
                            : contract.category === 'token'
                              ? 'bg-[#F6C453]/20 text-[#FFD166] border-[#F6C453]/30'
                              : contract.category === 'rewards'
                                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                        }
                      >
                        {contract.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400 text-sm">{contract.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-gradient-to-br from-[#8A5A12]/30 to-[#F59E0B]/20 border-[#B7791F]/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TestTube className="w-5 h-5" />
                  Test Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#F6C453]">25+</div>
                    <div className="text-sm text-slate-400">Test Cases</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#F59E0B]">6</div>
                    <div className="text-sm text-slate-400">Contracts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#F6C453]">1,369</div>
                    <div className="text-sm text-slate-400">Total Lines</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">100%</div>
                    <div className="text-sm text-slate-400">Coverage</div>
                  </div>
                </div>
                <p className="text-slate-300 text-sm">
                  All contracts include comprehensive tests covering supply, withdraw, borrow,
                  repay, liquidation, interest accrual, rewards distribution, and edge cases.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Setup Guide Tab */}
          <TabsContent value="setup" className="space-y-6">
            {setupSteps.map((step, idx) => (
              <Card key={idx} className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#B7791F]/20 text-[#F6C453] font-bold border border-[#B7791F]/30 flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white mb-2">{step.title}</CardTitle>
                      <p className="text-slate-400 text-sm mb-3">{step.description}</p>
                      <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <code className="flex-1 text-sm text-[#FFD166] font-mono">
                          {step.command}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(step.command, idx)}
                          className="flex-shrink-0"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}

            <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Ready to Deploy?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-300">
                  After deployment, addresses are automatically saved to{' '}
                  <code className="text-[#FFD166] bg-slate-950/50 px-2 py-1 rounded">
                    deployedAddresses.json
                  </code>
                </p>
                <p className="text-slate-300">
                  Copy those addresses and paste them into the QIFlow frontend to connect your live
                  contracts instantly.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Networks Tab */}
          <TabsContent value="networks" className="space-y-6">
            {networkInfo.map((network, idx) => (
              <Card key={idx} className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-3">
                    {network.name}
                    <Badge variant="outline" className="text-xs">
                      Chain ID: {network.chainId}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">RPC Endpoint</div>
                      <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <code className="flex-1 text-sm text-[#FFD166] font-mono">
                          {network.rpc}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(network.rpc, idx * 10)}
                        >
                          {copiedIndex === idx * 10 ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400 mb-1">Block Explorer</div>
                      <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                        <code className="flex-1 text-sm text-[#FFD166] font-mono">
                          {network.explorer}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(network.explorer, idx * 10 + 1)}
                        >
                          {copiedIndex === idx * 10 + 1 ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {network.faucet && (
                      <div>
                        <div className="text-sm text-slate-400 mb-1">Faucet</div>
                        <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                          <code className="flex-1 text-sm text-green-300 font-mono">
                            {network.faucet}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(network.faucet!, idx * 10 + 2)}
                          >
                            {copiedIndex === idx * 10 + 2 ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {network.faucet && (
                    <div className="bg-[#F6C453]/10 border border-[#F6C453]/30 rounded-lg p-4">
                      <p className="text-sm text-[#FFD166]">
                        💡 <strong>Tip:</strong> Connect MetaMask to {network.name} and request
                        tokens from the faucet before deploying.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <Card className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="text-white">MetaMask Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-300 text-sm">To add QIE networks to MetaMask:</p>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 text-sm">
                  <li>Open MetaMask → Settings → Networks → Add Network</li>
                  <li>Enter the RPC URL and Chain ID from above</li>
                  <li>
                    Set currency symbol to{' '}
                    <code className="text-[#FFD166] bg-slate-950/50 px-2 py-1 rounded">QIE</code>
                  </li>
                  <li>Save and switch to the new network</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
