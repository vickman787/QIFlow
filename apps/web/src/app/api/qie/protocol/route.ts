import {
  NATIVE_QIE_ADDRESS,
  QIE_MAINNET_RPC,
  QIFLOW_CONTRACTS,
} from '@/lib/qiflow-contracts';

const GET_MARKET_DATA_SELECTOR = '0xa30c302d';
const GET_USER_SUPPLY_BALANCE_SELECTOR = '0xd32074d7';
const GET_USER_BORROW_BALANCE_SELECTOR = '0x888c21a1';
const GET_USER_ACCOUNT_DATA_SELECTOR = '0xbf92857c';
const GET_PENDING_REWARDS_SELECTOR = '0xf6ed2017';
const REWARDS_CLAIMED_TOPIC =
  '0xfc30cddea38e2bf4d6ea7d3f9ed3b6ad7f176419f4963bd81318067a4aee73fe';
const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
const WEI_PER_QIE = 1_000_000_000_000_000_000n;

function encodeAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function decodeWords(data: string) {
  const hex = data.replace(/^0x/, '');
  const words: bigint[] = [];
  for (let i = 0; i < hex.length; i += 64) {
    words.push(BigInt(`0x${hex.slice(i, i + 64)}`));
  }
  return words;
}

function formatUnits(value: bigint, decimals = 18, precision = 6) {
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
  return data.result as string;
}

async function ethCall(data: string, to: string = QIFLOW_CONTRACTS.QIFlowPool) {
  return rpcCall('eth_call', [
    {
      to,
      data,
    },
    'latest',
  ]);
}

interface RpcLog {
  data: string;
}

async function getClaimedRewards(userAddress: string) {
  const logs = (await rpcCall('eth_getLogs', [
    {
      address: QIFLOW_CONTRACTS.QIFlowRewards,
      fromBlock: '0x0',
      toBlock: 'latest',
      topics: [REWARDS_CLAIMED_TOPIC, `0x${encodeAddress(userAddress)}`],
    },
  ])) as unknown as RpcLog[];

  return logs.reduce((total, log) => total + BigInt(log.data), 0n);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (address && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: 'Invalid address' }, { status: 400 });
  }

  try {
    const nativeArg = encodeAddress(NATIVE_QIE_ADDRESS);
    const marketHex = await ethCall(`${GET_MARKET_DATA_SELECTOR}${nativeArg}`);
    const market = decodeWords(marketHex);

    const collateralFactor = market[2] ?? 0n;
    const totalSupply = market[3] ?? 0n;
    const totalBorrows = market[4] ?? 0n;
    const supplyRatePerSecond = market[6] ?? 0n;
    const borrowRatePerSecond = market[7] ?? 0n;
    const utilization = market[8] ?? 0n;
    const liquidity = totalSupply > totalBorrows ? totalSupply - totalBorrows : 0n;

    let userSupply = 0n;
    let userBorrow = 0n;
    let totalCollateralUSD = 0n;
    let totalBorrowUSD = 0n;
    let availableBorrowUSD = 0n;
    let healthFactor = 0n;
    let pendingRewards = 0n;
    let claimedRewards = 0n;
    if (address) {
      const userSupplyHex = await ethCall(
        `${GET_USER_SUPPLY_BALANCE_SELECTOR}${encodeAddress(address)}${nativeArg}`
      );
      userSupply = decodeWords(userSupplyHex)[0] ?? 0n;

      const userBorrowHex = await ethCall(
        `${GET_USER_BORROW_BALANCE_SELECTOR}${encodeAddress(address)}${nativeArg}`
      );
      userBorrow = decodeWords(userBorrowHex)[0] ?? 0n;

      const accountHex = await ethCall(`${GET_USER_ACCOUNT_DATA_SELECTOR}${encodeAddress(address)}`);
      const account = decodeWords(accountHex);
      totalCollateralUSD = account[0] ?? 0n;
      totalBorrowUSD = account[1] ?? 0n;
      availableBorrowUSD = account[2] ?? 0n;
      healthFactor = account[3] ?? 0n;

      const pendingRewardsHex = await ethCall(
        `${GET_PENDING_REWARDS_SELECTOR}${encodeAddress(address)}`,
        QIFLOW_CONTRACTS.QIFlowRewards
      );
      pendingRewards = decodeWords(pendingRewardsHex)[0] ?? 0n;

      try {
        claimedRewards = await getClaimedRewards(address);
      } catch (err) {
        console.warn('[qie/protocol] failed to fetch claimed rewards logs', err);
      }
    }

    return Response.json({
      qie: {
        collateralFactorPct: Number((collateralFactor * 10_000n) / WEI_PER_QIE) / 100,
        supplyAPYPct: Number((supplyRatePerSecond * SECONDS_PER_YEAR * 10_000n) / WEI_PER_QIE) / 100,
        borrowAPYPct: Number((borrowRatePerSecond * SECONDS_PER_YEAR * 10_000n) / WEI_PER_QIE) / 100,
        utilizationPct: Number((utilization * 10_000n) / WEI_PER_QIE) / 100,
        liquidityQIE: formatUnits(liquidity),
        totalSupplyQIE: formatUnits(totalSupply),
        totalBorrowsQIE: formatUnits(totalBorrows),
        userSupplyQIE: formatUnits(userSupply),
        userBorrowQIE: formatUnits(userBorrow),
        totalCollateralUSD: formatUnits(totalCollateralUSD),
        totalBorrowUSD: formatUnits(totalBorrowUSD),
        availableBorrowUSD: formatUnits(availableBorrowUSD),
        healthFactor: healthFactor === 2n ** 256n - 1n ? null : Number(healthFactor) / 1e18,
        pendingRewardsQIF: formatUnits(pendingRewards),
        claimedRewardsQIF: formatUnits(claimedRewards),
      },
    });
  } catch (err) {
    console.error('[qie/protocol]', err);
    return Response.json({ error: 'Failed to fetch protocol data' }, { status: 500 });
  }
}
