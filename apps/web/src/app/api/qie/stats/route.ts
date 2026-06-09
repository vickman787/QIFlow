import { QIE_MAINNET_RPC } from '@/lib/qiflow-contracts';

async function rpcCall(rpc: string, method: string, params: unknown[] = []) {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

export async function GET() {
  try {
    const [blockHex, gasPriceHex, chainIdHex] = await Promise.all([
      rpcCall(QIE_MAINNET_RPC, 'eth_blockNumber').catch(() => null),
      rpcCall(QIE_MAINNET_RPC, 'eth_gasPrice').catch(() => null),
      rpcCall(QIE_MAINNET_RPC, 'eth_chainId').catch(() => null),
    ]);

    const blockNumber = blockHex ? parseInt(blockHex, 16) : null;
    const gasPriceGwei = gasPriceHex ? (parseInt(gasPriceHex, 16) / 1e9).toFixed(4) : null;
    const chainId = chainIdHex ? parseInt(chainIdHex, 16) : null;

    return Response.json({
      mainnet: {
        rpc: QIE_MAINNET_RPC,
        chainId: chainId ?? 1990,
        blockNumber,
        gasPriceGwei,
        blockTime: 3.6,
        symbol: 'QIE',
        decimals: 18,
        explorerUrl: 'https://mainnet.qie.digital/',
        online: blockNumber !== null,
      },
    });
  } catch (err) {
    console.error('[qie/stats]', err);
    return Response.json({ error: 'Failed to fetch QIE network stats' }, { status: 500 });
  }
}
