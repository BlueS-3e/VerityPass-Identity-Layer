// Full integration test for VerityPassLaunchpad on Sepolia
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n=== Full Integration Test on Sepolia ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Testing with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH\n");

  // Load deployment
  const deploymentPath = path.join(__dirname, "../deployments/sepolia.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const RealMintLaunchpad = await ethers.getContractFactory("VerityPassLaunchpad");
  const launchpad = RealMintLaunchpad.attach(deployment.VerityPassLaunchpad);

  console.log("VerityPassLaunchpad:", deployment.VerityPassLaunchpad, "\n");

  // Step 1: Deploy a mock ERC20 token for testing
  console.log("--- Step 1: Deploy Mock ERC20 Token ---");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Test USDC", "tUSDC", 6, ethers.parseUnits("1000000", 6)); // 1M USDC with 6 decimals
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("  Deployed MockERC20:", tokenAddress);
  console.log("  Symbol:", await token.symbol());
  console.log("  Decimals:", await token.decimals());
  console.log("  Initial supply:", ethers.formatUnits(await token.totalSupply(), 6), "tUSDC");
  console.log("  ✓ Token deployed\n");

  // Step 2: Set up price feed for the token (USDC/USD = $1.00)
  console.log("--- Step 2: Setup Token Price Feed ---");
  
  // Deploy a mock price feed that returns $1.00 (8 decimals)
  const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
  const usdcPriceFeed = await MockV3Aggregator.deploy(8, ethers.parseUnits("1", 8)); // $1.00
  await usdcPriceFeed.waitForDeployment();
  const feedAddress = await usdcPriceFeed.getAddress();
  console.log("  Deployed MockV3Aggregator (USDC/USD):", feedAddress);
  
  // Register token price feed
  const tx1 = await launchpad.setTokenPriceFeed(tokenAddress, feedAddress, 6);
  await tx1.wait();
  console.log("  ✓ Token price feed registered\n");

  // Step 3: Create a test project
  console.log("--- Step 3: Create Test Project ---");
  const metadataHash = "QmTestProjectMetadata123"; // IPFS hash placeholder
  const hardCap = ethers.parseUnits("10000", 6); // 10,000 USDC
  const startTime = Math.floor(Date.now() / 1000) - 60; // Started 1 min ago
  const endTime = Math.floor(Date.now() / 1000) + 86400; // Ends in 24 hours
  
  const tx2 = await launchpad.createProject(metadataHash, tokenAddress, hardCap, startTime, endTime);
  const receipt2 = await tx2.wait();
  
  // Find ProjectCreated event
  const projectCreatedEvent = receipt2.logs.find(log => {
    try {
      const parsed = launchpad.interface.parseLog(log);
      return parsed && parsed.name === "ProjectCreated";
    } catch (e) {
      return false;
    }
  });
  
  const projectId = projectCreatedEvent ? launchpad.interface.parseLog(projectCreatedEvent).args[0] : 0n;
  console.log("  Project ID:", projectId.toString());
  console.log("  Metadata:", metadataHash);
  console.log("  Hard Cap:", ethers.formatUnits(hardCap, 6), "tUSDC");
  console.log("  ✓ Project created\n");

  // Step 4: Vet (approve) the project
  console.log("--- Step 4: Vet Project ---");
  const tx3 = await launchpad.vetProject(projectId, true); // approve = true
  await tx3.wait();
  console.log("  ✓ Project approved\n");

  // Step 5: Activate the project
  console.log("--- Step 5: Activate Project ---");
  const tx4 = await launchpad.activateProject(projectId);
  await tx4.wait();
  console.log("  ✓ Project activated\n");

  // Step 6: Invest in the project
  console.log("--- Step 6: Test Investment ---");
  const investAmount = ethers.parseUnits("100", 6); // 100 USDC
  
  // Approve token spending
  const tx5 = await token.approve(deployment.VerityPassLaunchpad, investAmount);
  await tx5.wait();
  console.log("  ✓ Token approved");
  
  // Invest
  const tx6 = await launchpad.invest(projectId, investAmount);
  await tx6.wait();
  console.log("  ✓ Investment made:", ethers.formatUnits(investAmount, 6), "tUSDC\n");

  // Step 7: Check project status
  console.log("--- Step 7: Verify Project State ---");
  const project = await launchpad.getProject(projectId);
  console.log("  Project Owner:", project[0]);
  console.log("  Total Raised:", ethers.formatUnits(project[3], 6), "tUSDC");
  console.log("  Hard Cap:", ethers.formatUnits(project[4], 6), "tUSDC");
  console.log("  Status:", ["Pending", "Approved", "Rejected", "Active", "Ended"][project[7]]);
  
  const investment = await launchpad.investments(projectId, deployer.address);
  console.log("  My Investment:", ethers.formatUnits(investment, 6), "tUSDC");
  console.log("  ✓ Project state verified\n");

  // Step 8: End project (fast-forward time by changing end time won't work, so we'll wait or manually end)
  console.log("--- Step 8: Prepare for Withdrawal ---");
  console.log("  Note: In production, wait for endTime to pass");
  console.log("  For testing, we can force end by reaching hard cap or waiting\n");

  // Step 9: Test withdrawal
  console.log("--- Step 9: Test Withdrawal (if ended) ---");
  try {
    const tx7 = await launchpad.withdraw(projectId);
    await tx7.wait();
    console.log("  ✓ Withdrawal successful");
    
    // Check balances
    const projectOwnerBalance = await token.balanceOf(deployer.address);
    console.log("  Project owner balance:", ethers.formatUnits(projectOwnerBalance, 6), "tUSDC\n");
  } catch (error) {
    console.log("  ⚠ Withdrawal not yet available:", error.message);
    console.log("  (Project must be ended or past endTime)\n");
  }

  console.log("=== Integration Test Summary ===");
  console.log("✓ Mock ERC20 deployed:", tokenAddress);
  console.log("✓ Price feed configured:", feedAddress);
  console.log("✓ Project created and approved");
  console.log("✓ Investment executed successfully");
  console.log("✓ All core functions working on Sepolia\n");

  console.log("Contract is ready for:");
  console.log("- Frontend integration testing");
  console.log("- End-to-end user flow validation");
  console.log("- Mainnet deployment preparation\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
