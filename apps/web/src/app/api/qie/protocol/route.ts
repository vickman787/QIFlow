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
const GET_PRICE_SELECTOR = '0x41976e09';
const QIF_TOKEN_SELECTOR = '0x911815a0';
const REWARDS_CLAIMED_TOPIC =
  '0xfc30cddea38e2bf4d6ea7d3f9ed3b6ad7f176419f4963bd81318067a4aee73fe';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n;
const WEI_PER_QIE = 1_000_000_000_000_000_000n;
const LOG_LOOKBACK_BLOCKS = 100_000n;
const LOG_CHUNK_SIZE = 9_999n;

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

function decodeAddress(data: string) {
  const word = data.replace(/^0x/, '').slice(-40);
  return `0x${word}`;
}

function formatUnits(value: bigint, decimals = 18, precision = 12) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const fractionText = fraction.toString().padStart(decimals, '0').slice(0, precision);
  return `${whole}.${fractionText}`.replace(/\.?0+$/, '');
}

function valueUsd(amountWei: bigint, priceUsd8: bigint) {
  return (amountWei * priceUsd8) / 100_000_000n;
}

function usdToQie(usdValue: bigint, priceUsd8: bigint) {
  if (priceUsd8 === 0n) return 0n;
  return (usdValue * 100_000_000n) / priceUsd8;
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

interface LogFilter {
  address: string;
  fromBlock: string;
  toBlock: string;
  topics: string[];
}

async function getLogs(filter: LogFilter) {
  const latestHex = await rpcCall('eth_blockNumber');
  const latest = BigInt(latestHex);

  try {
    const logs = (await rpcCall('eth_getLogs', [filter])) as unknown as RpcLog[];
    if (logs.length > 0 || filter.fromBlock !== '0x0') return logs;
    return [];
  } catch {
    const logs: RpcLog[] = [];
    const start = latest > LOG_LOOKBACK_BLOCKS ? latest - LOG_LOOKBACK_BLOCKS : 0n;

    for (let from = start; from <= latest; from += LOG_CHUNK_SIZE + 1n) {
      const to = from + LOG_CHUNK_SIZE > latest ? latest : from + LOG_CHUNK_SIZE;
      const chunk = (await rpcCall('eth_getLogs', [
        {
          ...filter,
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        },
      ])) as unknown as RpcLog[];
      logs.push(...chunk);
    }

    return logs;
  }
}

async function getClaimedRewardsFromRewardEvents(userAddress: string) {
  const logs = await getLogs({
    address: QIFLOW_CONTRACTS.QIFlowRewards,
    fromBlock: '0x0',
    toBlock: 'latest',
    topics: [REWARDS_CLAIMED_TOPIC, `0x${encodeAddress(userAddress)}`],
  });

  return logs.reduce((total, log) => total + BigInt(log.data), 0n);
}

async function getRewardTokenAddress() {
  const tokenHex = await ethCall(QIF_TOKEN_SELECTOR, QIFLOW_CONTRACTS.QIFlowRewards);
  return decodeAddress(tokenHex);
}

async function getClaimedRewardsFromTokenTransfers(userAddress: string, tokenAddress: string) {
  const logs = await getLogs({
    address: tokenAddress,
    fromBlock: '0x0',
    toBlock: 'latest',
    topics: [
      TRANSFER_TOPIC,
      `0x${encodeAddress(QIFLOW_CONTRACTS.QIFlowRewards)}`,
      `0x${encodeAddress(userAddress)}`,
    ],
  });

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
    const qiePriceHex = await ethCall(
      `${GET_PRICE_SELECTOR}${nativeArg}`,
      QIFLOW_CONTRACTS.QIFlowOracle
    );
    const qiePriceUsd8 = decodeWords(qiePriceHex)[0] ?? 0n;
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
        const rewardTokenAddress = await getRewardTokenAddress();
        const [rewardEventTotal, tokenTransferTotal] = await Promise.all([
          getClaimedRewardsFromRewardEvents(address),
          getClaimedRewardsFromTokenTransfers(address, rewardTokenAddress),
        ]);
        claimedRewards =
          tokenTransferTotal > rewardEventTotal ? tokenTransferTotal : rewardEventTotal;
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
        qiePriceUSD: formatUnits(qiePriceUsd8, 8, 8),
        liquidityQIE: formatUnits(liquidity),
        liquidityUSD: formatUnits(valueUsd(liquidity, qiePriceUsd8)),
        totalSupplyQIE: formatUnits(totalSupply),
        totalSupplyUSD: formatUnits(valueUsd(totalSupply, qiePriceUsd8)),
        totalBorrowsQIE: formatUnits(totalBorrows),
        totalBorrowsUSD: formatUnits(valueUsd(totalBorrows, qiePriceUsd8)),
        userSupplyQIE: formatUnits(userSupply, 18, 18),
        userSupplyUSD: formatUnits(valueUsd(userSupply, qiePriceUsd8)),
        userBorrowQIE: formatUnits(userBorrow, 18, 18),
        userBorrowUSD: formatUnits(valueUsd(userBorrow, qiePriceUsd8)),
        totalCollateralUSD: formatUnits(totalCollateralUSD),
        totalBorrowUSD: formatUnits(totalBorrowUSD),
        availableBorrowUSD: formatUnits(availableBorrowUSD),
        availableBorrowQIE: formatUnits(usdToQie(availableBorrowUSD, qiePriceUsd8)),
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
