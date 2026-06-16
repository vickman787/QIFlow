const { ethers } = require('hardhat');
const addresses = require('../deployedAddresses.v2.json');

const QUSDC = '0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5';
const QUSDC_PRICE_USD_8_DECIMALS = 100_000_000n;
const COLLATERAL_FACTOR = ethers.parseUnits('0.8', 18);
const RESERVE_FACTOR = ethers.parseUnits('0.1', 18);

async function main() {
  const [signer] = await ethers.getSigners();
  const pool = await ethers.getContractAt('QIFlowPool', addresses.contracts.QIFlowPool);
  const oracle = await ethers.getContractAt('QIFlowOracle', addresses.contracts.QIFlowOracle);

  const [poolOwner, oracleOwner] = await Promise.all([pool.owner(), oracle.owner()]);
  console.log(`Signer:       ${signer.address}`);
  console.log(`Pool owner:   ${poolOwner}`);
  console.log(`Oracle owner: ${oracleOwner}`);

  if (poolOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error('Signer is not the QIFlowPool owner.');
  }
  if (oracleOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error('Signer is not the QIFlowOracle owner.');
  }

  const hasPrice = await oracle.hasPrice(QUSDC);
  const currentPrice = hasPrice ? await oracle.getPrice(QUSDC) : 0n;
  if (currentPrice !== QUSDC_PRICE_USD_8_DECIMALS) {
    console.log('Setting QUSDC oracle price to $1.00...');
    const tx = await oracle.setPrice(QUSDC, QUSDC_PRICE_USD_8_DECIMALS);
    console.log(`Price tx: ${tx.hash}`);
    await tx.wait();
  } else {
    console.log('QUSDC oracle price already set to $1.00.');
  }

  const market = await pool.getMarketData(QUSDC);
  const isListed = market[0];
  if (!isListed) {
    console.log('Listing QUSDC market...');
    const tx = await pool.listMarket(QUSDC, COLLATERAL_FACTOR, RESERVE_FACTOR);
    console.log(`List tx: ${tx.hash}`);
    await tx.wait();
  } else {
    console.log('QUSDC market is already listed.');
  }

  const updated = await pool.getMarketData(QUSDC);
  console.log(`Listed: ${updated[0]}`);
  console.log(`Active: ${updated[1]}`);
  console.log(`Collateral factor: ${ethers.formatUnits(updated[2], 18)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

