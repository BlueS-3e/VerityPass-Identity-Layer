// Test script for VerityPassLaunchpad on Sepolia testnet
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== Testing VerityPassLaunchpad on Sepolia ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Load deployment info
  const deploymentPath = path.join(__dirname, "../deployments/sepolia.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  console.log("Deployed contracts:");
  console.log("  VerityPassLaunchpad:", deployment.VerityPassLaunchpad);
  console.log("  Price Feed:", deployment.priceFeed, "\n");

  // Get contract instance
  const VerityPassLaunchpad = await ethers.getContractFactory("VerityPassLaunchpad");
  const launchpad = VerityPassLaunchpad.attach(deployment.VerityPassLaunchpad);

  // Test 1: Check contract owner and configuration
  console.log("--- Test 1: Contract Configuration ---");
  const owner = await launchpad.owner();
  const platformFee = await launchpad.platformFeeUsdCents();
  const platformPct = await launchpad.platformPctBps();
  const pctThreshold = await launchpad.pctThresholdUsdCents();
  const paused = await launchpad.paused();
  
  console.log("  Owner:", owner);
  console.log("  Platform Fee (USD cents):", platformFee.toString());
  console.log("  Platform Pct (bps):", platformPct.toString());
  console.log("  Pct Threshold (USD cents):", pctThreshold.toString());
  console.log("  Paused:", paused);
  console.log("  ✓ Configuration checked\n");

  // Test 2: Check price feed
  console.log("--- Test 2: Price Feed ---");
  try {
    const ethPrice = await launchpad.getLatestETHPrice();
    console.log("  ETH/USD Price:", ethers.formatUnits(ethPrice, 8), "USD");
    console.log("  ✓ Price feed working\n");
  } catch (error) {
    console.log("  ✗ Price feed error:", error.message, "\n");
  }

  // Test 3: Check project count
  console.log("--- Test 3: Project Count ---");
  const projectCount = await launchpad.getProjectCount();
  console.log("  Total Projects:", projectCount.toString());
  console.log("  ✓ Contract is accessible\n");

  // Test 4: Check paused state
  console.log("--- Test 4: Paused State ---");
  const isPaused = await launchpad.paused();
  console.log("  Paused:", isPaused);
  if (isPaused) {
    console.log("  ⚠ Contract is paused - unpause to allow operations\n");
  } else {
    console.log("  ✓ Contract is active\n");
  }

  console.log("=== Basic tests completed ===\n");
  console.log("Next steps:");
  console.log("1. Deploy a test ERC20 token for investments");
  console.log("2. Set up the token price feed");
  console.log("3. Create a test project");
  console.log("4. Test full investment flow\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
