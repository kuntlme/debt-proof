import { expect } from "chai";
import { ethers } from "hardhat";
import { DebtToken, LoanManager } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DebtToken", function () {
  let debtToken: DebtToken;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  const INITIAL_SUPPLY = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    const DebtToken = await ethers.getContractFactory("DebtToken");
    debtToken = await DebtToken.deploy("Kuntal Token", "KT", owner.address, INITIAL_SUPPLY);
    await debtToken.waitForDeployment();
  });

  it("Should have correct name and symbol", async function () {
    expect(await debtToken.name()).to.equal("Kuntal Token");
    expect(await debtToken.symbol()).to.equal("KT");
  });

  it("Should mint full supply to owner on deployment", async function () {
    expect(await debtToken.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    expect(await debtToken.totalSupply()).to.equal(INITIAL_SUPPLY);
  });

  it("Should allow owner to transfer tokens", async function () {
    const amount = ethers.parseEther("10");
    await debtToken.transfer(user1.address, amount);
    expect(await debtToken.balanceOf(user1.address)).to.equal(amount);
  });

  it("Should reject mint beyond maxSupply", async function () {
    await expect(
      debtToken.mint(owner.address, ethers.parseEther("1"))
    ).to.be.revertedWith("DebtToken: exceeds max supply");
  });

  it("Should only allow owner to mint", async function () {
    await debtToken.setMaxSupply(ethers.parseEther("200"));
    await expect(
      debtToken.connect(user1).mint(user1.address, ethers.parseEther("10"))
    ).to.be.revertedWithCustomError(debtToken, "OwnableUnauthorizedAccount");
  });
});

