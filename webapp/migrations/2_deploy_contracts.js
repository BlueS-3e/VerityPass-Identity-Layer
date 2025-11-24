const RealMintLaunchpad = artifacts.require("RealMintLaunchpad");

module.exports = async function (deployer, network, accounts) {
  // For local testnet, use a dummy Chainlink price feed address (deploy a mock if needed)
  const priceFeedAddress = ""; // Replace with real address for testnet/mainnet
  await deployer.deploy(RealMintLaunchpad, priceFeedAddress);
};
