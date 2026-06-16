import { QIE_MAINNET_RPC } from '@/lib/qiflow-contracts';
import { QUSDC_TOKEN } from '@/lib/supported-assets';

const BALANCE_OF_SELECTOR = '0x70a08231';

function encodeAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function formatUnits(value: bigint, decimals: number, precision = decimals) {
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
    const qusdcBalanceHex = await rpcCall('eth_call', [
      {
        to: QUSDC_TOKEN.address,
        data: `${BALANCE_OF_SELECTOR}${encodeAddress(address)}`,
      },
      'latest',
    ]).catch((err) => {
      console.warn('[qie/balance] failed to fetch QUSDC balance', err);
      return '0x0';
    });

    const balanceWei = BigInt(balanceHex);
    const qusdcBalanceUnits = BigInt(qusdcBalanceHex);
    const balanceQUSDC = formatUnits(qusdcBalanceUnits, QUSDC_TOKEN.decimals);
    const balanceQIE = Number(balanceWei) / 1e18;
    const txCount = parseInt(txCountHex, 16);

    return Response.json({
      address,
      balanceWei: balanceHex,
      balanceQIE: balanceQIE.toFixed(6),
      balanceQUSDC,
      tokens: {
        qusdc: {
          ...QUSDC_TOKEN,
          balance: balanceQUSDC,
          balanceUnits: qusdcBalanceHex,
          valueUSD: Number.parseFloat(balanceQUSDC || '0') * QUSDC_TOKEN.priceUSD,
        },
      },
      txCount,
    });
  } catch (err) {
    console.error('[qie/balance]', err);
    return Response.json({ error: 'Failed to fetch balance' }, { status: 500 });
  }
}
