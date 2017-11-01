var StakeTreeWithTokenizationFactory = artifacts.require("./StakeTreeWithTokenizationFactory.sol");

// Deploy config
const nowUnix = new Date().getTime()/1000;
const nowParsed = parseInt(nowUnix.toFixed(0), 10);
const config = {
  beneficiaryAddress: "0x54C069bDc7eA8af577a57BdAFcCb097235Bf07BE",
  withdrawalPeriod: 604800, // 1 week
  // withdrawalPeriod: 120, // 2 min testing
  startTime: nowParsed,
  sunsetWithdrawalPeriod: 5184000, // 2 months
  minimumFundingAmount: 10000000000000000 // 0.01 ether
};

module.exports = function(deployer, network, accounts) {
  let factory;
  deployer.then(()=>{
    return StakeTreeWithTokenizationFactory.new();
  })
  .then((instance)=>{
    factory = instance;
    console.log("Factory address: ", factory.address);

    // Deploy new instance of MVP through factory
    if(network == "development") {
      return factory.newContract(
        config.beneficiaryAddress,
        config.withdrawalPeriod, 
        config.startTime, 
        config.sunsetWithdrawalPeriod,
        config.minimumFundingAmount,
        {from: accounts[0]}
      )
      .then(()=>{
        return factory.getContractAddress.call({from: accounts[0]});
      })
      .then((staketree)=>{
        console.log("Factory deployed address:", staketree);
        return staketree;
      });
    }

    return true;
  })
};