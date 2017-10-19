var StakeTreeMVP = artifacts.require("./StakeTreeMVP.sol");
var StakeTreeMVPFactory = artifacts.require("./StakeTreeMVPFactory.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';

contract('StakeTreeMVPFactory', function(accounts) {
  let instance;

  const account_a = accounts[0]; // Beneficiary
  const account_b = accounts[1];
  const account_c = accounts[2];

  const nowUnix = new Date().getTime()/1000;
  const nowParsed = parseInt(nowUnix.toFixed(0), 10);

  let deployed = false;

  const config = {
    beneficiaryAddress: account_a,
    withdrawalPeriod: 0,
    startTime: nowParsed,
    sunsetWithdrawalPeriod: 5184000, // 2 months
    minimumFundingAmount: 1
  };

  beforeEach(async () => {
    if(!deployed) {
      instance = await StakeTreeMVPFactory.new({from: account_a});
      deployed = true;
    }
  });

  describe('Deploy contract', async () => {
    it("should verify beneficiary address during deploy", async () => {
      await instance.newContract(
        config.beneficiaryAddress,
        config.withdrawalPeriod, 
        config.startTime, 
        config.sunsetWithdrawalPeriod,
        config.minimumFundingAmount,
        {from: account_a}
      );

      const contractAddress = await instance.getContractAddress.call({from: account_a});
      const newInstance = await StakeTreeMVP.at(contractAddress);
      const beneficiaryAddress = await newInstance.getBeneficiary.call();

      assert.equal(beneficiaryAddress, account_a, "Contract has been deployed");
    });

    it("should have 1 contract deployed", async () => {
      const count = await instance.contractCount.call();
      assert.equal(count, 1, "One contract should have been deployed");
    });
  });
});