const HDWalletProvider = require("truffle-hdwallet-provider");
const config = require('./localConfig.js');

const mnemonic = config.mnemonic;

const rinkebyEngine = new HDWalletProvider(mnemonic, "https://rinkeby.infura.io");
const mainnetEngine = new HDWalletProvider(mnemonic, "https://mainnet.infura.io");

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },
    mainnet: {
      network_id: 1,
      provider: mainnetEngine,
      from: mainnetEngine.getAddress(),
      gas: 4700000,
      gasPrice: 20000000000,
    },
    rinkeby: {
      network_id: 4,
      provider: rinkebyEngine,
      from: rinkebyEngine.getAddress(),
      gas: 4700000,
      gasPrice: 20000000000,
    }
  }
};
