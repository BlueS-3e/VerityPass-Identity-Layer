const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AttestationRegistry EIP-712", function () {
  it("should accept a typed-data signed attestation via publishAttestationTyped", async function () {
  const [, subject] = await ethers.getSigners();
  // create a dedicated wallet for the issuer so we can sign locally
  const issuerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    const Att = await ethers.getContractFactory("AttestationRegistry");
    const att = await Att.deploy();
    if (typeof att.waitForDeployment === 'function') await att.waitForDeployment();

    const schema = ethers.keccak256(ethers.toUtf8Bytes("income-proof-v1"));
    const cid = "ipfs://attCID-eip712";
    const expires = Math.floor(Date.now() / 1000) + 3600;

    const chainId = (await ethers.provider.getNetwork()).chainId;

    const abiCoder = new ethers.AbiCoder();
    const domainSeparator = await att.domainSeparator();
    const ATT_HASH = await att.ATTESTATION_TYPEHASH();
    const structHash = ethers.keccak256(abiCoder.encode([
      "bytes32","address","bytes32","bytes32","uint256"
    ], [
      ATT_HASH,
      subject.address,
      schema,
      ethers.keccak256(ethers.toUtf8Bytes(cid)),
      expires
    ]));

    const digest = ethers.keccak256(ethers.concat(["0x1901", domainSeparator, structHash]));

    // Sign the EIP-712 digest using signMessage over the digest bytes; the contract accepts both raw EIP-712 signatures and the prefixed signatures produced by signMessage
  const signature = await issuerWallet.signMessage(ethers.getBytes(digest));

    // Quick JS-side recovery for debugging: ensure the signature corresponds to the expected issuer
    // signMessage prefixes the data before signing; replicate that prefixing here to recover the address
    const prefixedHash = ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("\x19Ethereum Signed Message:\n32"), ethers.getBytes(digest)]));
    const jsRecoveredPref = ethers.recoverAddress(prefixedHash, signature);

    // sanity check at JS-level
    expect(jsRecoveredPref.toLowerCase()).to.equal(issuerWallet.address.toLowerCase());

    await expect(att.publishAttestationTyped(subject.address, schema, cid, expires, signature))
      .to.emit(att, "AttestationPublished");

    const a = await att.getAttestation(1);
  expect(a.issuer.toLowerCase()).to.equal(issuerWallet.address.toLowerCase());
    expect(a.subject).to.equal(subject.address);
    expect(a.schemaHash).to.equal(schema);
    expect(a.dataCID).to.equal(cid);
  });
});
