import { NATIVE_QIE_ADDRESS, QIE_MAINNET_RPC, QIFLOW_CONTRACTS } from '@/lib/qiflow-contracts';

const GET_PRICE_SELECTOR = '0x41976e09';

function encodeAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function decodeWord(data: string) {
  return BigInt(data.replace(/^0x/, '').slice(0, 64) || '0');
}

function formatUnits(value: bigint, decimals = 18, precision = 12) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const fractionText = fraction.toString().padStart(decimals, '0').slice(0, precision);
  return `${whole}.${fractionText}`.replace(/\.?0+$/, '');
}

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

async function getQiePriceUsd8() {
  const result = await rpcCall('eth_call', [
    {
      to: QIFLOW_CONTRACTS.QIFlowOracle,
      data: `${GET_PRICE_SELECTOR}${encodeAddress(NATIVE_QIE_ADDRESS)}`,
    },
    'latest',
  ]);
  return decodeWord(result);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: 'Invalid address' }, { status: 400 });
  }

  try {
    const [balanceHex, txCountHex, qiePriceUsd8] = await Promise.all([
      rpcCall('eth_getBalance', [address, 'latest']),
      rpcCall('eth_getTransactionCount', [address, 'latest']),
      getQiePriceUsd8(),
    ]);

    const balanceWei = BigInt(balanceHex);
    const balanceQIE = Number(balanceWei) / 1e18;
    const balanceUsd = (balanceWei * qiePriceUsd8) / 100_000_000n;
    const txCount = parseInt(txCountHex, 16);

    return Response.json({
      address,
      balanceWei: balanceHex,
      balanceQIE: balanceQIE.toFixed(6),
      qiePriceUSD: formatUnits(qiePriceUsd8, 8, 8),
      balanceUSD: formatUnits(balanceUsd),
      txCount,
    });
  } catch (err) {
    console.error('[qie/balance]', err);
    return Response.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
