var StakeTree_MVP = artifacts.require("./StakeTree_MVP.sol");

module.exports = function(deployer) {
  deployer.deploy(StakeTree_MVP, "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1");
};
