const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AttestationRegistry", function () {
  it("should publish and retrieve attestations", async function () {
    const [issuer, subject] = await ethers.getSigners();
    const Att = await ethers.getContractFactory("AttestationRegistry");
    const att = await Att.deploy();
    if (typeof att.waitForDeployment === 'function') await att.waitForDeployment();

  const schema = ethers.keccak256(ethers.toUtf8Bytes("income-proof-v1"));
    const cid = "ipfs://attCID";
    const expires = Math.floor(Date.now() / 1000) + 3600;

    await expect(att.connect(issuer).publishAttestation(subject.address, schema, cid, expires))
      .to.emit(att, "AttestationPublished");

    const a = await att.getAttestation(1);
    expect(a.issuer).to.equal(issuer.address);
    expect(a.subject).to.equal(subject.address);
    expect(a.schemaHash).to.equal(schema);
    expect(a.dataCID).to.equal(cid);
    expect(a.expiresAt).to.equal(expires);
  });

  it("should accept a signed attestation via publishAttestationSigned", async function () {
    const [issuer, subject] = await ethers.getSigners();
    const Att = await ethers.getContractFactory("AttestationRegistry");
    const att = await Att.deploy();
    if (typeof att.waitForDeployment === 'function') await att.waitForDeployment();

    const schema = ethers.keccak256(ethers.toUtf8Bytes("income-proof-v1"));
    const cid = "ipfs://attCID2";
    const expires = Math.floor(Date.now() / 1000) + 3600;

    // Prepare encoded ABI and hash
    const abiCoder = new ethers.AbiCoder();
    const encoded = abiCoder.encode(["address","bytes32","string","uint256","address"], [subject.address, schema, cid, expires, att.target]);
    const hash = ethers.keccak256(encoded);

    // Sign the hash with the issuer (signMessage prefixes automatically)
    const signature = await issuer.signMessage(ethers.getBytes(hash));

    // publish using the signed submission
    await expect(att.publishAttestationSigned(subject.address, schema, cid, expires, signature))
      .to.emit(att, "AttestationPublished");

    const a = await att.getAttestation(1);
    expect(a.issuer).to.equal(issuer.address);
    expect(a.subject).to.equal(subject.address);
    expect(a.schemaHash).to.equal(schema);
    expect(a.dataCID).to.equal(cid);
  });

  it("should accept an EIP-712 typed attestation via publishAttestationTyped", async function () {
    const [issuer, subject] = await ethers.getSigners();
    const Att = await ethers.getContractFactory("AttestationRegistry");
    const att = await Att.deploy();
    if (typeof att.waitForDeployment === 'function') await att.waitForDeployment();

    const schema = ethers.keccak256(ethers.toUtf8Bytes("income-proof-v1"));
    const cid = "ipfs://attCID-typed";
    const expires = Math.floor(Date.now() / 1000) + 3600;

    // Build EIP-712 domain and types consistent with the contract
    const network = await ethers.provider.getNetwork();
    const domain = {
      name: "AttestationRegistry",
      version: "1",
      chainId: network.chainId,
      verifyingContract: att.target
    };

    const types = {
      Attestation: [
        { name: 'subject', type: 'address' },
        { name: 'schemaHash', type: 'bytes32' },
        { name: 'dataCIDHash', type: 'bytes32' },
        { name: 'expiresAt', type: 'uint256' }
      ]
    };

    const dataCIDHash = ethers.keccak256(ethers.toUtf8Bytes(cid));

    const value = {
      subject: subject.address,
      schemaHash: schema,
      dataCIDHash: dataCIDHash,
      expiresAt: expires
    };

  // Compute the EIP-712 digest and sign it using signMessage (which creates the
  // Ethereum Signed Message prefix). The contract prefers the prefixed recovery
  // path, so this will match recoverSigner(pref, signature) on-chain.
  const digest = ethers.TypedDataEncoder.hash(domain, types, value);
  const signature = await issuer.signMessage(ethers.getBytes(digest));

    // publish using the typed submission
    await expect(att.publishAttestationTyped(subject.address, schema, cid, expires, signature))
      .to.emit(att, "AttestationPublished");

    const a = await att.getAttestation(1);
    expect(a.issuer).to.equal(issuer.address);
    expect(a.subject).to.equal(subject.address);
    expect(a.schemaHash).to.equal(schema);
    expect(a.dataCID).to.equal(cid);
  });
});
