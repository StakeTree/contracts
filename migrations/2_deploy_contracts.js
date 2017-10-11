var StakeTreeMVP = artifacts.require("./StakeTreeMVP.sol");

const nowUnix = new Date().getTime()/1000;
const nowParsed = parseInt(nowUnix.toFixed(0), 10);

// Deploy config
const config = {
  beneficiaryAddress: "0x54C069bDc7eA8af577a57BdAFcCb097235Bf07BE",
  withdrawalPeriod: 604800, // 1 week
  // withdrawalPeriod: 120, // 2 min testing
  startTime: nowParsed,
  sunsetWithdrawalPeriod: 5184000, // 2 months
  minimumFundingAmount: 10000000000000000 // 0.01 ether
};

module.exports = function(deployer) {
  deployer.deploy(StakeTreeMVP, config.beneficiaryAddress, config.withdrawalPeriod, config.startTime, config.sunsetWithdrawalPeriod, config.minimumFundingAmount);
};
