const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

const NATIVE_QIE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const EXISTING = {
  QIFlowToken: '0x8aff94408452a31e9D566468cf76fCA155c7538F',
  InterestRateModel: '0xBc59a7Fe22f2D56A6F7F0B7ab996C46c94Bbeb91',
  QIFlowOracle: '0xA51482Fdd51355165dd81e770EAA072354831C97',
};

const CONFIG = {
  QIE_COLLATERAL_FACTOR: ethers.parseEther('0.75'),
  RESERVE_FACTOR: ethers.parseEther('0.10'),
  QIE_SUPPLY_REWARD_SPEED: ethers.parseEther('0.001'),
  QIE_BORROW_REWARD_SPEED: ethers.parseEther('0.0005'),
  REWARD_FUND_AMOUNT: ethers.parseEther(process.env.QIFLOW_V2_REWARD_FUND || '1000000'),
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('\nQIFlow V2 deployment');
  console.log(`Network: ${network.name} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Gas balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} QIE`);
  console.log(`Reward funding: ${ethers.formatEther(CONFIG.REWARD_FUND_AMOUNT)} QIF`);

  if (Number(network.chainId) !== 1990) {
    throw new Error(`Expected QIE mainnet chain ID 1990, got ${network.chainId}`);
  }

  const token = await ethers.getContractAt('QIFlowToken', EXISTING.QIFlowToken);
  const tokenBalance = await token.balanceOf(deployer.address);
  console.log(`Deployer QIF balance: ${ethers.formatEther(tokenBalance)} QIF`);

  if (tokenBalance < CONFIG.REWARD_FUND_AMOUNT) {
    throw new Error('Deployer does not have enough QIF to fund the V2 rewards contract');
  }

  const addresses = {
    QIFlowToken: EXISTING.QIFlowToken,
    InterestRateModel: EXISTING.InterestRateModel,
    QIFlowOracle: EXISTING.QIFlowOracle,
  };

  console.log('\nDeploying fixed QIFlowPool...');
  const QIFlowPool = await ethers.getContractFactory('QIFlowPool');
  const pool = await QIFlowPool.deploy(
    deployer.address,
    addresses.InterestRateModel,
    addresses.QIFlowOracle
  );
  await pool.waitForDeployment();
  addresses.QIFlowPool = await pool.getAddress();
  console.log(`QIFlowPool: ${addresses.QIFlowPool}`);

  console.log('\nDeploying QIFlowRewards for V2 pool...');
  const QIFlowRewards = await ethers.getContractFactory('QIFlowRewards');
  const rewards = await QIFlowRewards.deploy(
    deployer.address,
    addresses.QIFlowToken,
    addresses.QIFlowPool
  );
  await rewards.waitForDeployment();
  addresses.QIFlowRewards = await rewards.getAddress();
  console.log(`QIFlowRewards: ${addresses.QIFlowRewards}`);

  console.log('\nDeploying QIFlowLens for V2 pool...');
  const QIFlowLens = await ethers.getContractFactory('QIFlowLens');
  const lens = await QIFlowLens.deploy(
    addresses.QIFlowPool,
    addresses.QIFlowOracle,
    addresses.QIFlowRewards
  );
  await lens.waitForDeployment();
  addresses.QIFlowLens = await lens.getAddress();
  console.log(`QIFlowLens: ${addresses.QIFlowLens}`);

  console.log('\nConfiguring V2 pool...');
  await (await pool.setRewardsContract(addresses.QIFlowRewards)).wait();
  await (await pool.listNativeMarket(CONFIG.QIE_COLLATERAL_FACTOR, CONFIG.RESERVE_FACTOR)).wait();
  await (
    await rewards.setRewardSpeed(
      NATIVE_QIE,
      CONFIG.QIE_SUPPLY_REWARD_SPEED,
      CONFIG.QIE_BORROW_REWARD_SPEED
    )
  ).wait();

  console.log('\nFunding V2 rewards...');
  await (await token.transfer(addresses.QIFlowRewards, CONFIG.REWARD_FUND_AMOUNT)).wait();

  const deploymentData = {
    network: network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    previousPool: '0xc2BFd5E003c605CF39f66C01313856a06a9d3eE0',
    contracts: addresses,
    config: {
      qieCollateralFactor: '75%',
      reserveFactor: '10%',
      qieSupplyRewardSpeed: '0.001 QIF/sec',
      qieBorrowRewardSpeed: '0.0005 QIF/sec',
      rewardFundAmountQIF: ethers.formatEther(CONFIG.REWARD_FUND_AMOUNT),
    },
  };

  const outputPath = path.join(__dirname, '../deployedAddresses.v2.json');
  fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));

  console.log('\nV2 deployment complete');
  console.log(JSON.stringify(deploymentData.contracts, null, 2));
  console.log(`Saved to ${outputPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nV2 deployment failed:', err);
    process.exit(1);
  });
