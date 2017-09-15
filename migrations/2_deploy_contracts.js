var StakeTreeMVP = artifacts.require("./StakeTreeMVP.sol");

module.exports = function(deployer) {
  deployer.deploy(StakeTreeMVP);
};
