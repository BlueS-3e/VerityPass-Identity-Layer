const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityRegistry", function () {
  it("should allow creating and updating an identity", async function () {
    const [owner, other] = await ethers.getSigners();
    const Identity = await ethers.getContractFactory("IdentityRegistry");
    const id = await Identity.deploy();
    // waitForDeployment is available in ethers v6
    if (typeof id.waitForDeployment === 'function') {
      await id.waitForDeployment();
    }

    // create
    await expect(id.connect(owner).createIdentity("ipfs://cid1"))
      .to.emit(id, "IdentityCreated").withArgs(owner.address, "ipfs://cid1");

    expect(await id.getMetadata(owner.address)).to.equal("ipfs://cid1");

    // update
    await expect(id.connect(owner).updateIdentity("ipfs://cid2"))
      .to.emit(id, "IdentityUpdated").withArgs(owner.address, "ipfs://cid1", "ipfs://cid2");

    expect(await id.getMetadata(owner.address)).to.equal("ipfs://cid2");

    // can't create again from same owner
    await expect(id.connect(owner).createIdentity("ipfs://cidx")).to.be.revertedWith("Identity exists");

    // other can't update without create
    await expect(id.connect(other).updateIdentity("x")).to.be.revertedWith("Identity missing");
  });
});
