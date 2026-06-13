# QIFlow

QIFlow is a DeFi lending protocol built for QIE Blockchain. The app lets users
supply native QIE, borrow against collateral, track positions, and claim QIF
rewards from verified smart contracts on QIE Mainnet.

## What Is In This Repo

| Path | Description |
| --- | --- |
| `apps/web` | Next.js web app for the QIFlow protocol |
| `apps/qiflow-contracts` | Solidity smart contracts, deployment scripts, and tests |
| `apps/mobile` | Mobile app workspace |
| `publisher` | Publishing/support tooling |

## Live Network

| Item | Value |
| --- | --- |
| Network | QIE Mainnet |
| Chain ID | `1990` |
| RPC | `https://rpc2mainnet.qie.digital` |
| Explorer | `https://mainnet.qie.digital` |

## Verified Mainnet Contracts

| Contract | Address |
| --- | --- |
| QIFlowToken | `0x8aff94408452a31e9D566468cf76fCA155c7538F` |
| InterestRateModel | `0xBc59a7Fe22f2D56A6F7F0B7ab996C46c94Bbeb91` |
| QIFlowOracle | `0xA51482Fdd51355165dd81e770EAA072354831C97` |
| QIFlowPool v2 | `0x06A47cAdA87cC2ef4337678927493cf1287b68Ea` |
| QIFlowRewards v2 | `0xDFbb9BD9E2093EFE73388f1Ef83194FeF481D3c4` |
| QIFlowLens v2 | `0x5762Cc5fEc86A71aff70E1D12bCd3bE4062d2DF1` |

## Protocol Features

- Supply native QIE to earn lending yield.
- Borrow against supplied collateral.
- Track health factor, borrow limits, rewards, and market data.
- Claim QIF rewards from the rewards contract.
- Read protocol state through a frontend-friendly Lens contract.

## Web App Setup

Install dependencies from the repo root:

```bash
corepack enable
yarn install
```

Run the web app locally:

```bash
cd apps/web
yarn dev
```

The live web app is available at:

```txt
https://qiflow-rho.vercel.app/
```

### QIE Price Source

The web app reads QIE market price from CoinGecko or CoinMarketCap when those
sources are configured. If neither external source returns a price, it falls
back to the on-chain `QIFlowOracle` so USD values still render.

Use CoinGecko:

```txt
QIE_PRICE_SOURCE=coingecko
QIE_COINGECKO_ID=<coingecko-coin-id>
```

Use CoinMarketCap:

```txt
QIE_PRICE_SOURCE=coinmarketcap
COINMARKETCAP_API_KEY=<coinmarketcap-api-key>
QIE_CMC_SYMBOL=QIE
```

If CoinMarketCap gives QIE a numeric asset id, prefer:

```txt
QIE_CMC_ID=<coinmarketcap-asset-id>
```

## Smart Contracts

Go to the contracts workspace:

```bash
cd apps/qiflow-contracts
```

Compile:

```bash
npx hardhat compile
```

Run tests:

```bash
npx hardhat test
```

Deploy v2 contracts to QIE Mainnet:

```bash
npx hardhat run scripts/deploy-v2.js --network qie_mainnet
```

The v2 deployment output is saved in:

```txt
apps/qiflow-contracts/deployedAddresses.v2.json
```

## Contract Verification

The contracts are compiled with:

```txt
Solidity: 0.8.20
Optimizer: enabled
Optimizer runs: 200
viaIR: true
EVM version: paris
License: MIT
```

Use QIE Explorer's Solidity Standard JSON input verification method for best
results.

## Security Notes

- The contracts are immutable and do not use upgradeable proxies.
- `QIFlowPool` uses `ReentrancyGuard` and `Pausable`.
- The oracle is admin-controlled and should be replaced with decentralized
  feeds when reliable QIE market feeds are available.
- Do not use private keys from `.env` in production machines or public commits.
- Independent audits are recommended before significant TVL.

## License

MIT
