// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DebtToken
 * @author DebtProof
 * @notice A personal ERC-20 trust token that each user creates on the platform.
 * @dev Tokens act as collateral in the P2P lending system. The owner (user) can
 *      mint up to their maxSupply. Tokens can be transferred as collateral
 *      into the LoanManager contract.
 */
contract DebtToken is ERC20, Ownable {
    /// @notice Maximum token supply (default: 100 tokens)
    uint256 public maxSupply;

    /// @notice Emitted when new tokens are minted
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @param name      Human-readable token name (e.g., "Kuntal Token")
     * @param symbol    Ticker symbol (e.g., "KT")
     * @param owner     Address of the user who owns this token
     * @param _maxSupply Maximum mintable supply (in wei, 18 decimals)
     */
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        uint256 _maxSupply
    ) ERC20(name, symbol) Ownable(owner) {
        maxSupply = _maxSupply;
        // Mint full supply to the owner on creation
        _mint(owner, _maxSupply);
        emit TokensMinted(owner, _maxSupply);
    }

    /**
     * @notice Mint additional tokens (owner only, up to maxSupply)
     * @param to     Recipient address
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= maxSupply, "DebtToken: exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Increase the max supply (owner only)
     * @param newMaxSupply New maximum supply (must be >= current totalSupply)
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply >= totalSupply(), "DebtToken: new max below current supply");
        maxSupply = newMaxSupply;
    }
}
