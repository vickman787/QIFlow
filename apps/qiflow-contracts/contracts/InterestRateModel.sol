// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InterestRateModel
 * @notice Jump Rate Model for QIFlow Protocol
 * @dev Rates are per-second, scaled by 1e18
 *
 * Below kink: borrowRate = baseRate + multiplier * utilization
 * Above kink: borrowRate = baseRate + multiplier * kink + jumpMultiplier * (utilization - kink)
 *
 * Default parameters (annualized):
 *   Base rate:        2%
 *   Multiplier:      10%
 *   Jump multiplier: 100%
 *   Kink:            80% utilization
 */
contract InterestRateModel is Ownable {
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant BASE = 1e18;

    uint256 public baseRatePerSecond;
    uint256 public multiplierPerSecond;
    uint256 public jumpMultiplierPerSecond;
    uint256 public kink; // scaled by 1e18, e.g. 0.8e18 = 80%

    event NewInterestParams(
        uint256 baseRate,
        uint256 multiplier,
        uint256 jumpMultiplier,
        uint256 kink
    );

    /**
     * @param baseRatePerYear Annual base rate (scaled 1e18). e.g. 0.02e18 = 2%
     * @param multiplierPerYear Annual multiplier (scaled 1e18). e.g. 0.10e18 = 10%
     * @param jumpMultiplierPerYear Annual jump multiplier (scaled 1e18). e.g. 1.0e18 = 100%
     * @param kink_ Utilization kink point (scaled 1e18). e.g. 0.8e18 = 80%
     */
    constructor(
        address owner_,
        uint256 baseRatePerYear,
        uint256 multiplierPerYear,
        uint256 jumpMultiplierPerYear,
        uint256 kink_
    ) Ownable(owner_) {
        baseRatePerSecond = baseRatePerYear / SECONDS_PER_YEAR;
        multiplierPerSecond = multiplierPerYear / SECONDS_PER_YEAR;
        jumpMultiplierPerSecond = jumpMultiplierPerYear / SECONDS_PER_YEAR;
        kink = kink_;

        emit NewInterestParams(
            baseRatePerSecond,
            multiplierPerSecond,
            jumpMultiplierPerSecond,
            kink
        );
    }

    /**
     * @notice Calculate utilization rate
     * @param cash  Available liquidity in pool
     * @param borrows Total outstanding borrows
     * @param reserves Total reserves held
     * @return Utilization rate scaled by 1e18
     */
    function utilizationRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public pure returns (uint256) {
        if (borrows == 0) return 0;
        uint256 total = cash + borrows - reserves;
        if (total == 0) return 0;
        return (borrows * BASE) / total;
    }

    /**
     * @notice Get the per-second borrow rate
     * @param cash Available liquidity
     * @param borrows Total borrows
     * @param reserves Total reserves
     * @return Borrow rate per second (scaled 1e18)
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public view returns (uint256) {
        uint256 util = utilizationRate(cash, borrows, reserves);

        if (util <= kink) {
            return baseRatePerSecond + (multiplierPerSecond * util) / BASE;
        } else {
            uint256 normalRate = baseRatePerSecond + (multiplierPerSecond * kink) / BASE;
            uint256 excessUtil = util - kink;
            return normalRate + (jumpMultiplierPerSecond * excessUtil) / BASE;
        }
    }

    /**
     * @notice Get the per-second supply rate
     * @param cash Available liquidity
     * @param borrows Total borrows
     * @param reserves Total reserves
     * @param reserveFactorMantissa Reserve factor (scaled 1e18)
     * @return Supply rate per second (scaled 1e18)
     */
    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveFactorMantissa
    ) external view returns (uint256) {
        uint256 oneMinusReserveFactor = BASE - reserveFactorMantissa;
        uint256 borrowRate = getBorrowRate(cash, borrows, reserves);
        uint256 rateToPool = (borrowRate * oneMinusReserveFactor) / BASE;
        uint256 util = utilizationRate(cash, borrows, reserves);
        return (util * rateToPool) / BASE;
    }

    /**
     * @notice Update interest rate model parameters (owner only)
     */
    function updateParams(
        uint256 baseRatePerYear,
        uint256 multiplierPerYear,
        uint256 jumpMultiplierPerYear,
        uint256 kink_
    ) external onlyOwner {
        baseRatePerSecond = baseRatePerYear / SECONDS_PER_YEAR;
        multiplierPerSecond = multiplierPerYear / SECONDS_PER_YEAR;
        jumpMultiplierPerSecond = jumpMultiplierPerYear / SECONDS_PER_YEAR;
        kink = kink_;
        emit NewInterestParams(
            baseRatePerSecond,
            multiplierPerSecond,
            jumpMultiplierPerSecond,
            kink
        );
    }
}
