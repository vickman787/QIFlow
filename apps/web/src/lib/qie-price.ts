import { NATIVE_QIE_ADDRESS, QIE_MAINNET_RPC, QIFLOW_CONTRACTS } from '@/lib/qiflow-contracts';

const GET_PRICE_SELECTOR = '0x41976e09';
const USD_PRICE_DECIMALS = 8;
const USD_PRICE_SCALE = 100_000_000n;

export type QiePriceSource = 'coingecko' | 'coinmarketcap' | 'oracle' | 'unavailable';

export interface QiePrice {
  priceUsd8: bigint;
  priceUSD: string | null;
  source: QiePriceSource;
  sourceId?: string;
}

export function encodeAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

export function decodeWord(data: string) {
  return BigInt(data.replace(/^0x/, '').slice(0, 64) || '0');
}

export function formatUnits(value: bigint, decimals = 18, precision = 12) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const fractionText = fraction.toString().padStart(decimals, '0').slice(0, precision);
  return `${whole}.${fractionText}`.replace(/\.?0+$/, '');
}

export function valueUsd(amountWei: bigint, priceUsd8: bigint) {
  return (amountWei * priceUsd8) / USD_PRICE_SCALE;
}

export function usdToQie(usdValue: bigint, priceUsd8: bigint) {
  if (priceUsd8 === 0n) return 0n;
  return (usdValue * USD_PRICE_SCALE) / priceUsd8;
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
  return data.result as string;
}

async function getOraclePrice(): Promise<QiePrice> {
  const result = await rpcCall('eth_call', [
    {
      to: QIFLOW_CONTRACTS.QIFlowOracle,
      data: `${GET_PRICE_SELECTOR}${encodeAddress(NATIVE_QIE_ADDRESS)}`,
    },
    'latest',
  ]);
  const priceUsd8 = decodeWord(result);

  return {
    priceUsd8,
    priceUSD: formatUnits(priceUsd8, USD_PRICE_DECIMALS, USD_PRICE_DECIMALS),
    source: 'oracle',
    sourceId: QIFLOW_CONTRACTS.QIFlowOracle,
  };
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Price API error: ${res.status}`);
  return res.json();
}

function decimalUsdToUsd8(value: number | string) {
  const text =
    typeof value === 'number' ? value.toFixed(12) : value.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('Invalid USD price');

  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * USD_PRICE_SCALE + BigInt(fraction.padEnd(USD_PRICE_DECIMALS, '0').slice(0, USD_PRICE_DECIMALS));
}

async function getCoinGeckoPrice(): Promise<QiePrice | null> {
  const coinId = process.env.QIE_COINGECKO_ID?.trim();
  if (!coinId) return null;

  const baseUrl = process.env.COINGECKO_API_BASE_URL?.trim() || 'https://api.coingecko.com/api/v3';
  const apiKey = process.env.COINGECKO_API_KEY?.trim() || process.env.QIE_COINGECKO_API_KEY?.trim();
  const url = `${baseUrl.replace(/\/$/, '')}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;
  const headers: Record<string, string> = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};
  const data = await fetchJson(url, headers);
  const usd = data?.[coinId]?.usd;

  if (typeof usd !== 'number') throw new Error('CoinGecko did not return a QIE USD price');

  const priceUsd8 = decimalUsdToUsd8(usd);
  return {
    priceUsd8,
    priceUSD: formatUnits(priceUsd8, USD_PRICE_DECIMALS, USD_PRICE_DECIMALS),
    source: 'coingecko',
    sourceId: coinId,
  };
}

function extractCmcUsd(data: unknown) {
  if (!data || typeof data !== 'object' || !('data' in data)) return null;

  const entries = Object.values((data as { data: Record<string, unknown> }).data).flatMap((entry) =>
    Array.isArray(entry) ? entry : [entry]
  );
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !('quote' in entry)) continue;
    const quote = (entry as { quote?: { USD?: { price?: unknown } } }).quote;
    const price = quote?.USD?.price;
    if (typeof price === 'number') return price;
  }

  return null;
}

async function getCoinMarketCapPrice(): Promise<QiePrice | null> {
  const apiKey = process.env.COINMARKETCAP_API_KEY?.trim() || process.env.QIE_CMC_API_KEY?.trim();
  if (!apiKey) return null;

  const cmcId = process.env.QIE_CMC_ID?.trim();
  const symbol = process.env.QIE_CMC_SYMBOL?.trim() || 'QIE';
  const query = cmcId ? `id=${encodeURIComponent(cmcId)}` : `symbol=${encodeURIComponent(symbol)}`;
  const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?${query}&convert=USD`;
  const data = await fetchJson(url, { 'X-CMC_PRO_API_KEY': apiKey });
  const usd = extractCmcUsd(data);

  if (typeof usd !== 'number') throw new Error('CoinMarketCap did not return a QIE USD price');

  const priceUsd8 = decimalUsdToUsd8(usd);
  return {
    priceUsd8,
    priceUSD: formatUnits(priceUsd8, USD_PRICE_DECIMALS, USD_PRICE_DECIMALS),
    source: 'coinmarketcap',
    sourceId: cmcId || symbol,
  };
}

export async function getQiePrice(): Promise<QiePrice> {
  const preferredSource = process.env.QIE_PRICE_SOURCE?.trim().toLowerCase();
  const externalSources =
    preferredSource === 'coinmarketcap'
      ? [getCoinMarketCapPrice, getCoinGeckoPrice]
      : [getCoinGeckoPrice, getCoinMarketCapPrice];

  if (preferredSource === 'oracle') {
    try {
      return await getOraclePrice();
    } catch (err) {
      console.warn('[qie-price] oracle price source failed', err);
      return {
        priceUsd8: 0n,
        priceUSD: null,
        source: 'unavailable',
      };
    }
  }

  for (const getExternalPrice of externalSources) {
    try {
      const price = await getExternalPrice();
      if (price) return price;
    } catch (err) {
      console.warn('[qie-price] external price source failed', err);
    }
  }

  try {
    return await getOraclePrice();
  } catch (err) {
    console.warn('[qie-price] oracle price source failed', err);
    return {
      priceUsd8: 0n,
      priceUSD: null,
      source: 'unavailable',
    };
  }
}
