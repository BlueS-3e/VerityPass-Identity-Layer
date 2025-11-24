const path = require("path");
const HDWalletProvider = require("@truffle/hdwallet-provider");

// Replace with your MetaMask mnemonic or private key (never commit this to git!)
const mnemonic = "";

// BSC Testnet RPC endpoint
const bscTestnetRpc = "https://bsc-testnet-dataseed.bnbchain.org/:8545/";

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
    bscTestnet: {
      provider: () => new HDWalletProvider(mnemonic, bscTestnetRpc),
      network_id: 97,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
    },
  },
  compilers: {
    solc: {
      version: "0.8.20",
    },
  },
  contracts_directory: path.join(__dirname, "contracts"),
  contracts_build_directory: path.join(__dirname, "build/contracts"),
};
