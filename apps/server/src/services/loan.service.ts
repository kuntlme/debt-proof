import { ethers } from "ethers";
import { getDeployer, getLoanManagerContract, getDebtTokenContract, getProvider } from "./blockchain.service";

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

  const loanManager = getLoanManagerContract(borrower) as any;
  const loanManagerAddress = await loanManager.getAddress();

  const collateralToken = getDebtTokenContract(params.collateralTokenAddress, borrower) as any;
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

export async function repayLoanOnChain(loanId: number, borrowerPrivateKey: string): Promise<string> {
  const provider = getProvider();
  const borrower = new ethers.Wallet(borrowerPrivateKey, provider);
  const loanManager = getLoanManagerContract(borrower) as any;
  const tx = await loanManager.repayLoan(BigInt(loanId));
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
