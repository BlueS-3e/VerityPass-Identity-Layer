/** @type import('hardhat/config').HardhatUserConfig */
require('dotenv').config();
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    // BSC / BNB Chain mainnet
    bsc: {
      url: process.env.BSC_RPC_URL || process.env.RPC_URL || 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    },
    // BSC Testnet
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || process.env.RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      chainId: 97,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    },
    // Ethereum networks (mainnet + sepolia)
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY || ''}`,
      chainId: 11155111,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || process.env.RPC_URL || `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY || ''}`,
      chainId: 1,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      bsc: process.env.BSCSCAN_API_KEY || '',
      bscTestnet: process.env.BSCSCAN_API_KEY || ''
    }
  },
  mocha: {
    timeout: 60000
  }
};