describe("LoanManager", function () {
  let loanManager: LoanManager;
  let borrowerToken: DebtToken;
  let owner: HardhatEthersSigner;
  let borrower: HardhatEthersSigner;
  let lender: HardhatEthersSigner;

  const COLLATERAL_AMOUNT = ethers.parseEther("10"); // 10 tokens
  const LOAN_AMOUNT_INR = BigInt(500000); // ₹5000.00 in paise

  beforeEach(async function () {
    [owner, borrower, lender] = await ethers.getSigners();

    // Deploy LoanManager
    const LoanManagerFactory = await ethers.getContractFactory("LoanManager");
    loanManager = await LoanManagerFactory.deploy();
    await loanManager.waitForDeployment();

    // Deploy a DebtToken for borrower
    const DebtTokenFactory = await ethers.getContractFactory("DebtToken");
    borrowerToken = await DebtTokenFactory.deploy(
      "Borrower Token",
      "BT",
      borrower.address,
      ethers.parseEther("100")
    );
    await borrowerToken.waitForDeployment();

    // Borrower approves LoanManager to spend collateral
    await borrowerToken
      .connect(borrower)
      .approve(await loanManager.getAddress(), COLLATERAL_AMOUNT);
  });

  it("Should create a loan and lock collateral", async function () {
    const tx = await loanManager.connect(borrower).createLoan(
      lender.address,
      LOAN_AMOUNT_INR,
      await borrowerToken.getAddress(),
      COLLATERAL_AMOUNT,
      "db-record-id-001"
    );

    await expect(tx)
      .to.emit(loanManager, "LoanCreated")
      .withArgs(
        1,
        borrower.address,
        lender.address,
        LOAN_AMOUNT_INR,
        await borrowerToken.getAddress(),
        COLLATERAL_AMOUNT,
        "db-record-id-001"
      );

    // Collateral should be in LoanManager
    expect(
      await borrowerToken.balanceOf(await loanManager.getAddress())
    ).to.equal(COLLATERAL_AMOUNT);

    // Borrower's balance should be reduced
    expect(await borrowerToken.balanceOf(borrower.address)).to.equal(
      ethers.parseEther("90")
    );

    const loan = await loanManager.getLoan(1);
    expect(loan.status).to.equal(0); // REQUESTED
    expect(loan.borrower).to.equal(borrower.address);
    expect(loan.lender).to.equal(lender.address);
  });

  it("Should allow lender to activate a loan", async function () {
    await loanManager.connect(borrower).createLoan(
      lender.address,
      LOAN_AMOUNT_INR,
      await borrowerToken.getAddress(),
      COLLATERAL_AMOUNT,
      "db-001"
    );

    await expect(loanManager.connect(lender).activateLoan(1))
      .to.emit(loanManager, "LoanActivated")
      .withArgs(1, lender.address);

    const loan = await loanManager.getLoan(1);
    expect(loan.status).to.equal(1); // ACTIVE
  });

  it("Should return collateral when borrower repays", async function () {
    await loanManager.connect(borrower).createLoan(
      lender.address,
      LOAN_AMOUNT_INR,
      await borrowerToken.getAddress(),
      COLLATERAL_AMOUNT,
      "db-001"
    );
    await loanManager.connect(lender).activateLoan(1);

    const balanceBefore = await borrowerToken.balanceOf(borrower.address);

    await expect(loanManager.connect(borrower).repayLoan(1))
      .to.emit(loanManager, "LoanRepaid")
      .withArgs(1, borrower.address);

    // Collateral returned to borrower
    expect(await borrowerToken.balanceOf(borrower.address)).to.equal(
      balanceBefore + COLLATERAL_AMOUNT
    );

    const loan = await loanManager.getLoan(1);
    expect(loan.status).to.equal(2); // REPAID
  });

  it("Should transfer collateral to lender on default", async function () {
    await loanManager.connect(borrower).createLoan(
      lender.address,
      LOAN_AMOUNT_INR,
      await borrowerToken.getAddress(),
      COLLATERAL_AMOUNT,
      "db-001"
    );
    await loanManager.connect(lender).activateLoan(1);

    const lenderBalanceBefore = await borrowerToken.balanceOf(lender.address);

    await expect(loanManager.connect(lender).defaultLoan(1))
      .to.emit(loanManager, "LoanDefaulted")
      .withArgs(1, lender.address);

    // Collateral transferred to lender
    expect(await borrowerToken.balanceOf(lender.address)).to.equal(
      lenderBalanceBefore + COLLATERAL_AMOUNT
    );

    const loan = await loanManager.getLoan(1);
    expect(loan.status).to.equal(3); // DEFAULTED
  });

  it("Should allow borrower to cancel a REQUESTED loan", async function () {
    await loanManager.connect(borrower).createLoan(
      lender.address,
      LOAN_AMOUNT_INR,
      await borrowerToken.getAddress(),
      COLLATERAL_AMOUNT,
      "db-001"
    );

    const balanceBefore = await borrowerToken.balanceOf(borrower.address);

    await expect(loanManager.connect(borrower).cancelLoan(1))
      .to.emit(loanManager, "LoanCancelled")
      .withArgs(1, borrower.address);

    // Collateral returned
    expect(await borrowerToken.balanceOf(borrower.address)).to.equal(
      balanceBefore + COLLATERAL_AMOUNT
    );

    const loan = await loanManager.getLoan(1);
    expect(loan.status).to.equal(4); // CANCELLED
  });

  it("Should track borrower and lender loan lists", async function () {
    await loanManager.connect(borrower).createLoan(
      lender.address,
      LOAN_AMOUNT_INR,
      await borrowerToken.getAddress(),
      COLLATERAL_AMOUNT,
      "db-001"
    );

    const borrowerLoans = await loanManager.getBorrowerLoans(borrower.address);
    const lenderLoans = await loanManager.getLenderLoans(lender.address);

    expect(borrowerLoans.length).to.equal(1);
    expect(borrowerLoans[0]).to.equal(1);
    expect(lenderLoans.length).to.equal(1);
    expect(lenderLoans[0]).to.equal(1);
  });

  it("Should prevent non-borrower from repaying", async function () {
    await loanManager.connect(borrower).createLoan(
      lender.address,
      LOAN_AMOUNT_INR,
      await borrowerToken.getAddress(),
      COLLATERAL_AMOUNT,
      "db-001"
    );
    await loanManager.connect(lender).activateLoan(1);

    await expect(
      loanManager.connect(lender).repayLoan(1)
    ).to.be.revertedWith("LoanManager: not the borrower");
  });

  it("Should prevent self-lending", async function () {
    await borrowerToken
      .connect(borrower)
      .approve(await loanManager.getAddress(), COLLATERAL_AMOUNT);

    await expect(
      loanManager.connect(borrower).createLoan(
        borrower.address, // same as msg.sender
        LOAN_AMOUNT_INR,
        await borrowerToken.getAddress(),
        COLLATERAL_AMOUNT,
        "db-001"
      )
    ).to.be.revertedWith("LoanManager: cannot self-lend");
  });
});
