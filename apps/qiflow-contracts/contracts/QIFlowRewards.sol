// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./QIFlowPool.sol";

// QIFlowRewards: Distributes QIF governance tokens to QIFlow suppliers and borrowers.
// Called by QIFlowPool on every user action via onUserAction().
contract QIFlowRewards is Ownable {
    using SafeERC20 for IERC20;

    struct RewardState {
        uint256 supplyRewardSpeed;
        uint256 borrowRewardSpeed;
        uint256 supplyIndex;
        uint256 borrowIndex;
        uint256 lastUpdateTime;
    }

    struct UserRewardState {
        uint256 supplyIndex;
        uint256 borrowIndex;
        uint256 accrued;
    }

    IERC20 public immutable qifToken;
    QIFlowPool public immutable pool;

    mapping(address => RewardState) public marketRewards;
    mapping(address => mapping(address => UserRewardState)) public userRewards;

    uint256 private constant BASE = 1e18;

    event RewardSpeedSet(address indexed asset, uint256 supplySpeed, uint256 borrowSpeed);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsAccrued(address indexed user, address indexed asset, uint256 amount);

    constructor(address owner_, address qifToken_, address pool_) Ownable(owner_) {
        qifToken = IERC20(qifToken_);
        pool = QIFlowPool(payable(pool_));
    }

    // ── admin ────────────────────────────────────────────────────────────────

    function setRewardSpeed(
        address asset,
        uint256 supplySpeed,
        uint256 borrowSpeed
    ) external onlyOwner {
        _updateMarketRewards(asset);
        marketRewards[asset].supplyRewardSpeed = supplySpeed;
        marketRewards[asset].borrowRewardSpeed = borrowSpeed;
        emit RewardSpeedSet(asset, supplySpeed, borrowSpeed);
    }

    // ── called by pool ───────────────────────────────────────────────────────

    function onUserAction(address user, address asset) external {
        require(msg.sender == address(pool), "QIFlowRewards: only pool");
        _updateMarketRewards(asset);
        _updateUserRewards(user, asset);
    }

    // ── claim ────────────────────────────────────────────────────────────────

    function claimRewards() external {
        address[] memory markets = pool.getAllMarkets();
        uint256 total = 0;

        for (uint256 i = 0; i < markets.length; i++) {
            address asset = markets[i];
            _updateMarketRewards(asset);
            _updateUserRewards(msg.sender, asset);
            total += userRewards[msg.sender][asset].accrued;
            userRewards[msg.sender][asset].accrued = 0;
        }

        if (total > 0) {
            uint256 available = qifToken.balanceOf(address(this));
            if (total > available) total = available;
            qifToken.safeTransfer(msg.sender, total);
            emit RewardsClaimed(msg.sender, total);
        }
    }

    function getPendingRewards(address user) external view returns (uint256 total) {
        address[] memory markets = pool.getAllMarkets();
        for (uint256 i = 0; i < markets.length; i++) {
            address asset = markets[i];
            UserRewardState storage urs = userRewards[user][asset];
            total += urs.accrued;

            RewardState storage rs = marketRewards[asset];
            uint256 elapsed = block.timestamp - rs.lastUpdateTime;

            uint256 totalSupplyAmt = _getTotalSupply(asset);
            if (totalSupplyAmt > 0 && rs.supplyRewardSpeed > 0) {
                uint256 newIndex = rs.supplyIndex + (elapsed * rs.supplyRewardSpeed * BASE) / totalSupplyAmt;
                uint256 userQTokens = _getUserQTokens(user, asset);
                total += (userQTokens * (newIndex - urs.supplyIndex)) / BASE;
            }

            uint256 totalBorrowsAmt = _getTotalBorrows(asset);
            if (totalBorrowsAmt > 0 && rs.borrowRewardSpeed > 0) {
                uint256 newIndex = rs.borrowIndex + (elapsed * rs.borrowRewardSpeed * BASE) / totalBorrowsAmt;
                uint256 userBorrowAmt = _getUserBorrows(user, asset);
                total += (userBorrowAmt * (newIndex - urs.borrowIndex)) / BASE;
            }
        }
    }

    // ── internals ────────────────────────────────────────────────────────────

    function _updateMarketRewards(address asset) internal {
        RewardState storage rs = marketRewards[asset];
        uint256 elapsed = block.timestamp - rs.lastUpdateTime;
        if (elapsed == 0) return;

        uint256 totalSupplyAmt = _getTotalSupply(asset);
        if (totalSupplyAmt > 0 && rs.supplyRewardSpeed > 0) {
            rs.supplyIndex += (elapsed * rs.supplyRewardSpeed * BASE) / totalSupplyAmt;
        }

        uint256 totalBorrowsAmt = _getTotalBorrows(asset);
        if (totalBorrowsAmt > 0 && rs.borrowRewardSpeed > 0) {
            rs.borrowIndex += (elapsed * rs.borrowRewardSpeed * BASE) / totalBorrowsAmt;
        }

        rs.lastUpdateTime = block.timestamp;
    }

    function _updateUserRewards(address user, address asset) internal {
        RewardState storage rs = marketRewards[asset];
        UserRewardState storage urs = userRewards[user][asset];

        uint256 supplyDelta = rs.supplyIndex - urs.supplyIndex;
        if (supplyDelta > 0) {
            uint256 userQTokens = _getUserQTokens(user, asset);
            uint256 earned = (userQTokens * supplyDelta) / BASE;
            urs.accrued += earned;
            emit RewardsAccrued(user, asset, earned);
        }
        urs.supplyIndex = rs.supplyIndex;

        uint256 borrowDelta = rs.borrowIndex - urs.borrowIndex;
        if (borrowDelta > 0) {
            uint256 userBorrowAmt = _getUserBorrows(user, asset);
            uint256 earned = (userBorrowAmt * borrowDelta) / BASE;
            urs.accrued += earned;
            emit RewardsAccrued(user, asset, earned);
        }
        urs.borrowIndex = rs.borrowIndex;
    }

    // Read totalSupplyUnderlying from pool.getMarketData (4th return value)
    function _getTotalSupply(address asset) internal view returns (uint256 result) {
        bool v1; bool v2; uint256 v3; uint256 v5; uint256 v6; uint256 v7; uint256 v8; uint256 v9;
        (v1, v2, v3, result, v5, v6, v7, v8, v9) = pool.getMarketData(asset);
    }

    // Read totalBorrows from pool.getMarketData (5th return value)
    function _getTotalBorrows(address asset) internal view returns (uint256 result) {
        bool v1; bool v2; uint256 v3; uint256 v4; uint256 v6; uint256 v7; uint256 v8; uint256 v9;
        (v1, v2, v3, v4, result, v6, v7, v8, v9) = pool.getMarketData(asset);
    }

    // Access qTokenBalance field directly from the UserSupply struct
    function _getUserQTokens(address user, address asset) internal view returns (uint256) {
        return pool.userSupply(user, asset);
    }

    function _getUserBorrows(address user, address asset) internal view returns (uint256) {
        return pool.getUserBorrowBalance(user, asset);
    }
}
