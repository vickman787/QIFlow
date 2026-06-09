// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./QIFlowPool.sol";
import "./QIFlowOracle.sol";
import "./QIFlowRewards.sol";

// QIFlowLens: Read-only helper that aggregates data for the frontend in single calls.
// No state changes. Call these view functions from your frontend to populate the UI.
contract QIFlowLens {
    uint256 private constant BASE = 1e18;
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    QIFlowPool public immutable pool;
    QIFlowOracle public immutable oracle;
    QIFlowRewards public immutable rewards;

    struct MarketSummary {
        address asset;
        bool isActive;
        bool isNative;
        uint256 collateralFactor;
        uint256 totalSupplyUSD;
        uint256 totalBorrowUSD;
        uint256 availableLiquidity;
        uint256 utilizationRate;
        uint256 supplyAPY;
        uint256 borrowAPY;
        uint256 exchangeRate;
        uint256 supplyRewardSpeed;
        uint256 borrowRewardSpeed;
    }

    struct UserPositionSummary {
        address asset;
        uint256 supplyBalance;
        uint256 supplyBalanceUSD;
        uint256 borrowBalance;
        uint256 borrowBalanceUSD;
        uint256 pendingRewards;
    }

    struct UserAccountSummary {
        uint256 totalCollateralUSD;
        uint256 totalBorrowUSD;
        uint256 availableBorrowUSD;
        uint256 healthFactor;
        uint256 totalPendingRewards;
        UserPositionSummary[] positions;
    }

    constructor(address pool_, address oracle_, address rewards_) {
        pool = QIFlowPool(payable(pool_));
        oracle = QIFlowOracle(oracle_);
        rewards = QIFlowRewards(rewards_);
    }

    function getAllMarketsSummary() external view returns (MarketSummary[] memory) {
        address[] memory marketAddresses = pool.getAllMarkets();
        MarketSummary[] memory summaries = new MarketSummary[](marketAddresses.length);
        for (uint256 i = 0; i < marketAddresses.length; i++) {
            summaries[i] = _getMarketSummary(marketAddresses[i]);
        }
        return summaries;
    }

    function getMarketSummary(address asset) external view returns (MarketSummary memory) {
        return _getMarketSummary(asset);
    }

    function getUserSummary(address user) external view returns (UserAccountSummary memory summary) {
        (
            uint256 totalCollateralUSD,
            uint256 totalBorrowUSD,
            uint256 availableBorrowUSD,
            uint256 healthFactor
        ) = pool.getUserAccountData(user);

        summary.totalCollateralUSD = totalCollateralUSD;
        summary.totalBorrowUSD = totalBorrowUSD;
        summary.availableBorrowUSD = availableBorrowUSD;
        summary.healthFactor = healthFactor;

        address[] memory entered = pool.getUserEnteredMarkets(user);
        summary.positions = new UserPositionSummary[](entered.length);

        uint256 totalPending = 0;

        for (uint256 i = 0; i < entered.length; i++) {
            address asset = entered[i];
            uint256 supplyBalance = pool.getUserSupplyBalance(user, asset);
            uint256 borrowBalance = pool.getUserBorrowBalance(user, asset);

            uint256 price = 0;
            try oracle.getPrice(asset) returns (uint256 p) {
                price = p;
            } catch {}

            uint256 pendingForMarket = 0;
            try rewards.getPendingRewards(user) returns (uint256 p) {
                pendingForMarket = p;
            } catch {}

            summary.positions[i] = UserPositionSummary({
                asset: asset,
                supplyBalance: supplyBalance,
                supplyBalanceUSD: (supplyBalance * price) / 1e8,
                borrowBalance: borrowBalance,
                borrowBalanceUSD: (borrowBalance * price) / 1e8,
                pendingRewards: pendingForMarket
            });

            totalPending += pendingForMarket;
        }

        summary.totalPendingRewards = totalPending;
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _getMarketSummary(address asset) internal view returns (MarketSummary memory s) {
        bool isListed;
        bool isActive;
        uint256 collateralFactor;
        uint256 totalSupplyUnderlying;
        uint256 totalBorrows;
        uint256 exchangeRate;
        uint256 supplyRatePerSecond;
        uint256 borrowRatePerSecond;
        uint256 utilization;

        (
            isListed,
            isActive,
            collateralFactor,
            totalSupplyUnderlying,
            totalBorrows,
            exchangeRate,
            supplyRatePerSecond,
            borrowRatePerSecond,
            utilization
        ) = pool.getMarketData(asset);

        if (!isListed) return s;

        uint256 price = 0;
        try oracle.getPrice(asset) returns (uint256 p) {
            price = p;
        } catch {}

        uint256 supplyAPY = supplyRatePerSecond * SECONDS_PER_YEAR;
        uint256 borrowAPY = borrowRatePerSecond * SECONDS_PER_YEAR;

        (uint256 supplySpeed, uint256 borrowSpeed) = _getRewardSpeeds(asset);

        s = MarketSummary({
            asset: asset,
            isActive: isActive,
            isNative: asset == address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE),
            collateralFactor: collateralFactor,
            totalSupplyUSD: (totalSupplyUnderlying * price) / 1e8,
            totalBorrowUSD: (totalBorrows * price) / 1e8,
            availableLiquidity: totalSupplyUnderlying > totalBorrows
                ? totalSupplyUnderlying - totalBorrows
                : 0,
            utilizationRate: utilization,
            supplyAPY: supplyAPY,
            borrowAPY: borrowAPY,
            exchangeRate: exchangeRate,
            supplyRewardSpeed: supplySpeed,
            borrowRewardSpeed: borrowSpeed
        });
    }

    function _getRewardSpeeds(address asset) internal view returns (
        uint256 supplySpeed,
        uint256 borrowSpeed
    ) {
        // marketRewards returns (supplyRewardSpeed, borrowRewardSpeed, supplyIndex, borrowIndex, lastUpdateTime)
        // We only need the first two fields
        uint256 si;
        uint256 bi;
        uint256 lt;
        (supplySpeed, borrowSpeed, si, bi, lt) = rewards.marketRewards(asset);
        // si, bi, lt intentionally unused — only speeds needed here
        si; bi; lt;
    }
}
