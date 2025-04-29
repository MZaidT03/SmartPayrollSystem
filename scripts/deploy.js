const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");

  console.log("Deploying Payroll contract...");
  const Payroll = await hre.ethers.getContractFactory("Payroll");
  const payroll = await Payroll.deploy();
  console.log("Transaction sent, waiting for confirmation...");

  await payroll.waitForDeployment();
  const contractAddress = await payroll.getAddress();
  console.log("Payroll deployed to:", contractAddress);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
