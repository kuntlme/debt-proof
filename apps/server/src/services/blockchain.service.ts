import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

// ─── ABI loading ─────────────────────────────────────────────────────────────

function loadABI(contractName: string) {
  // Try to load from compiled contracts artifacts
  const artifactPaths = [
    path.join(__dirname, "../../../packages/contracts/artifacts/contracts", `${contractName}.sol`, `${contractName}.json`),
    path.join(__dirname, `../../contracts/artifacts/contracts/${contractName}.sol/${contractName}.json`),
  ];

  for (const p of artifactPaths) {
    if (fs.existsSync(p)) {
      const artifact = JSON.parse(fs.readFileSync(p, "utf8"));
      return artifact.abi;
    }
  }

  throw new Error(`ABI not found for ${contractName}. Run: pnpm --filter @repo/contracts compile`);
}

function loadDeployment(networkName: string = "localhost") {
  const deploymentPaths = [
    path.join(__dirname, "../../../packages/contracts/deployments", `${networkName}.json`),
  ];

  for (const p of deploymentPaths) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8"));
    }
  }

  return null;
}

// ─── Provider & Signer ───────────────────────────────────────────────────────

let _provider: ethers.JsonRpcProvider | null = null;
let _deployer: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

export function getDeployer(): ethers.Wallet {
  if (!_deployer) {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
    }
    _deployer = new ethers.Wallet(privateKey, getProvider());
  }
  return _deployer;
}

// ─── Contract instances ───────────────────────────────────────────────────────

export function getLoanManagerContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  const deployment = loadDeployment(process.env.NETWORK_NAME || "localhost");
  if (!deployment?.contracts?.LoanManager) {
    throw new Error("LoanManager not deployed. Run: pnpm --filter @repo/contracts deploy:local");
  }

  const abi = loadABI("LoanManager");
  const sp = signerOrProvider || getProvider();
  return new ethers.Contract(deployment.contracts.LoanManager, abi, sp);
}

export function getDebtTokenContract(contractAddress: string, signerOrProvider?: ethers.Signer | ethers.Provider) {
  const abi = loadABI("DebtToken");
  const sp = signerOrProvider || getProvider();
  return new ethers.Contract(contractAddress, abi, sp);
}

// ─── Wallet utilities ─────────────────────────────────────────────────────────

/**
 * Generate a new random Ethereum wallet.
 * Returns the address, encrypted keystore JSON, mnemonic phrase, and private key.
 * The mnemonic and privateKey are ONLY returned at onboarding — never stored in plain text.
 */
export async function generateWallet(encryptionPassword: string): Promise<{
  address: string;
  encryptedJson: string;
  mnemonic: string;
  privateKey: string;
}> {
  const wallet = ethers.Wallet.createRandom() as ethers.HDNodeWallet;
  const encryptedJson = await wallet.encrypt(encryptionPassword);
  return {
    address: wallet.address,
    encryptedJson,
    mnemonic: wallet.mnemonic?.phrase ?? "",
    privateKey: wallet.privateKey,
  };
}

/**
 * Decrypt a stored keystore JSON and return a connected Wallet.
 */
export async function decryptWallet(encryptedJson: string, password: string): Promise<ethers.HDNodeWallet | ethers.Wallet> {
  const wallet = await ethers.Wallet.fromEncryptedJson(encryptedJson, password);
  return wallet.connect(getProvider()) as ethers.HDNodeWallet | ethers.Wallet;
}

// ─── Gas estimation helpers ──────────────────────────────────────────────────

export function formatEther(value: bigint): string {
  return ethers.formatEther(value);
}

export function parseEther(value: string): bigint {
  return ethers.parseEther(value);
}

export function parseUnits(value: string, decimals: number = 18): bigint {
  return ethers.parseUnits(value, decimals);
}

export function formatUnits(value: bigint, decimals: number = 18): string {
  return ethers.formatUnits(value, decimals);
}

export { ethers };
