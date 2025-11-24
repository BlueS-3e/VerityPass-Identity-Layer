const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RealMintLaunchpad - hybrid fee + referral flow", function () {
  let Token, token, owner, alice, bob, charlie;
  let Launchpad, launchpad;
  let MockV3;

  beforeEach(async () => {
    [owner, alice, bob, charlie] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MockERC20");
    token = await Token.deploy("TestToken", "TST", 18, ethers.parseEther("100000"));
    await token.waitForDeployment();

    Launchpad = await ethers.getContractFactory("RealMintLaunchpad");
    const dummyFeed = ethers.ZeroAddress;
    launchpad = await Launchpad.deploy(dummyFeed);
    await launchpad.waitForDeployment();

    // deploy mock price feed: price = $2.00 -> 200000000 (8 decimals)
    MockV3 = await ethers.getContractFactory("MockV3Aggregator");
    mockFeed = await MockV3.deploy(8, 200000000);
    await mockFeed.waitForDeployment();

    // register token feed and decimals
    await launchpad.setTokenPriceFeed(token.target, mockFeed.target, 18);

    // set $1 flat fee
    await launchpad.setPlatformFeeUsdCents(100);
  // ensure price staleness window is large for tests that fast-forward time
  await launchpad.setPriceStaleThreshold(1000000);
    // enable pct fee 25 bps (0.25%)
    await launchpad.setPlatformPctBps(25);
    // set threshold to 0 so pct always applies in this test
    await launchpad.setPctThresholdUsdCents(0);

    // set referral rebates: 2% to referrer, 1% to referee
    await launchpad.setReferralRebateBps(200, 100);

    // create a project owned by bob
  const block = await ethers.provider.getBlock('latest');
  const now = block.timestamp;
    await launchpad.connect(bob).createProject("QmHash2", token.target, ethers.parseEther("1000000"), now - 10, now + 1000);
    await launchpad.vetProject(0, true);
    await launchpad.activateProject(0);
  });

  it("applies pct fee above threshold and credits referral rebates correctly", async function () {
    // fund investor (charlie) and invest
    const investAmount = ethers.parseEther("1000"); // 1000 tokens
    await token.transfer(charlie.address, investAmount);
    await token.connect(charlie).approve(launchpad.target, investAmount);
    await launchpad.connect(charlie).invest(0, investAmount);

    // register bob's referrer as alice (bob calls registerReferrer)
    await launchpad.connect(bob).registerReferrer(alice.address);

    // advance time past end
    await network.provider.send("evm_increaseTime", [2000]);
    await network.provider.send("evm_mine");

  // compute expected fees using on-chain helper for flat fee (use BigNumber ops)
  const flatUnits = await launchpad.usdCentsToTokenUnits(token.target, 100);
  // note: totalRaised is investAmount (1000 tokens)
  const proj = await launchpad.getProject(0);
  // convert to native BigInt for arithmetic (ethers v6 returns BigInt-like values)
  const totalRaised = BigInt(proj[3].toString());

  // payout after flat fee
  const flat = BigInt(flatUnits.toString());
  const payoutAfterFlat = totalRaised > flat ? totalRaised - flat : 0n;

  // pct fee = payoutAfterFlat * 25 / 10000
  const pctFee = (payoutAfterFlat * 25n) / 10000n;

  const totalFee = flat + pctFee;

  // compute debug values
  console.log('flatUnits', flat);
  console.log('pctFee', pctFee);
  console.log('totalFee', totalFee);
  console.log('totalRaised', totalRaised);
  console.log('payoutAfterFlat', payoutAfterFlat);
  console.log('projOwner', proj[0]);

  // balances before
  const ownerBefore = await token.balanceOf(owner.address);
  const aliceBefore = await token.balanceOf(alice.address);
  const bobBefore = await token.balanceOf(bob.address);
  console.log('ownerBefore', ownerBefore.toString());
  console.log('bobBefore', bobBefore.toString());

    // withdraw as project owner (bob)
    await launchpad.connect(bob).withdraw(0);

    // check platform owner collected fees (owner receives totalFee minus rebates)
  const referrerRebate = (totalFee * 200n) / 10000n; // 2%
  const refereeRebate = (totalFee * 100n) / 10000n; // 1%
  const ownerExpected = totalFee - referrerRebate - refereeRebate;

  const ownerAfter = await token.balanceOf(owner.address);
  const bobAfterWithdraw = await token.balanceOf(bob.address);
  console.log('ownerAfter', ownerAfter.toString());
  console.log('bobAfterWithdraw', bobAfterWithdraw.toString());
  const ownerDiff = BigInt(ownerAfter.toString()) - BigInt(ownerBefore.toString());
  console.log('computedOwnerDiff', ownerDiff.toString());
  console.log('ownerExpected', ownerExpected.toString());
  console.log('assert: ownerDiff == ownerExpected');
  expect(ownerDiff).to.equal(ownerExpected);

    // rebate balances should be credited (not auto-transferred)
    const aliceRebateBal = await launchpad.rebateBalance(token.target, alice.address);
    const bobRebateBal = await launchpad.rebateBalance(token.target, bob.address);
  console.log('assert: rebate balances');
  console.log('aliceRebateBal', aliceRebateBal.toString());
  console.log('bobRebateBal', bobRebateBal.toString());
  expect(BigInt(aliceRebateBal.toString())).to.equal(referrerRebate);
  expect(BigInt(bobRebateBal.toString())).to.equal(refereeRebate);

    // claim rebates and verify token balances increase accordingly
    await launchpad.connect(alice).claimRebate(token.target);
    await launchpad.connect(bob).claimRebate(token.target);

    const aliceAfter = await token.balanceOf(alice.address);
    const bobAfterFinal = await token.balanceOf(bob.address);

  console.log('assert: claim results');
  console.log('aliceAfter', aliceAfter.toString(), 'aliceBefore', aliceBefore.toString());
  console.log('bobAfterFinal', bobAfterFinal.toString(), 'bobBefore', bobBefore.toString());
  expect(aliceAfter - aliceBefore).to.equal(referrerRebate);
  // bobBefore was taken before withdraw; check bob's change from after-withdraw -> after-claim
  expect(bobAfterFinal - bobAfterWithdraw).to.equal(refereeRebate);
  });
});
