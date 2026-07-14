import { ethers } from "ethers";
import { getDeployer, getDebtTokenContract, parseEther, formatUnits, getProvider } from "./blockchain.service";
import * as fs from "fs";
import * as path from "path";

interface DeployTokenResult {
  contractAddress: string;
  txHash: string;
}

export async function deployDebtToken(
  ownerAddress: string,
  tokenName: string,
  symbol: string,
  initialSupply: number = 100
): Promise<DeployTokenResult> {
  const deployer = getDeployer();

  const artifactPath = path.join(
    __dirname,
    "../../../packages/contracts/artifacts/contracts/DebtToken.sol/DebtToken.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error("DebtToken artifact not found. Run: pnpm --filter @repo/contracts compile");
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

  const supplyInWei = parseEther(initialSupply.toString());
  const contract = await factory.deploy(tokenName, symbol, ownerAddress, supplyInWei);
  const deployTx = contract.deploymentTransaction();
  await contract.waitForDeployment();

  return {
    contractAddress: await contract.getAddress(),
    txHash: deployTx?.hash || "",
  };
}

export async function getTokenBalance(
  contractAddress: string,
  holderAddress: string
): Promise<string> {
  const token = getDebtTokenContract(contractAddress) as any;
  const balance: bigint = await token.balanceOf(holderAddress);
  return formatUnits(balance, 18);
}

export async function getTokenInfo(contractAddress: string) {
  const token = getDebtTokenContract(contractAddress) as any;
  const [name, symbol, totalSupply, maxSupply] = await Promise.all([
    token.name() as Promise<string>,
    token.symbol() as Promise<string>,
    token.totalSupply() as Promise<bigint>,
    token.maxSupply() as Promise<bigint>,
  ]);

  return {
    name,
    symbol,
    totalSupply: formatUnits(totalSupply, 18),
    maxSupply: formatUnits(maxSupply, 18),
    contractAddress,
  };
}

export async function transferTokens(
  contractAddress: string,
  fromWalletPrivateKey: string,
  toAddress: string,
  amount: string
): Promise<string> {
  const provider = getProvider();
  const signer = new ethers.Wallet(fromWalletPrivateKey, provider);
  const token = getDebtTokenContract(contractAddress, signer) as any;

  const amountInWei = parseEther(amount);
  const tx = await token.transfer(toAddress, amountInWei);
  await tx.wait();
  return tx.hash;
}

export { generateWallet } from "./blockchain.service";
