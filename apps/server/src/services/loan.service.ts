import { ethers } from "ethers";
import { getDeployer, getLoanManagerContract, getDebtTokenContract, getProvider } from "./blockchain.service.js";

/** Minimum ETH a wallet must hold to cover gas for approve + createLoan (≈ 0.01 ETH). */
const MIN_GAS_ETH = ethers.parseEther("0.01");
/** How much ETH to send when a wallet needs topping up. */
const FUND_AMOUNT_ETH = ethers.parseEther("0.1");

/**
 * Ensure `address` has enough ETH for gas on the local Hardhat node.
 * If the balance is below MIN_GAS_ETH, the deployer account funds it.
 * This is a no-op on testnets/mainnet where the deployer shouldn't be used as a faucet.
 */
async function ensureGasFunds(address: string): Promise<void> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  if (balance < MIN_GAS_ETH) {
    console.warn(
      `[loan.service] Wallet ${address} has only ${ethers.formatEther(balance)} ETH — auto-funding with ${ethers.formatEther(FUND_AMOUNT_ETH)} ETH from deployer.`
    );
    const deployer = getDeployer();
    const tx = await deployer.sendTransaction({ to: address, value: FUND_AMOUNT_ETH });
    await tx.wait();
    console.log(`[loan.service] Funded ${address} — new balance: ${ethers.formatEther(await provider.getBalance(address))} ETH`);
  }
}

export interface CreateLoanOnChainParams {
  lenderAddress: string;
  amountINRPaise: number;
  collateralTokenAddress: string;
  collateralAmountWei: string;
  offchainId: string;
  borrowerPrivateKey: string;
}

export interface LoanOnChainResult {
  loanId: number;
  txHash: string;
}

export async function createLoanOnChain(params: CreateLoanOnChainParams): Promise<LoanOnChainResult> {
  const provider = getProvider();
  const borrower = new ethers.Wallet(params.borrowerPrivateKey, provider);

  // ── Ensure the borrower wallet has ETH for gas fees ──────────────────────
  // Wallets generated before the auto-funding code existed (or where funding
  // silently failed during onboarding) will have 0 balance and cannot sign txs.
  await ensureGasFunds(borrower.address);

  const loanManager = getLoanManagerContract(borrower) as any;
  const loanManagerAddress = await loanManager.getAddress();

  const collateralToken = getDebtTokenContract(params.collateralTokenAddress, borrower) as any;

  // approve() — wait for the receipt before sending createLoan so nonce is
  // always accurate (avoids "replacement transaction underpriced" errors).
  const approveTx = await collateralToken.approve(
    loanManagerAddress,
    BigInt(params.collateralAmountWei)
  );
  await approveTx.wait();

  const tx = await loanManager.createLoan(
    params.lenderAddress,
    BigInt(params.amountINRPaise),
    params.collateralTokenAddress,
    BigInt(params.collateralAmountWei),
    params.offchainId
  );

  const receipt = await tx.wait();

  const loanCreatedEvent = receipt?.logs
    .map((log: any) => {
      try { return loanManager.interface.parseLog(log); } catch { return null; }
    })
    .find((e: any) => e?.name === "LoanCreated");

  const loanId = loanCreatedEvent ? Number(loanCreatedEvent.args[0]) : 0;
  return { loanId, txHash: tx.hash };
}

export async function activateLoanOnChain(loanId: number, lenderPrivateKey: string): Promise<string> {
  const provider = getProvider();
  const lender = new ethers.Wallet(lenderPrivateKey, provider);
  const loanManager = getLoanManagerContract(lender) as any;
  const tx = await loanManager.activateLoan(BigInt(loanId));
  await tx.wait();
  return tx.hash;
}

export async function repayLoanOnChain(
  loanId: number,
  borrowerPrivateKey: string,
  nonce?: number
): Promise<string> {
  const provider = getProvider();
  const borrower = new ethers.Wallet(borrowerPrivateKey, provider);
  const loanManager = getLoanManagerContract(borrower) as any;
  const tx = await loanManager.repayLoan(
    BigInt(loanId),
    nonce !== undefined ? { nonce } : {}
  );
  await tx.wait();
  return tx.hash;
}

export async function defaultLoanOnChain(loanId: number, lenderPrivateKey: string): Promise<string> {
  const provider = getProvider();
  const lender = new ethers.Wallet(lenderPrivateKey, provider);
  const loanManager = getLoanManagerContract(lender) as any;
  const tx = await loanManager.defaultLoan(BigInt(loanId));
  await tx.wait();
  return tx.hash;
}

export async function cancelLoanOnChain(loanId: number, borrowerPrivateKey: string): Promise<string> {
  const provider = getProvider();
  const borrower = new ethers.Wallet(borrowerPrivateKey, provider);
  const loanManager = getLoanManagerContract(borrower) as any;
  const tx = await loanManager.cancelLoan(BigInt(loanId));
  await tx.wait();
  return tx.hash;
}

export async function getLoanOnChain(loanId: number) {
  const loanManager = getLoanManagerContract() as any;
  const loan = await loanManager.getLoan(BigInt(loanId));
  return {
    id: Number(loan.id),
    borrower: loan.borrower,
    lender: loan.lender,
    amountINRPaise: Number(loan.amountINR),
    collateralToken: loan.collateralToken,
    collateralAmount: loan.collateralAmount.toString(),
    status: Number(loan.status),
    createdAt: Number(loan.createdAt),
    activatedAt: Number(loan.activatedAt),
    settledAt: Number(loan.settledAt),
    offchainId: loan.offchainId,
  };
}
