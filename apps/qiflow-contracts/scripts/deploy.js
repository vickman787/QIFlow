const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────────────────────
// Adjust these before deploying
const CONFIG = {
  // Collateral factors (75% for QIE, 80% for stablecoins)
  QIE_COLLATERAL_FACTOR: ethers.parseEther('0.75'), // 75%
  USDC_COLLATERAL_FACTOR: ethers.parseEther('0.80'), // 80%
  WBTC_COLLATERAL_FACTOR: ethers.parseEther('0.70'), // 70%

  // Reserve factor (10% of interest goes to protocol reserves)
  RESERVE_FACTOR: ethers.parseEther('0.10'), // 10%

  // Interest Rate Model (annualized, scaled 1e18)
  BASE_RATE_PER_YEAR: ethers.parseEther('0.02'), // 2% base rate
  MULTIPLIER_PER_YEAR: ethers.parseEther('0.10'), // 10% slope below kink
  JUMP_MULTIPLIER_PER_YEAR: ethers.parseEther('1.00'), // 100% slope above kink
  KINK: ethers.parseEther('0.80'), // 80% utilization kink

  // Initial oracle prices in USD (8 decimal precision)
  QIE_PRICE_USD: 50_000_000, // $0.50 — update to real market price
  USDC_PRICE_USD: 100_000_000, // $1.00 (stablecoin)
  WBTC_PRICE_USD: 6_500_000_000_000, // $65,000 — update to real BTC price

  // Reward speeds (QIF per second per market)
  QIE_SUPPLY_REWARD_SPEED: ethers.parseEther('0.001'), // 0.001 QIF/sec
  QIE_BORROW_REWARD_SPEED: ethers.parseEther('0.0005'),
};
// ───────────────────────────────────────────────────────────────────────────

