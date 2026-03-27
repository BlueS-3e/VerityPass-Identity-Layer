// Hardhat script to transfer ownership of the VerityPassLaunchpad contract
// Usage:
//   npx hardhat run --network <network> contracts/scripts/transfer-owner.js --newOwner <ADDRESS> --contract <CONTRACT_ADDR>

async function main() {
  const hre = require('hardhat');
  const argv = require('minimist')(process.argv.slice(2));
  const newOwner = argv.newOwner || process.env.NEW_OWNER;
  const contractAddr = argv.contract || process.env.CONTRACT_ADDR;
  if (!newOwner) throw new Error('newOwner required --newOwner <address> or env NEW_OWNER');
  if (!contractAddr) throw new Error('contract address required --contract <address> or env CONTRACT_ADDR');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Transferring ownership using deployer:', deployer.address);

  const contract = await hre.ethers.getContractAt('VerityPassLaunchpad', contractAddr, deployer);
  const tx = await contract.transferOwnership(newOwner);
  console.log('Sent transferOwnership tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('Ownership transfer receipt:', receipt.transactionHash);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
