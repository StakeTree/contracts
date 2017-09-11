var Patronage = artifacts.require("./Patronage.sol");

module.exports = function(deployer) {
  deployer.deploy(Patronage);
};
