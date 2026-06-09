// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title QIFlowToken
 * @notice Governance and rewards token for the QIFlow Protocol
 * @dev ERC20 token with minting (owner only) and burning capabilities
 * Symbol: QIF | Max Supply: 100,000,000
 */
contract QIFlowToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    event TokensMinted(address indexed to, uint256 amount);

    constructor(address initialOwner)
        ERC20("QIFlow Token", "QIF")
        Ownable(initialOwner)
    {
        // Mint 10M to deployer for rewards bootstrapping
        _mint(initialOwner, 10_000_000 * 1e18);
        emit TokensMinted(initialOwner, 10_000_000 * 1e18);
    }

    /**
     * @notice Mint QIF tokens — owner only, respects max supply cap
     * @param to Recipient address
     * @param amount Amount in wei (18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "QIFlowToken: max supply exceeded"
        );
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
}