const NATIVE_QIE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║          QIFlow Protocol Deployment              ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n📡 Network:   ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👛 Deployer:  ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance:   ${ethers.formatEther(balance)} QIE\n`);

  if (balance < ethers.parseEther('0.1')) {
    console.warn('⚠️  WARNING: Low balance. Make sure you have enough QIE for gas.\n');
  }

  const addresses = {};

  // ── Step 1: Deploy QIFlowToken (QIF governance token) ──────────────────
  console.log('1️⃣  Deploying QIFlowToken (QIF)...');
  const QIFlowToken = await ethers.getContractFactory('QIFlowToken');
  const token = await QIFlowToken.deploy(deployer.address);
  await token.waitForDeployment();
  addresses.QIFlowToken = await token.getAddress();
  console.log(`   ✅ QIFlowToken deployed: ${addresses.QIFlowToken}`);

  // ── Step 2: Deploy InterestRateModel ────────────────────────────────────
  console.log('\n2️⃣  Deploying InterestRateModel...');
  const InterestRateModel = await ethers.getContractFactory('InterestRateModel');
  const irm = await InterestRateModel.deploy(
    deployer.address,
    CONFIG.BASE_RATE_PER_YEAR,
    CONFIG.MULTIPLIER_PER_YEAR,
    CONFIG.JUMP_MULTIPLIER_PER_YEAR,
    CONFIG.KINK
  );
  await irm.waitForDeployment();
  addresses.InterestRateModel = await irm.getAddress();
  console.log(`   ✅ InterestRateModel deployed: ${addresses.InterestRateModel}`);

  // ── Step 3: Deploy QIFlowOracle ─────────────────────────────────────────
  console.log('\n3️⃣  Deploying QIFlowOracle...');
  const QIFlowOracle = await ethers.getContractFactory('QIFlowOracle');
  const oracleContract = await QIFlowOracle.deploy(deployer.address);
  await oracleContract.waitForDeployment();
  addresses.QIFlowOracle = await oracleContract.getAddress();
  console.log(`   ✅ QIFlowOracle deployed: ${addresses.QIFlowOracle}`);

  // ── Step 4: Deploy QIFlowPool ───────────────────────────────────────────
  console.log('\n4️⃣  Deploying QIFlowPool...');
  const QIFlowPool = await ethers.getContractFactory('QIFlowPool');
  const pool = await QIFlowPool.deploy(
    deployer.address,
    addresses.InterestRateModel,
    addresses.QIFlowOracle
  );
  await pool.waitForDeployment();
  addresses.QIFlowPool = await pool.getAddress();
  console.log(`   ✅ QIFlowPool deployed: ${addresses.QIFlowPool}`);

  // ── Step 5: Deploy QIFlowRewards ────────────────────────────────────────
  console.log('\n5️⃣  Deploying QIFlowRewards...');
  const QIFlowRewards = await ethers.getContractFactory('QIFlowRewards');
  const rewardsContract = await QIFlowRewards.deploy(
    deployer.address,
    addresses.QIFlowToken,
    addresses.QIFlowPool
  );
  await rewardsContract.waitForDeployment();
  addresses.QIFlowRewards = await rewardsContract.getAddress();
  console.log(`   ✅ QIFlowRewards deployed: ${addresses.QIFlowRewards}`);

  // ── Step 6: Deploy QIFlowLens ───────────────────────────────────────────
  console.log('\n6️⃣  Deploying QIFlowLens...');
  const QIFlowLens = await ethers.getContractFactory('QIFlowLens');
  const lens = await QIFlowLens.deploy(
    addresses.QIFlowPool,
    addresses.QIFlowOracle,
    addresses.QIFlowRewards
  );
  await lens.waitForDeployment();
  addresses.QIFlowLens = await lens.getAddress();
  console.log(`   ✅ QIFlowLens deployed: ${addresses.QIFlowLens}`);

  // ── Step 7: Link contracts ──────────────────────────────────────────────
  console.log('\n7️⃣  Linking contracts...');
  const setRewardsTx = await pool.setRewardsContract(addresses.QIFlowRewards);
  await setRewardsTx.wait();
  console.log('   ✅ Pool → Rewards contract linked');

  // ── Step 8: List markets ────────────────────────────────────────────────
  console.log('\n8️⃣  Listing markets...');

  // Native QIE market
  const listNativeTx = await pool.listNativeMarket(
    CONFIG.QIE_COLLATERAL_FACTOR,
    CONFIG.RESERVE_FACTOR
  );
  await listNativeTx.wait();
  console.log('   ✅ QIE (native) market listed');

  // ── Step 9: Set initial oracle prices ───────────────────────────────────
  console.log('\n9️⃣  Setting oracle prices...');
  const setPriceTx = await oracleContract.setPrice(NATIVE_QIE, CONFIG.QIE_PRICE_USD);
  await setPriceTx.wait();
  console.log(`   ✅ QIE price set: $${CONFIG.QIE_PRICE_USD / 1e8}`);

  // ── Step 10: Transfer QIF tokens to rewards contract ────────────────────
  console.log('\n🔟  Funding rewards contract...');
  const rewardAmount = ethers.parseEther('5000000'); // 5M QIF for rewards
  const transferTx = await token.transfer(addresses.QIFlowRewards, rewardAmount);
  await transferTx.wait();
  console.log(`   ✅ Transferred 5,000,000 QIF to rewards contract`);

  // Set initial reward speed for QIE market
  const setSpeedTx = await rewardsContract.setRewardSpeed(
    NATIVE_QIE,
    CONFIG.QIE_SUPPLY_REWARD_SPEED,
    CONFIG.QIE_BORROW_REWARD_SPEED
  );
  await setSpeedTx.wait();
  console.log('   ✅ Reward speeds set for QIE market');

  // ── Final: Save addresses ────────────────────────────────────────────────
  const outputPath = path.join(__dirname, '../deployedAddresses.json');
  const deploymentData = {
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: addresses,
    config: {
      qieCollateralFactor: '75%',
      reserveFactor: '10%',
      baseRate: '2% APY',
      multiplier: '10% APY',
      jumpMultiplier: '100% APY',
      kink: '80% utilization',
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));

  // ── Print summary ────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║           Deployment Complete! 🎉                ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('\n📋 Contract Addresses:');
  console.log('─'.repeat(55));
  Object.entries(addresses).forEach(([name, addr]) => {
    console.log(`  ${name.padEnd(22)} ${addr}`);
  });
  console.log('─'.repeat(55));

  const explorerBase =
    Number(network.chainId) === 1983
      ? 'https://testnet.qie.digital'
      : 'https://mainnet.qie.digital';

  console.log(`\n🔍 Explorer: ${explorerBase}/address/${addresses.QIFlowPool}`);
  console.log(`\n💾 Addresses saved to: deployedAddresses.json`);
  console.log('\n📌 NEXT STEPS:');
  console.log('  1. Copy addresses from deployedAddresses.json');
  console.log('  2. Paste them into QIFlow frontend (constants.ts)');
  console.log('  3. Update QIE price in oracle if needed');
  console.log('  4. Verify contracts on explorer\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Deployment failed:', err.message);
    process.exit(1);
  });
