const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RealMintLaunchpad - oracle staleness protection", function () {
  let Token, token, owner, alice, bob;
  let Launchpad, launchpad;
  let MockV3;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy("TestToken", "TST", 18, ethers.parseEther("10000"));
    await token.waitForDeployment();

    Launchpad = await ethers.getContractFactory("RealMintLaunchpad");
    launchpad = await Launchpad.deploy(ethers.ZeroAddress);
    await launchpad.waitForDeployment();

    MockV3 = await ethers.getContractFactory("MockV3Aggregator");
    // price = $2
    mockFeed = await MockV3.deploy(8, 200000000);
    await mockFeed.waitForDeployment();

    await launchpad.setTokenPriceFeed(token.target, mockFeed.target, 18);
    await launchpad.setPlatformFeeUsdCents(100);

    const block = await ethers.provider.getBlock('latest');
    const now = block.timestamp;
    await launchpad.connect(bob).createProject("QmHash", token.target, ethers.parseEther("1000"), now - 10, now + 1000);
    await launchpad.vetProject(0, true);
    await launchpad.activateProject(0);
  });

  it("reverts withdraw when feed is stale", async function () {
    // investor funds project
    await token.transfer(alice.address, ethers.parseEther("10"));
    await token.connect(alice).approve(launchpad.target, ethers.parseEther("10"));
    await launchpad.connect(alice).invest(0, ethers.parseEther("10"));

    // make feed stale by setting updatedAt far in the past
    const block = await ethers.provider.getBlock('latest');
    const staleTs = block.timestamp - 36000; // 10 hours ago
    await mockFeed.setUpdatedAt(staleTs);

    // advance time past end
    await network.provider.send("evm_increaseTime", [2000]);
    await network.provider.send("evm_mine");

    // withdraw should revert with 'stale price'
    await expect(launchpad.connect(bob).withdraw(0)).to.be.revertedWith('stale price');
  });
});
