# QIFlow Protocol — Smart Contracts

Lending and borrowing protocol built on **QIE Blockchain** (EVM-compatible Layer 1).

---

## Contracts Overview

| Contract | Description |
|---|---|
| `QIFlowToken.sol` | QIF governance/rewards token (ERC20, 100M max supply) |
| `InterestRateModel.sol` | Jump rate model — calculates APY based on utilization |
| `QIFlowOracle.sol` | Admin price oracle (swap for Chainlink on mainnet V2) |
| `QIFlowPool.sol` | Core lending pool — supply, withdraw, borrow, repay, liquidate |
| `QIFlowRewards.sol` | Distributes QIF to suppliers and borrowers |
| `QIFlowLens.sol` | Read-only aggregator for frontend data |

---

## QIE Network Details

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Mainnet | 1990 | https://rpc2mainnet.qie.digital | https://mainnet.qie.digital/ |
| Testnet | 1983 | https://rpc1testnet.qie.digital/ | https://testnet.qie.digital/ |

---

## Setup

### 1. Install dependencies

```bash
cd qiflow-contracts
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and paste your private key
```

### 3. Get testnet QIE

Visit **https://www.qie.digital/faucet** — connect MetaMask with QIE Testnet (Chain ID 1983) and request tokens.

---

## Compile

```bash
npm run compile
```

---

## Test (local Hardhat network — no tokens needed)

```bash
npm run test
```

For detailed output:
```bash
npm run test:verbose
```

---

## Deploy

### To Testnet first (recommended)

```bash
npm run deploy:testnet
```

### To Mainnet (after testnet is working)

```bash
npm run deploy:mainnet
```

Deployed addresses are saved automatically to `deployedAddresses.json`.

---

## After Deployment

1. Open `deployedAddresses.json`
2. Copy all contract addresses
3. Give them to the QIFlow frontend developer (or paste into the app)
4. The frontend will instantly pull live APYs, liquidity, and positions

---

## Deployed Contract Addresses

Fill this in after deployment:

| Contract | Testnet | Mainnet |
|---|---|---|
| QIFlowToken | — | — |
| InterestRateModel | — | — |
| QIFlowOracle | — | — |
| QIFlowPool | — | — |
| QIFlowRewards | — | — |
| QIFlowLens | — | — |

---

## Architecture Notes

- **No upgradeable proxies** — contracts are immutable for maximum trustlessness
- **ReentrancyGuard** on all fund-moving functions
- **Pausable** on QIFlowPool for emergency stops
- **Over-collateralized** — users can only borrow up to their collateral factor
- **qTokens** — internal receipt tokens (not ERC20) that appreciate as interest accrues
- **Health Factor** — must stay ≥ 1.0 or position is liquidatable

---

## Security Notes

- Never share your `.env` file or private key
- Always test on testnet before mainnet
- The oracle is admin-controlled for V1 — replace with Chainlink for V2
- Audit recommended before handling significant TVL
