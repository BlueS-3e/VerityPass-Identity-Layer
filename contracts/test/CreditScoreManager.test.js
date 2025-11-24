const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CreditScoreManager", function () {
  let CreditScoreManager, manager, owner, oracle, other, subject;

  beforeEach(async function () {
    [owner, oracle, other, subject] = await ethers.getSigners();
    CreditScoreManager = await ethers.getContractFactory("CreditScoreManager");
    manager = await CreditScoreManager.connect(owner).deploy();
    await manager.waitForDeployment();
  });

  it("only owner can set oracle and oracle can publish score", async function () {
    // initially oracle not allowed
    expect(await manager.oracles(oracle.address)).to.equal(false);

    // set oracle by owner
    await expect(manager.connect(owner).setOracle(oracle.address, true))
      .to.emit(manager, "OracleUpdated").withArgs(oracle.address, true);

    expect(await manager.oracles(oracle.address)).to.equal(true);

    const scoreHash = ethers.keccak256(ethers.toUtf8Bytes("score:900"));
    const bucket = 5;

    // oracle publishes a score for subject
    await expect(manager.connect(oracle).publishScore(subject.address, scoreHash, bucket))
      .to.emit(manager, "ScorePublished");

    const stored = await manager.getScore(subject.address);
    expect(stored[0]).to.equal(scoreHash);
    expect(stored[1]).to.equal(bucket);
    expect(stored[3]).to.equal(oracle.address);
  });

  it("non-oracle cannot publish", async function () {
    const scoreHash = ethers.keccak256(ethers.toUtf8Bytes("score:100"));
    const bucket = 1;
    await expect(manager.connect(other).publishScore(subject.address, scoreHash, bucket))
      .to.be.revertedWith("only oracle");
  });
});
