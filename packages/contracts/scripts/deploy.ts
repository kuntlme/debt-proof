import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // 1. Deploy LoanManager
  console.log("\n📄 Deploying LoanManager...");
  const LoanManager = await ethers.getContractFactory("LoanManager");
  const loanManager = await LoanManager.deploy();
  await loanManager.waitForDeployment();
  const loanManagerAddress = await loanManager.getAddress();
  console.log("✅ LoanManager deployed to:", loanManagerAddress);

  // 2. Deploy a sample DebtToken (for testing purposes)
  console.log("\n🪙 Deploying sample DebtToken...");
  const DebtToken = await ethers.getContractFactory("DebtToken");
  const initialSupply = ethers.parseEther("100"); // 100 tokens
  const debtToken = await DebtToken.deploy(
    "DebtProof Token",
    "DPT",
    deployer.address,
    initialSupply
  );
  await debtToken.waitForDeployment();
  const debtTokenAddress = await debtToken.getAddress();
  console.log("✅ Sample DebtToken deployed to:", debtTokenAddress);

  // Save deployment addresses to a JSON file for easy reference
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      LoanManager: loanManagerAddress,
      SampleDebtToken: debtTokenAddress,
    },
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const networkName = deploymentInfo.network === "unknown" ? "localhost" : deploymentInfo.network;
  const outputPath = path.join(outputDir, `${networkName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n📁 Deployment info saved to: ${outputPath}`);

  console.log("\n🚀 Deployment complete!");
  console.log("─────────────────────────────────");
  console.log("LoanManager:    ", loanManagerAddress);
  console.log("Sample DebtToken:", debtTokenAddress);
  console.log("─────────────────────────────────");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
