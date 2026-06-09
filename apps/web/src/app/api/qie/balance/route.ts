import { QIE_MAINNET_RPC } from '@/lib/qiflow-contracts';

async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetch(QIE_MAINNET_RPC, {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: 'Invalid address' }, { status: 400 });
  }

  try {
    const [balanceHex, txCountHex] = await Promise.all([
      rpcCall('eth_getBalance', [address, 'latest']),
      rpcCall('eth_getTransactionCount', [address, 'latest']),
    ]);

    const balanceWei = BigInt(balanceHex);
    const balanceQIE = Number(balanceWei) / 1e18;
    const txCount = parseInt(txCountHex, 16);

    return Response.json({
      address,
      balanceWei: balanceHex,
      balanceQIE: balanceQIE.toFixed(6),
      txCount,
    });
  } catch (err) {
    console.error('[qie/balance]', err);
    return Response.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
