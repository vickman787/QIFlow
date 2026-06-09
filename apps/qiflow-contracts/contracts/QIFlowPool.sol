// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./InterestRateModel.sol";
import "./QIFlowOracle.sol";

// QIFlowPool: Core lending pool for QIFlow Protocol on QIE Blockchain.
//
// cashPrior pattern (matches Compound cEther):
//   supplyNative — passes balance - msg.value so the deposit doesn't inflate exchange rate
//   liquidate    — passes balance - msg.value so liquidator ETH doesn't inflate collateral
//                  value and push HF above 1 before the liquidatability check
contract QIFlowPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant BASE = 1e18;
    uint256 private constant INITIAL_EXCHANGE_RATE = 1e18;
    uint256 private constant LIQUIDATION_BONUS = 1050000000000000000; // 1.05e18
    uint256 private constant CLOSE_FACTOR = 500000000000000000;       // 0.5e18
    address public constant NATIVE_QIE = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    struct Market {
        bool isListed;
        bool isActive;
        uint256 collateralFactor;
        uint256 reserveFactor;
        uint256 totalSupplyQTokens;
        uint256 totalBorrows;
        uint256 totalReserves;
        uint256 borrowIndex;
        uint256 exchangeRate;
        uint256 lastAccrualTime;
        bool isNative;
    }

    struct UserSupply {
        uint256 qTokenBalance;
    }

    struct UserBorrow {
        uint256 principal;
        uint256 interestIndex;
    }

    InterestRateModel public interestRateModel;
    QIFlowOracle public oracle;

    address[] public allMarkets;
    mapping(address => Market) public markets;
    mapping(address => mapping(address => UserSupply)) public userSupply;
    mapping(address => mapping(address => UserBorrow)) public userBorrow;
    mapping(address => address[]) public userEnteredMarkets;
    mapping(address => mapping(address => bool)) public userInMarket;

    address public guardian;
    address public rewardsContract;

    event MarketListed(address indexed asset, bool isNative);
    event Supply(address indexed user, address indexed asset, uint256 amount, uint256 qTokensMinted);
    event Withdraw(address indexed user, address indexed asset, uint256 amount, uint256 qTokensBurned);
    event Borrow(address indexed user, address indexed asset, uint256 amount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Liquidate(
        address indexed liquidator,
        address indexed borrower,
        address indexed debtAsset,
        address collateralAsset,
        uint256 debtRepaid,
        uint256 collateralSeized
    );
    event ReservesWithdrawn(address indexed asset, uint256 amount, address to);
    event CollateralFactorSet(address indexed asset, uint256 newFactor);

    constructor(address owner_, address interestRateModel_, address oracle_) Ownable(owner_) {
        interestRateModel = InterestRateModel(interestRateModel_);
        oracle = QIFlowOracle(oracle_);
        guardian = owner_;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian || msg.sender == owner(), "QIFlowPool: not guardian");
        _;
    }
    modifier marketListed(address asset) {
        require(markets[asset].isListed, "QIFlowPool: market not listed");
        _;
    }
    modifier marketActive(address asset) {
        require(markets[asset].isActive, "QIFlowPool: market not active");
        _;
    }

    // ── admin ────────────────────────────────────────────────────────────────

    function listMarket(address asset, uint256 collateralFactor, uint256 reserveFactor) external onlyOwner {
        require(!markets[asset].isListed, "QIFlowPool: already listed");
        require(collateralFactor <= 900000000000000000, "QIFlowPool: CF too high");
        require(reserveFactor <= 500000000000000000, "QIFlowPool: RF too high");
        markets[asset] = Market({
            isListed: true, isActive: true,
            collateralFactor: collateralFactor, reserveFactor: reserveFactor,
            totalSupplyQTokens: 0, totalBorrows: 0, totalReserves: 0,
            borrowIndex: BASE, exchangeRate: INITIAL_EXCHANGE_RATE,
            lastAccrualTime: block.timestamp, isNative: false
        });
        allMarkets.push(asset);
        emit MarketListed(asset, false);
    }

    function listNativeMarket(uint256 collateralFactor, uint256 reserveFactor) external onlyOwner {
        address asset = NATIVE_QIE;
        require(!markets[asset].isListed, "QIFlowPool: already listed");
        require(collateralFactor <= 900000000000000000, "QIFlowPool: CF too high");
        markets[asset] = Market({
            isListed: true, isActive: true,
            collateralFactor: collateralFactor, reserveFactor: reserveFactor,
            totalSupplyQTokens: 0, totalBorrows: 0, totalReserves: 0,
            borrowIndex: BASE, exchangeRate: INITIAL_EXCHANGE_RATE,
            lastAccrualTime: block.timestamp, isNative: true
        });
        allMarkets.push(asset);
        emit MarketListed(asset, true);
    }

    function setCollateralFactor(address asset, uint256 newFactor) external onlyOwner marketListed(asset) {
        require(newFactor <= 900000000000000000, "QIFlowPool: CF too high");
        markets[asset].collateralFactor = newFactor;
        emit CollateralFactorSet(asset, newFactor);
    }

    function setGuardian(address newGuardian) external onlyOwner { guardian = newGuardian; }
    function setRewardsContract(address rewards_) external onlyOwner { rewardsContract = rewards_; }
    function pause() external onlyGuardian { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── interest accrual ─────────────────────────────────────────────────────

    function accrueInterest(address asset) public marketListed(asset) {
        _accrueInterestWithCash(asset, _getCash(asset));
    }

    function _accrueInterestWithCash(address asset, uint256 cash) internal {
        Market storage market = markets[asset];
        uint256 elapsed = block.timestamp - market.lastAccrualTime;
        if (elapsed == 0) return;

        uint256 borrowRate = interestRateModel.getBorrowRate(cash, market.totalBorrows, market.totalReserves);
        uint256 interestFactor = borrowRate * elapsed;
        uint256 interestAccrued = (interestFactor * market.totalBorrows) / BASE;
        uint256 reservesAccrued = (interestAccrued * market.reserveFactor) / BASE;

        market.totalBorrows += interestAccrued;
        market.totalReserves += reservesAccrued;
        market.borrowIndex += (market.borrowIndex * interestFactor) / BASE;
        market.lastAccrualTime = block.timestamp;

        if (market.totalSupplyQTokens > 0) {
            uint256 underlying = cash + market.totalBorrows - market.totalReserves;
            market.exchangeRate = (underlying * BASE) / market.totalSupplyQTokens;
        }
    }

    // ── supply ───────────────────────────────────────────────────────────────

    function supply(address asset, uint256 amount)
        external nonReentrant whenNotPaused marketListed(asset) marketActive(asset)
    {
        require(!markets[asset].isNative, "QIFlowPool: use supplyNative()");
        require(amount > 0, "QIFlowPool: amount must be > 0");
        accrueInterest(asset);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _mintQTokens(msg.sender, asset, amount);
    }

    function supplyNative()
        external payable nonReentrant whenNotPaused marketListed(NATIVE_QIE) marketActive(NATIVE_QIE)
    {
        require(msg.value > 0, "QIFlowPool: amount must be > 0");
        // cashPrior: exclude the incoming deposit from balance before accrual
        uint256 cashPrior = address(this).balance - msg.value;
        _accrueInterestWithCash(NATIVE_QIE, cashPrior);
        _mintQTokens(msg.sender, NATIVE_QIE, msg.value);
    }

    function _mintQTokens(address user, address asset, uint256 amount) internal {
        Market storage market = markets[asset];
        uint256 qTokens = (amount * BASE) / market.exchangeRate;
        require(qTokens > 0, "QIFlowPool: zero qTokens");
        market.totalSupplyQTokens += qTokens;
        userSupply[user][asset].qTokenBalance += qTokens;
        _enterMarket(user, asset);
        _notifyRewards(user, asset);
        emit Supply(user, asset, amount, qTokens);
    }

    // ── withdraw ─────────────────────────────────────────────────────────────

    function withdraw(address asset, uint256 amount)
        external nonReentrant whenNotPaused marketListed(asset)
    {
        require(!markets[asset].isNative, "QIFlowPool: use withdrawNative()");
        accrueInterest(asset);
        _withdraw(msg.sender, asset, amount);
    }

    function withdrawNative(uint256 amount)
        external nonReentrant whenNotPaused marketListed(NATIVE_QIE)
    {
        accrueInterest(NATIVE_QIE);
        _withdraw(msg.sender, NATIVE_QIE, amount);
    }

    function _withdraw(address user, address asset, uint256 amount) internal {
        Market storage market = markets[asset];
        UserSupply storage sup = userSupply[user][asset];
        uint256 qTokenBalance = sup.qTokenBalance;
        require(qTokenBalance > 0, "QIFlowPool: nothing to withdraw");

        uint256 maxUnderlying = (qTokenBalance * market.exchangeRate) / BASE;
        if (amount == type(uint256).max || amount > maxUnderlying) amount = maxUnderlying;

        uint256 qTokensToBurn = (amount * BASE) / market.exchangeRate;
        if (qTokensToBurn > qTokenBalance) qTokensToBurn = qTokenBalance;

        market.totalSupplyQTokens -= qTokensToBurn;
        sup.qTokenBalance -= qTokensToBurn;

        require(_getHealthFactor(user) >= BASE, "QIFlowPool: withdrawal would cause undercollateralization");
        _notifyRewards(user, asset);

        if (market.isNative) {
            (bool ok, ) = user.call{value: amount}("");
            require(ok, "QIFlowPool: QIE transfer failed");
        } else {
            IERC20(asset).safeTransfer(user, amount);
        }
        emit Withdraw(user, asset, amount, qTokensToBurn);
    }

    // ── borrow ───────────────────────────────────────────────────────────────

    function borrow(address asset, uint256 amount)
        external nonReentrant whenNotPaused marketListed(asset) marketActive(asset)
    {
        require(!markets[asset].isNative, "QIFlowPool: use borrowNative()");
        require(amount > 0, "QIFlowPool: amount must be > 0");
        accrueInterest(asset);
        _borrow(msg.sender, asset, amount);
        IERC20(asset).safeTransfer(msg.sender, amount);
    }

    function borrowNative(uint256 amount)
        external nonReentrant whenNotPaused marketListed(NATIVE_QIE) marketActive(NATIVE_QIE)
    {
        require(amount > 0, "QIFlowPool: amount must be > 0");
        accrueInterest(NATIVE_QIE);
        _borrow(msg.sender, NATIVE_QIE, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "QIFlowPool: QIE transfer failed");
    }

    function _borrow(address user, address asset, uint256 amount) internal {
        require(_getCash(asset) >= amount, "QIFlowPool: insufficient liquidity in pool");
        _updateBorrowIndex(user, asset);
        userBorrow[user][asset].principal += amount;
        userBorrow[user][asset].interestIndex = markets[asset].borrowIndex;
        markets[asset].totalBorrows += amount;
        _enterMarket(user, asset);
        require(_getHealthFactor(user) >= BASE, "QIFlowPool: insufficient collateral");
        _notifyRewards(user, asset);
        emit Borrow(user, asset, amount);
    }

    // ── repay ────────────────────────────────────────────────────────────────

    function repay(address asset, uint256 amount)
        external nonReentrant whenNotPaused marketListed(asset)
    {
        require(!markets[asset].isNative, "QIFlowPool: use repayNative()");
        accrueInterest(asset);
        _updateBorrowIndex(msg.sender, asset);
        uint256 debt = userBorrow[msg.sender][asset].principal;
        if (amount == type(uint256).max || amount > debt) amount = debt;
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _repay(msg.sender, asset, amount);
    }

    function repayNative()
        external payable nonReentrant whenNotPaused marketListed(NATIVE_QIE)
    {
        accrueInterest(NATIVE_QIE);
        _updateBorrowIndex(msg.sender, NATIVE_QIE);
        uint256 debt = userBorrow[msg.sender][NATIVE_QIE].principal;
        uint256 amount = msg.value;
        if (amount > debt) {
            (bool ok, ) = msg.sender.call{value: amount - debt}("");
            require(ok, "QIFlowPool: refund failed");
            amount = debt;
        }
        _repay(msg.sender, NATIVE_QIE, amount);
    }

    function _repay(address user, address asset, uint256 amount) internal {
        userBorrow[user][asset].principal -= amount;
        markets[asset].totalBorrows -= amount;
        _notifyRewards(user, asset);
        emit Repay(user, asset, amount);
    }

    // ── liquidate ────────────────────────────────────────────────────────────

    function liquidate(
        address borrower,
        address debtAsset,
        address collateralAsset,
        uint256 debtAmount
    ) external payable nonReentrant whenNotPaused {
        require(borrower != msg.sender, "QIFlowPool: cannot self-liquidate");

        // cashPrior fix: exclude liquidator's msg.value from the balance when accruing interest.
        // Without this, Charlie's incoming ETH inflates the exchange rate, raises Alice's apparent
        // collateral value, and pushes HF back above 1 before the liquidatability check runs.
        uint256 debtCash = markets[debtAsset].isNative
            ? address(this).balance - msg.value
            : _getCash(debtAsset);
        _accrueInterestWithCash(debtAsset, debtCash);
        if (collateralAsset != debtAsset) accrueInterest(collateralAsset);
        _updateBorrowIndex(borrower, debtAsset);

        require(_getHealthFactor(borrower) < BASE, "QIFlowPool: borrower is not liquidatable");

        uint256 maxRepay = (userBorrow[borrower][debtAsset].principal * CLOSE_FACTOR) / BASE;
        if (debtAmount > maxRepay) debtAmount = maxRepay;

        uint256 debtPrice = oracle.getPrice(debtAsset);
        uint256 colPrice = oracle.getPrice(collateralAsset);
        uint256 colExRate = markets[collateralAsset].exchangeRate;

        uint256 debtValueUSD = (debtAmount * debtPrice) / 1e8;
        uint256 colValueWithBonus = (debtValueUSD * LIQUIDATION_BONUS) / BASE;
        uint256 colUnderlying = (colValueWithBonus * 1e8) / colPrice;
        uint256 qTokensToSeize = (colUnderlying * BASE) / colExRate;

        require(
            userSupply[borrower][collateralAsset].qTokenBalance >= qTokensToSeize,
            "QIFlowPool: not enough collateral to seize"
        );

        if (markets[debtAsset].isNative) {
            require(msg.value >= debtAmount, "QIFlowPool: insufficient QIE sent");
            if (msg.value > debtAmount) {
                (bool ok, ) = msg.sender.call{value: msg.value - debtAmount}("");
                require(ok, "QIFlowPool: refund failed");
            }
        } else {
            IERC20(debtAsset).safeTransferFrom(msg.sender, address(this), debtAmount);
        }

        userBorrow[borrower][debtAsset].principal -= debtAmount;
        markets[debtAsset].totalBorrows -= debtAmount;
        userSupply[borrower][collateralAsset].qTokenBalance -= qTokensToSeize;
        userSupply[msg.sender][collateralAsset].qTokenBalance += qTokensToSeize;

        emit Liquidate(msg.sender, borrower, debtAsset, collateralAsset, debtAmount, qTokensToSeize);
    }

    // ── views ────────────────────────────────────────────────────────────────

    function getHealthFactor(address user) external view returns (uint256) {
        return _getHealthFactor(user);
    }

    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralUSD,
        uint256 totalBorrowUSD,
        uint256 availableBorrowUSD,
        uint256 healthFactor
    ) {
        (totalCollateralUSD, totalBorrowUSD) = _getAccountValues(user);
        healthFactor = totalBorrowUSD == 0 ? type(uint256).max : (totalCollateralUSD * BASE) / totalBorrowUSD;
        availableBorrowUSD = totalCollateralUSD > totalBorrowUSD ? totalCollateralUSD - totalBorrowUSD : 0;
    }

    function getMarketData(address asset) external view returns (
        bool isListed, bool isActive, uint256 collateralFactor,
        uint256 totalSupplyUnderlying, uint256 totalBorrows, uint256 exchangeRate,
        uint256 supplyRatePerSecond, uint256 borrowRatePerSecond, uint256 utilization
    ) {
        Market storage m = markets[asset];
        isListed = m.isListed;
        isActive = m.isActive;
        collateralFactor = m.collateralFactor;
        totalSupplyUnderlying = (m.totalSupplyQTokens * m.exchangeRate) / BASE;
        totalBorrows = m.totalBorrows;
        exchangeRate = m.exchangeRate;
        uint256 cash = _getCash(asset);
        supplyRatePerSecond = interestRateModel.getSupplyRate(cash, m.totalBorrows, m.totalReserves, m.reserveFactor);
        borrowRatePerSecond = interestRateModel.getBorrowRate(cash, m.totalBorrows, m.totalReserves);
        utilization = interestRateModel.utilizationRate(cash, m.totalBorrows, m.totalReserves);
    }

    function getUserSupplyBalance(address user, address asset) external view returns (uint256) {
        return (userSupply[user][asset].qTokenBalance * markets[asset].exchangeRate) / BASE;
    }

    function getUserBorrowBalance(address user, address asset) external view returns (uint256) {
        UserBorrow storage ub = userBorrow[user][asset];
        if (ub.principal == 0) return 0;
        uint256 ratio = (markets[asset].borrowIndex * BASE) / ub.interestIndex;
        return (ub.principal * ratio) / BASE;
    }

    function getAllMarkets() external view returns (address[] memory) { return allMarkets; }
    function getUserEnteredMarkets(address user) external view returns (address[] memory) { return userEnteredMarkets[user]; }

    // ── internal helpers ─────────────────────────────────────────────────────

    function _getCash(address asset) internal view returns (uint256) {
        if (asset == NATIVE_QIE) return address(this).balance;
        return IERC20(asset).balanceOf(address(this));
    }

    function _enterMarket(address user, address asset) internal {
        if (!userInMarket[user][asset]) {
            userInMarket[user][asset] = true;
            userEnteredMarkets[user].push(asset);
        }
    }

    function _updateBorrowIndex(address user, address asset) internal {
        UserBorrow storage ub = userBorrow[user][asset];
        if (ub.principal == 0) {
            ub.interestIndex = markets[asset].borrowIndex;
            return;
        }
        uint256 ratio = (markets[asset].borrowIndex * BASE) / ub.interestIndex;
        ub.principal = (ub.principal * ratio) / BASE;
        ub.interestIndex = markets[asset].borrowIndex;
    }

    function _getHealthFactor(address user) internal view returns (uint256) {
        (uint256 collateral, uint256 borrows) = _getAccountValues(user);
        if (borrows == 0) return type(uint256).max;
        return (collateral * BASE) / borrows;
    }

    function _getAccountValues(address user) internal view returns (
        uint256 totalCollateralUSD,
        uint256 totalBorrowUSD
    ) {
        address[] memory entered = userEnteredMarkets[user];
        for (uint256 i = 0; i < entered.length; i++) {
            address asset = entered[i];
            Market storage market = markets[asset];
            if (!market.isListed) continue;
            if (!oracle.hasPrice(asset)) continue;

            uint256 price = oracle.getPrice(asset);

            uint256 qBal = userSupply[user][asset].qTokenBalance;
            if (qBal > 0) {
                uint256 underlying = (qBal * market.exchangeRate) / BASE;
                uint256 valueUSD = (underlying * price) / 1e8;
                totalCollateralUSD += (valueUSD * market.collateralFactor) / BASE;
            }

            UserBorrow storage ub = userBorrow[user][asset];
            if (ub.principal > 0 && ub.interestIndex > 0) {
                uint256 ratio = (market.borrowIndex * BASE) / ub.interestIndex;
                uint256 borrowWithInterest = (ub.principal * ratio) / BASE;
                totalBorrowUSD += (borrowWithInterest * price) / 1e8;
            }
        }
    }

    function _notifyRewards(address user, address asset) internal {
        if (rewardsContract != address(0)) {
            rewardsContract.call(abi.encodeWithSignature("onUserAction(address,address)", user, asset));
        }
    }

    receive() external payable {}

    function withdrawReserves(address asset, uint256 amount, address to)
        external onlyOwner marketListed(asset)
    {
        require(amount <= markets[asset].totalReserves, "QIFlowPool: not enough reserves");
        markets[asset].totalReserves -= amount;
        if (markets[asset].isNative) {
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "QIFlowPool: transfer failed");
        } else {
            IERC20(asset).safeTransfer(to, amount);
        }
        emit ReservesWithdrawn(asset, amount, to);
    }
}

