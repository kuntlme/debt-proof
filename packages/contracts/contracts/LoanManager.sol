// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LoanManager
 * @author DebtProof
 * @notice Core smart contract managing peer-to-peer IOU (I Owe You) agreements.
 * @dev Borrowers lock collateral (DebtTokens) and lenders confirm loans.
 *      All loan lifecycle events are recorded immutably on-chain.
 *
 * Loan lifecycle:
 *   REQUESTED → ACTIVE (lender accepts) → REPAID (borrower repays) | DEFAULTED (lender calls default)
 *   REQUESTED → CANCELLED (borrower cancels before acceptance)
 */
contract LoanManager is ReentrancyGuard {

    // ─── Enums ───────────────────────────────────────────────────────────────

    enum LoanStatus {
        REQUESTED,  // 0 — borrower submitted; awaiting lender confirmation
        ACTIVE,     // 1 — lender confirmed; collateral locked
        REPAID,     // 2 — borrower repaid; collateral returned
        DEFAULTED,  // 3 — lender called default; collateral transferred to lender
        CANCELLED   // 4 — borrower cancelled before activation
    }

    // ─── Structs ─────────────────────────────────────────────────────────────

    /// @notice On-chain representation of a peer-to-peer loan (IOU)
    struct Loan {
        uint256 id;                    // Unique loan ID (auto-incrementing)
        address borrower;              // Address of the borrower
        address lender;                // Address of the lender
        uint256 amountINR;             // Loan amount in INR paise (1 INR = 100 paise) for precision
        address collateralToken;       // ERC-20 token contract used as collateral
        uint256 collateralAmount;      // Amount of collateral token locked (in wei)
        LoanStatus status;             // Current status of the loan
        uint256 createdAt;             // Unix timestamp of loan creation
        uint256 activatedAt;           // Unix timestamp when lender confirmed
        uint256 settledAt;             // Unix timestamp of repayment / default
        string offchainId;             // Database record ID for off-chain sync
    }

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 private _loanCounter;

    /// @dev loanId → Loan struct
    mapping(uint256 => Loan) private _loans;

    /// @dev address → array of loan IDs (borrower or lender)
    mapping(address => uint256[]) private _borrowerLoans;
    mapping(address => uint256[]) private _lenderLoans;

    // ─── Events ──────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new loan IOU is created
     * @param loanId    Unique on-chain loan ID
     * @param borrower  Address of the borrower
     * @param lender    Address of the lender
     * @param amountINR Loan amount in INR paise
     * @param collateralToken  ERC-20 token used as collateral
     * @param collateralAmount Amount of collateral tokens locked
     * @param offchainId Database record ID
     */
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed lender,
        uint256 amountINR,
        address collateralToken,
        uint256 collateralAmount,
        string offchainId
    );

    /**
     * @notice Emitted when a lender confirms (activates) a loan
     * @param loanId Unique on-chain loan ID
     * @param lender Address of the lender
     */
    event LoanActivated(uint256 indexed loanId, address indexed lender);

    /**
     * @notice Emitted when a borrower repays a loan
     * @param loanId   Unique on-chain loan ID
     * @param borrower Address of the borrower
     */
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);

    /**
     * @notice Emitted when a lender marks a loan as defaulted
     * @param loanId Unique on-chain loan ID
     * @param lender Address of the lender
     */
    event LoanDefaulted(uint256 indexed loanId, address indexed lender);

    /**
     * @notice Emitted when a borrower cancels a REQUESTED loan
     * @param loanId   Unique on-chain loan ID
     * @param borrower Address of the borrower
     */
    event LoanCancelled(uint256 indexed loanId, address indexed borrower);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyBorrower(uint256 loanId) {
        require(_loans[loanId].borrower == msg.sender, "LoanManager: not the borrower");
        _;
    }

    modifier onlyLender(uint256 loanId) {
        require(_loans[loanId].lender == msg.sender, "LoanManager: not the lender");
        _;
    }

    modifier inStatus(uint256 loanId, LoanStatus expected) {
        require(_loans[loanId].status == expected, "LoanManager: invalid loan status");
        _;
    }

    modifier loanExists(uint256 loanId) {
        require(loanId > 0 && loanId <= _loanCounter, "LoanManager: loan does not exist");
        _;
    }

    // ─── External Functions ──────────────────────────────────────────────────

    /**
     * @notice Create a new loan IOU. Borrower must approve collateral transfer first.
     * @dev    Transfers collateral tokens from borrower to this contract.
     * @param lender            Address of the lender
     * @param amountINR         Loan amount in INR paise (e.g., 5000 = ₹50.00)
     * @param collateralToken   ERC-20 token address to use as collateral
     * @param collateralAmount  Amount of collateral tokens (in wei)
     * @param offchainId        DB record ID for off-chain sync
     * @return loanId           The new loan's unique on-chain ID
     */
    function createLoan(
        address lender,
        uint256 amountINR,
        address collateralToken,
        uint256 collateralAmount,
        string calldata offchainId
    ) external nonReentrant returns (uint256 loanId) {
        require(lender != address(0), "LoanManager: invalid lender");
        require(lender != msg.sender, "LoanManager: cannot self-lend");
        require(amountINR > 0, "LoanManager: amount must be > 0");
        require(collateralToken != address(0), "LoanManager: invalid collateral token");
        require(collateralAmount > 0, "LoanManager: collateral must be > 0");

        // Transfer collateral from borrower to this contract
        bool success = IERC20(collateralToken).transferFrom(
            msg.sender,
            address(this),
            collateralAmount
        );
        require(success, "LoanManager: collateral transfer failed");

        // Create loan record
        _loanCounter++;
        loanId = _loanCounter;

        _loans[loanId] = Loan({
            id: loanId,
            borrower: msg.sender,
            lender: lender,
            amountINR: amountINR,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            status: LoanStatus.REQUESTED,
            createdAt: block.timestamp,
            activatedAt: 0,
            settledAt: 0,
            offchainId: offchainId
        });

        _borrowerLoans[msg.sender].push(loanId);
        _lenderLoans[lender].push(loanId);

        emit LoanCreated(loanId, msg.sender, lender, amountINR, collateralToken, collateralAmount, offchainId);
    }

    /**
     * @notice Lender confirms and activates a REQUESTED loan.
     * @param loanId  The loan to activate
     */
    function activateLoan(uint256 loanId)
        external
        loanExists(loanId)
        onlyLender(loanId)
        inStatus(loanId, LoanStatus.REQUESTED)
    {
        _loans[loanId].status = LoanStatus.ACTIVE;
        _loans[loanId].activatedAt = block.timestamp;
        emit LoanActivated(loanId, msg.sender);
    }

    /**
     * @notice Borrower repays the loan. Collateral is returned to borrower.
     * @dev    In a real system, repayment of actual INR happens off-chain (UPI/bank).
     *         This function records that repayment happened and releases collateral.
     * @param loanId  The loan to repay
     */
    function repayLoan(uint256 loanId)
        external
        nonReentrant
        loanExists(loanId)
        onlyBorrower(loanId)
        inStatus(loanId, LoanStatus.ACTIVE)
    {
        Loan storage loan = _loans[loanId];
        loan.status = LoanStatus.REPAID;
        loan.settledAt = block.timestamp;

        // Return collateral to borrower
        bool success = IERC20(loan.collateralToken).transfer(loan.borrower, loan.collateralAmount);
        require(success, "LoanManager: collateral return failed");

        emit LoanRepaid(loanId, msg.sender);
    }

    /**
     * @notice Lender marks an ACTIVE loan as defaulted. Collateral is transferred to lender.
     * @param loanId  The loan to default
     */
    function defaultLoan(uint256 loanId)
        external
        nonReentrant
        loanExists(loanId)
        onlyLender(loanId)
        inStatus(loanId, LoanStatus.ACTIVE)
    {
        Loan storage loan = _loans[loanId];
        loan.status = LoanStatus.DEFAULTED;
        loan.settledAt = block.timestamp;

        // Transfer collateral to lender as compensation
        bool success = IERC20(loan.collateralToken).transfer(loan.lender, loan.collateralAmount);
        require(success, "LoanManager: collateral transfer to lender failed");

        emit LoanDefaulted(loanId, msg.sender);
    }

    /**
     * @notice Borrower cancels a REQUESTED loan (before lender confirms).
     *         Collateral is returned to borrower.
     * @param loanId  The loan to cancel
     */
    function cancelLoan(uint256 loanId)
        external
        nonReentrant
        loanExists(loanId)
        onlyBorrower(loanId)
        inStatus(loanId, LoanStatus.REQUESTED)
    {
        Loan storage loan = _loans[loanId];
        loan.status = LoanStatus.CANCELLED;
        loan.settledAt = block.timestamp;

        // Return collateral to borrower
        bool success = IERC20(loan.collateralToken).transfer(loan.borrower, loan.collateralAmount);
        require(success, "LoanManager: collateral return failed");

        emit LoanCancelled(loanId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /**
     * @notice Get full details of a loan by ID
     * @param loanId  The loan ID to query
     * @return        The Loan struct
     */
    function getLoan(uint256 loanId) external view loanExists(loanId) returns (Loan memory) {
        return _loans[loanId];
    }

    /**
     * @notice Get all loan IDs where the address is the borrower
     * @param borrower  Address to query
     * @return          Array of loan IDs
     */
    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return _borrowerLoans[borrower];
    }

    /**
     * @notice Get all loan IDs where the address is the lender
     * @param lender  Address to query
     * @return        Array of loan IDs
     */
    function getLenderLoans(address lender) external view returns (uint256[] memory) {
        return _lenderLoans[lender];
    }

    /**
     * @notice Returns the total number of loans ever created
     * @return Total loan count
     */
    function totalLoans() external view returns (uint256) {
        return _loanCounter;
    }
}
