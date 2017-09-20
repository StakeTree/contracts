var StakeTreeMVP = artifacts.require("./StakeTreeMVP.sol");

const nowUnix = new Date().getTime()/1000 - 3000;
const nowParsed = parseInt(nowUnix.toFixed(0), 10);

// Deploy config
const config = {
  beneficiaryAddress: "0x905d7605f2c79d4dad2c42586f62bb4bae6dfdb3",
  withdrawalPeriod: 1209600, // 2 weeks
  startTime: nowParsed,
  sunsetWithdrawalPeriod: 5184000, // 2 months
  minimumFundingAmount: 10000000000000000 // 0.01 ether
};

module.exports = function(deployer) {
  deployer.deploy(StakeTreeMVP, config.beneficiaryAddress, config.withdrawalPeriod, config.startTime, config.sunsetWithdrawalPeriod, config.minimumFundingAmount);
};
