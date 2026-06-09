// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

// QIFlowOracle: Admin-controlled price oracle for QIFlow Protocol (Testnet / V1)
// Prices are in USD with 8 decimal places (e.g. $1.00 = 1e8)
//
// NOTE FOR MAINNET V2: Replace with a Chainlink aggregator.
// Each asset feed returns (, int256 price,,,) = feed.latestRoundData()
// Once QIE/USD is listed on Chainlink this can be upgraded.
contract QIFlowOracle is Ownable {
    // asset address => USD price (8 decimals)
    mapping(address => uint256) private prices;

    // Sentinel address used to represent native QIE in mappings
    address public constant NATIVE_QIE = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    event PriceSet(address indexed asset, uint256 price);

    constructor(address owner_) Ownable(owner_) {}

    /**
     * @notice Set price for an asset (admin only)
     * @param asset Token address (use NATIVE_QIE for native QIE)
     * @param priceUSD Price in USD with 8 decimals (e.g. $0.50 = 50_000_000)
     */
    function setPrice(address asset, uint256 priceUSD) external onlyOwner {
        require(priceUSD > 0, "QIFlowOracle: price must be > 0");
        prices[asset] = priceUSD;
        emit PriceSet(asset, priceUSD);
    }

    /**
     * @notice Set prices for multiple assets in one tx
     * @param assets Array of asset addresses
     * @param pricesUSD Array of USD prices (8 decimals)
     */
    function setPrices(
        address[] calldata assets,
        uint256[] calldata pricesUSD
    ) external onlyOwner {
        require(assets.length == pricesUSD.length, "QIFlowOracle: length mismatch");
        for (uint256 i = 0; i < assets.length; i++) {
            require(pricesUSD[i] > 0, "QIFlowOracle: price must be > 0");
            prices[assets[i]] = pricesUSD[i];
            emit PriceSet(assets[i], pricesUSD[i]);
        }
    }

    /**
     * @notice Get price of an asset in USD (8 decimals)
     * @param asset Token address
     * @return price USD price with 8 decimal precision
     */
    function getPrice(address asset) external view returns (uint256 price) {
        price = prices[asset];
        require(price > 0, "QIFlowOracle: price not set");
    }

    /**
     * @notice Check if price is available for an asset
     * @param asset Token address
     */
    function hasPrice(address asset) external view returns (bool) {
        return prices[asset] > 0;
    }
}
