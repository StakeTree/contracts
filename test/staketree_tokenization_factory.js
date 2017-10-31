var StakeTreeWithTokenization = artifacts.require("./StakeTreeWithTokenization.sol");
var StakeTreeWithTokenizationFactory = artifacts.require("./StakeTreeWithTokenizationFactory.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';

contract('StakeTreeWithTokenizationFactory', function(accounts) {
  let instance;

  const account_a = accounts[0]; // Beneficiary

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
      instance = await StakeTreeWithTokenizationFactory.new({from: account_a});
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
      const newInstance = await StakeTreeWithTokenization.at(contractAddress[0]);
      const beneficiaryAddress = await newInstance.getBeneficiary.call();

      assert.equal(beneficiaryAddress, account_a, "Contract has been deployed");
    });

    it("should have 1 contract deployed", async () => {
      const count = await instance.contractCount.call();
      assert.equal(count, 1, "One contract should have been deployed");
    });

    it("should verify beneficiary address during next deploy", async () => {
      await instance.newContract(
        "0x46d8ceed94ce7583cdee1e7e54e60bf38fa41dfc",
        config.withdrawalPeriod, 
        config.startTime, 
        config.sunsetWithdrawalPeriod,
        config.minimumFundingAmount,
        {from: account_a}
      );

      const contractAddress = await instance.getContractAddress.call({from: account_a});
      const newInstance = await StakeTreeWithTokenization.at(contractAddress[1]);
      const beneficiaryAddress = await newInstance.getBeneficiary.call();

      assert.equal(beneficiaryAddress, "0x46d8ceed94ce7583cdee1e7e54e60bf38fa41dfc", "2nd contract has been deployed");
    });

    it("should have 2 contracts deployed", async () => {
      const count = await instance.contractCount.call();
      assert.equal(count, 2, "Two contracts should have been deployed");
    });
  });
});