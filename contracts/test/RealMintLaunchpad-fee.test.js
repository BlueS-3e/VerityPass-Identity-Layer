const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RealMintLaunchpad - USD fee flow", function () {
  let Token, token, owner, alice, bob;
  let Launchpad, launchpad;
  let MockV3;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy("TestToken", "TST", 18, ethers.parseEther("10000"));
    await token.waitForDeployment();

    Launchpad = await ethers.getContractFactory("RealMintLaunchpad");
    // deploy with a dummy price feed for ETH
    const dummyFeed = ethers.ZeroAddress;
    launchpad = await Launchpad.deploy(dummyFeed);
    await launchpad.waitForDeployment();

    // deploy mock price feed
    MockV3 = await ethers.getContractFactory("MockV3Aggregator");
    // price = $2.00 -> 200000000 (8 decimals)
    mockFeed = await MockV3.deploy(8, 200000000);
    await mockFeed.waitForDeployment();

    // register token feed and decimals
    await launchpad.setTokenPriceFeed(token.target, mockFeed.target, 18);

    // set $1 fee
    await launchpad.setPlatformFeeUsdCents(100);
  // ensure price staleness window is large for tests that fast-forward time
  await launchpad.setPriceStaleThreshold(1000000);

    // create project funded by alice
  const block = await ethers.provider.getBlock('latest');
  const now = block.timestamp;
  // create project owned by bob so platform owner is distinct
  await launchpad.connect(bob).createProject("QmHash", token.target, ethers.parseEther("1000"), now - 10, now + 1000);
  // vet and activate so investors can participate (owner is platform admin)
  await launchpad.vetProject(0, true);
  await launchpad.activateProject(0);
  });

  it("collects approximately $1 worth of tokens as fee on withdraw", async function () {
  // give alice some tokens and approve
  await token.transfer(alice.address, ethers.parseEther("20"));
  await token.connect(alice).approve(launchpad.target, ethers.parseEther("10"));
  await launchpad.connect(alice).invest(0, ethers.parseEther("10"));

  // Project already vetted & activated in beforeEach; just advance time past end
    // fast-forward: end project
    await network.provider.send("evm_increaseTime", [2000]);
    await network.provider.send("evm_mine");

  // withdraw as project owner (bob) and check platform owner's fee
  const ownerBalanceBefore = await token.balanceOf(owner.address);
  await launchpad.connect(bob).withdraw(0);
  const ownerBalanceAfter = await token.balanceOf(owner.address);

    const feeReceived = ownerBalanceAfter - ownerBalanceBefore;
    // fee should be close to $1. Price feed is $2/token, so $1 == 0.5 token
    expect(feeReceived).to.be.closeTo(ethers.parseEther("0.5"), ethers.parseEther("0.001"));
  });
});
