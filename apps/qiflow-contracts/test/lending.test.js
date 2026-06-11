const { expect } = require('chai');
const { ethers } = require('hardhat');

const NATIVE_QIE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const BASE = ethers.parseEther('1');

describe('QIFlow Protocol', function () {
  let deployer, alice, bob, charlie;
  let token, irm, oracle, pool, rewards, lens;

  beforeEach(async function () {
    [deployer, alice, bob, charlie] = await ethers.getSigners();

    const QIFlowToken = await ethers.getContractFactory('QIFlowToken');
    token = await QIFlowToken.deploy(deployer.address);

    const InterestRateModel = await ethers.getContractFactory('InterestRateModel');
    irm = await InterestRateModel.deploy(
      deployer.address,
      ethers.parseEther('0.02'),
      ethers.parseEther('0.10'),
      ethers.parseEther('1.00'),
      ethers.parseEther('0.80')
    );

    const QIFlowOracle = await ethers.getContractFactory('QIFlowOracle');
    oracle = await QIFlowOracle.deploy(deployer.address);

    const QIFlowPool = await ethers.getContractFactory('QIFlowPool');
    pool = await QIFlowPool.deploy(
      deployer.address,
      await irm.getAddress(),
      await oracle.getAddress()
    );

    const QIFlowRewards = await ethers.getContractFactory('QIFlowRewards');
    rewards = await QIFlowRewards.deploy(
      deployer.address,
      await token.getAddress(),
      await pool.getAddress()
    );

    const QIFlowLens = await ethers.getContractFactory('QIFlowLens');
    lens = await QIFlowLens.deploy(
      await pool.getAddress(),
      await oracle.getAddress(),
      await rewards.getAddress()
    );

    await pool.setRewardsContract(await rewards.getAddress());
    await pool.listNativeMarket(ethers.parseEther('0.75'), ethers.parseEther('0.10'));
    await oracle.setPrice(NATIVE_QIE, 50_000_000); // $0.50

    // Transfer 1M QIF to rewards — deployer will have 9M remaining after this
    await token.transfer(await rewards.getAddress(), ethers.parseEther('1000000'));
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowToken', function () {
    it('has correct name, symbol and max supply', async function () {
      expect(await token.name()).to.equal('QIFlow Token');
      expect(await token.symbol()).to.equal('QIF');
      expect(await token.MAX_SUPPLY()).to.equal(ethers.parseEther('100000000'));
    });

    it('mints 10M to deployer on deploy', async function () {
      // beforeEach transfers 1M to rewards, so deployer has 9M remaining
      const balance = await token.balanceOf(deployer.address);
      expect(balance).to.be.gte(ethers.parseEther('9000000'));
    });

    it('allows owner to mint up to max supply', async function () {
      await expect(token.mint(alice.address, ethers.parseEther('1000'))).to.emit(
        token,
        'TokensMinted'
      );
    });

    it('reverts if mint exceeds max supply', async function () {
      await expect(token.mint(alice.address, ethers.parseEther('100000001'))).to.be.revertedWith(
        'QIFlowToken: max supply exceeded'
      );
    });

    it('non-owner cannot mint', async function () {
      await expect(token.connect(alice).mint(alice.address, ethers.parseEther('1'))).to.be.reverted;
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('InterestRateModel', function () {
    it('returns 0 utilization when no borrows', async function () {
      const util = await irm.utilizationRate(ethers.parseEther('100'), 0, 0);
      expect(util).to.equal(0);
    });

    it('calculates utilization correctly', async function () {
      const util = await irm.utilizationRate(ethers.parseEther('50'), ethers.parseEther('50'), 0);
      expect(util).to.equal(ethers.parseEther('0.5'));
    });

    it('borrow rate increases above kink (jump rate)', async function () {
      const rateBelowKink = await irm.getBorrowRate(
        ethers.parseEther('40'),
        ethers.parseEther('60'),
        0
      );
      const rateAboveKink = await irm.getBorrowRate(
        ethers.parseEther('5'),
        ethers.parseEther('95'),
        0
      );
      expect(rateAboveKink).to.be.gt(rateBelowKink);
    });

    it('supply rate is less than borrow rate', async function () {
      const cash = ethers.parseEther('50');
      const borrows = ethers.parseEther('50');
      const borrowRate = await irm.getBorrowRate(cash, borrows, 0);
      const supplyRate = await irm.getSupplyRate(cash, borrows, 0, ethers.parseEther('0.1'));
      expect(supplyRate).to.be.lt(borrowRate);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowOracle', function () {
    it('returns set price correctly', async function () {
      const price = await oracle.getPrice(NATIVE_QIE);
      expect(price).to.equal(50_000_000);
    });

    it('reverts on unset asset', async function () {
      const randomAddr = ethers.Wallet.createRandom().address;
      await expect(oracle.getPrice(randomAddr)).to.be.revertedWith('QIFlowOracle: price not set');
    });

    it('non-owner cannot set price', async function () {
      await expect(oracle.connect(alice).setPrice(NATIVE_QIE, 100_000_000)).to.be.reverted;
    });

    it('can set prices in batch', async function () {
      const addr1 = ethers.Wallet.createRandom().address;
      const addr2 = ethers.Wallet.createRandom().address;
      await oracle.setPrices([addr1, addr2], [100_000_000, 200_000_000]);
      expect(await oracle.getPrice(addr1)).to.equal(100_000_000);
      expect(await oracle.getPrice(addr2)).to.equal(200_000_000);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowPool — Supply', function () {
    it('user can supply native QIE', async function () {
      const supplyAmount = ethers.parseEther('10');
      await expect(pool.connect(alice).supplyNative({ value: supplyAmount })).to.emit(
        pool,
        'Supply'
      );

      const balance = await pool.getUserSupplyBalance(alice.address, NATIVE_QIE);
      expect(balance).to.be.closeTo(supplyAmount, ethers.parseEther('0.001'));
    });

    it('reverts on zero supply', async function () {
      await expect(pool.connect(alice).supplyNative({ value: 0 })).to.be.revertedWith(
        'QIFlowPool: amount must be > 0'
      );
    });

    it('pool receives QIE after supply', async function () {
      const supplyAmount = ethers.parseEther('5');
      await pool.connect(alice).supplyNative({ value: supplyAmount });
      const poolBalance = await ethers.provider.getBalance(await pool.getAddress());
      expect(poolBalance).to.equal(supplyAmount);
    });

    it('multiple users can supply independently', async function () {
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('10') });
      await pool.connect(bob).supplyNative({ value: ethers.parseEther('20') });

      const aliceBal = await pool.getUserSupplyBalance(alice.address, NATIVE_QIE);
      const bobBal = await pool.getUserSupplyBalance(bob.address, NATIVE_QIE);

      // With cashPrior fix, each user's balance equals exactly what they deposited
      expect(aliceBal).to.be.closeTo(ethers.parseEther('10'), ethers.parseEther('0.001'));
      expect(bobBal).to.be.closeTo(ethers.parseEther('20'), ethers.parseEther('0.001'));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowPool — Withdraw', function () {
    beforeEach(async function () {
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('10') });
    });

    it('user can withdraw supplied QIE', async function () {
      await expect(pool.connect(alice).withdrawNative(ethers.parseEther('5'))).to.emit(
        pool,
        'Withdraw'
      );

      const remaining = await pool.getUserSupplyBalance(alice.address, NATIVE_QIE);
      expect(remaining).to.be.closeTo(ethers.parseEther('5'), ethers.parseEther('0.01'));
    });

    it('user can withdraw full balance with max uint', async function () {
      await pool.connect(alice).withdrawNative(ethers.MaxUint256);
      const remaining = await pool.getUserSupplyBalance(alice.address, NATIVE_QIE);
      expect(remaining).to.equal(0);
    });

    it('reverts when nothing to withdraw', async function () {
      await expect(pool.connect(bob).withdrawNative(ethers.parseEther('1'))).to.be.revertedWith(
        'QIFlowPool: nothing to withdraw'
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowPool — Borrow', function () {
    beforeEach(async function () {
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('100') });
      await pool.connect(bob).supplyNative({ value: ethers.parseEther('50') });
    });

    it('user can borrow up to collateral limit', async function () {
      // Alice has 100 QIE at 75% CF = 75 QIE limit — borrow 50 safely
      await expect(pool.connect(alice).borrowNative(ethers.parseEther('50'))).to.emit(
        pool,
        'Borrow'
      );
    });

    it('reverts when borrow exceeds collateral', async function () {
      // Alice has 100 QIE * 75% = 75 QIE limit — 80 should revert
      await expect(pool.connect(alice).borrowNative(ethers.parseEther('80'))).to.be.revertedWith(
        'QIFlowPool: insufficient collateral'
      );
    });

    it('health factor is above 1 after safe borrow', async function () {
      await pool.connect(alice).borrowNative(ethers.parseEther('50'));
      const hf = await pool.getHealthFactor(alice.address);
      expect(hf).to.be.gt(BASE);
    });

    it('borrow balance increases with interest over time', async function () {
      await pool.connect(alice).borrowNative(ethers.parseEther('50'));
      const balanceBefore = await pool.getUserBorrowBalance(alice.address, NATIVE_QIE);

      await ethers.provider.send('evm_increaseTime', [86400]); // 1 day
      await ethers.provider.send('evm_mine');
      await pool.accrueInterest(NATIVE_QIE);

      const balanceAfter = await pool.getUserBorrowBalance(alice.address, NATIVE_QIE);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowPool — Repay', function () {
    beforeEach(async function () {
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('100') });
      await pool.connect(bob).supplyNative({ value: ethers.parseEther('50') });
      await pool.connect(alice).borrowNative(ethers.parseEther('50'));
    });

    it('user can repay borrow', async function () {
      const balBefore = await pool.getUserBorrowBalance(alice.address, NATIVE_QIE);
      expect(balBefore).to.be.gt(0);

      await expect(pool.connect(alice).repayNative({ value: ethers.parseEther('25') })).to.emit(
        pool,
        'Repay'
      );

      const balAfter = await pool.getUserBorrowBalance(alice.address, NATIVE_QIE);
      expect(balAfter).to.be.lt(balBefore);
    });

    it('user can repay full debt (refunds excess)', async function () {
      await pool.connect(alice).repayNative({ value: ethers.parseEther('100') });
      const remaining = await pool.getUserBorrowBalance(alice.address, NATIVE_QIE);
      expect(remaining).to.equal(0);
    });

    it('health factor improves after repay', async function () {
      const hfBefore = await pool.getHealthFactor(alice.address);
      await pool.connect(alice).repayNative({ value: ethers.parseEther('25') });
      const hfAfter = await pool.getHealthFactor(alice.address);
      expect(hfAfter).to.be.gt(hfBefore);
    });

    it('does not inflate supplied QIE when native debt is repaid', async function () {
      const QIFlowPool = await ethers.getContractFactory('QIFlowPool');
      const freshPool = await QIFlowPool.deploy(
        deployer.address,
        await irm.getAddress(),
        await oracle.getAddress()
      );

      await freshPool.listNativeMarket(ethers.parseEther('0.75'), ethers.parseEther('0.10'));
      await freshPool.connect(alice).supplyNative({ value: ethers.parseEther('10') });
      await freshPool.connect(alice).borrowNative(ethers.parseEther('2'));

      await freshPool.connect(alice).repayNative({ value: ethers.parseEther('2') });

      const supplyAfterRepay = await freshPool.getUserSupplyBalance(alice.address, NATIVE_QIE);
      expect(supplyAfterRepay).to.be.closeTo(ethers.parseEther('10'), ethers.parseEther('0.001'));
    });
  });

  describe('QIFlowRewards — Accrual Boundaries', function () {
    it('does not give a new supplier rewards for idle time before supply', async function () {
      await rewards.setRewardSpeed(NATIVE_QIE, ethers.parseEther('0.001'), 0);

      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');

      await pool.connect(alice).supplyNative({ value: ethers.parseEther('10') });

      const pending = await rewards.getPendingRewards(alice.address);
      expect(pending).to.equal(0);
    });

    it('does not give a new borrower rewards for idle time before borrow', async function () {
      await rewards.setRewardSpeed(NATIVE_QIE, 0, ethers.parseEther('0.001'));
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('10') });
      await pool.connect(bob).supplyNative({ value: ethers.parseEther('10') });

      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');

      await pool.connect(alice).borrowNative(ethers.parseEther('2'));

      const pending = await rewards.getPendingRewards(alice.address);
      expect(pending).to.equal(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowPool — Liquidation', function () {
    beforeEach(async function () {
      // Alice supplies 100 QIE, bob adds liquidity
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('100') });
      await pool.connect(bob).supplyNative({ value: ethers.parseEther('200') });
      // Alice borrows 70 QIE (limit is 75 — leaving small buffer)
      await pool.connect(alice).borrowNative(ethers.parseEther('70'));
    });

    it('reverts liquidation on healthy position', async function () {
      const hf = await pool.getHealthFactor(alice.address);
      expect(hf).to.be.gt(BASE);

      await expect(
        pool
          .connect(charlie)
          .liquidate(alice.address, NATIVE_QIE, NATIVE_QIE, ethers.parseEther('10'), {
            value: ethers.parseEther('10'),
          })
      ).to.be.revertedWith('QIFlowPool: borrower is not liquidatable');
    });

    it('allows liquidation after interest accrual makes position undercollateralized', async function () {
      // Alice borrowed 70 QIE with a 75 QIE limit (100 * 75% CF)
      // Interest will grow the debt past 75 QIE, making HF < 1
      // 1200 days at ~4.3% APY is enough to grow debt from 70 to >75 QIE
      await ethers.provider.send('evm_increaseTime', [1200 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await pool.accrueInterest(NATIVE_QIE);

      const hf = await pool.getHealthFactor(alice.address);
      expect(hf).to.be.lt(BASE); // HF < 1.0 — liquidatable

      // Charlie liquidates up to 50% of the debt (close factor)
      const debt = await pool.getUserBorrowBalance(alice.address, NATIVE_QIE);
      const repayAmount = debt / 2n;

      await expect(
        pool
          .connect(charlie)
          .liquidate(alice.address, NATIVE_QIE, NATIVE_QIE, repayAmount, { value: repayAmount })
      ).to.emit(pool, 'Liquidate');

      // After liquidation, alice's debt is reduced
      const debtAfter = await pool.getUserBorrowBalance(alice.address, NATIVE_QIE);
      expect(debtAfter).to.be.lt(debt);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('QIFlowLens', function () {
    it('returns market summary for QIE market', async function () {
      const summaries = await lens.getAllMarketsSummary();
      expect(summaries.length).to.be.gte(1);
      expect(summaries[0].isActive).to.equal(true);
      expect(summaries[0].collateralFactor).to.equal(ethers.parseEther('0.75'));
    });

    it('returns user summary after supply', async function () {
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('10') });
      const summary = await lens.getUserSummary(alice.address);
      expect(summary.totalCollateralUSD).to.be.gt(0);
      expect(summary.totalBorrowUSD).to.equal(0);
    });

    it('health factor is max uint when no borrows', async function () {
      await pool.connect(alice).supplyNative({ value: ethers.parseEther('10') });
      const summary = await lens.getUserSummary(alice.address);
      expect(summary.healthFactor).to.equal(ethers.MaxUint256);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Protocol: Pause / Unpause', function () {
    it('guardian can pause the pool', async function () {
      await pool.pause();
      await expect(
        pool.connect(alice).supplyNative({ value: ethers.parseEther('1') })
      ).to.be.revertedWithCustomError(pool, 'EnforcedPause');
    });

    it('owner can unpause', async function () {
      await pool.pause();
      await pool.unpause();
      await expect(pool.connect(alice).supplyNative({ value: ethers.parseEther('1') })).to.emit(
        pool,
        'Supply'
      );
    });
  });
});
