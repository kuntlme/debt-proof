/**
 * @repo/contracts
 *
 * Exports compiled contract ABIs, bytecodes, and deployment addresses so that
 * other workspace packages (e.g. the server) can import them as a proper
 * package dependency instead of resolving brittle __dirname relative paths.
 */

import * as fs from "fs";
import * as path from "path";

// ── Artifact helpers ──────────────────────────────────────────────────────────

function loadArtifact(contractName: string): { abi: any[]; bytecode: string; contractName: string } {
  const p = path.join(
    __dirname,
    "../../artifacts/contracts",
    `${contractName}.sol`,
    `${contractName}.json`
  );
  if (!fs.existsSync(p)) {
    throw new Error(
      `Artifact for ${contractName} not found at ${p}. Run: pnpm --filter @repo/contracts compile`
    );
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as {
    abi: any[];
    bytecode: string;
    contractName: string;
  };
}

// ── Pre-loaded artifacts ──────────────────────────────────────────────────────

export const DebtTokenArtifact = loadArtifact("DebtToken");
export const LoanManagerArtifact = loadArtifact("LoanManager");

export const DebtTokenABI = DebtTokenArtifact.abi;
export const DebtTokenBytecode = DebtTokenArtifact.bytecode;

export const LoanManagerABI = LoanManagerArtifact.abi;

// ── Deployment addresses ──────────────────────────────────────────────────────

export interface DeploymentInfo {
  network: string;
  chainId: string;
  deployedAt: string;
  deployer: string;
  contracts: {
    LoanManager?: string;
    SampleDebtToken?: string;
    [key: string]: string | undefined;
  };
}

export function loadDeployment(networkName: string = "localhost"): DeploymentInfo | null {
  const p = path.join(__dirname, "../../deployments", `${networkName}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as DeploymentInfo;
}
