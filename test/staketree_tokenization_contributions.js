var StakeTreeWithTokenization = artifacts.require("./StakeTreeWithTokenization.sol");
var MiniMeToken = artifacts.require("./MiniMeToken.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';

contract('StakeTreeWithTokenization', function(accounts) {
  let instance;

  const account_a = accounts[0]; // Beneficiary
  const account_b = accounts[1];
  const account_c = accounts[2];

  const account_d = accounts[3];
  const account_e = accounts[4];
  const account_f = accounts[5];

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
      instance = await StakeTreeWithTokenization.new(
        config.beneficiaryAddress, 
        config.withdrawalPeriod, 
        config.startTime, 
        config.sunsetWithdrawalPeriod,
        config.minimumFundingAmount,
      {from: account_a});
      deployed = true;
    }
  });

  describe('Init & unit tests of decimal math', async () => {
    it("should have set beneficiary address during deploy", async () => {
      const beneficiary = await instance.getBeneficiary.call();
      assert.equal(beneficiary, account_a, "Beneficiary address has been set");
    });

    it("should have initial next withdrawal period in correct timeframe", async () => {
      const withdrawalPeriod = await instance.withdrawalPeriod.call();
      const nextWithdrawal = await instance.nextWithdrawal.call();
      const lastWithdrawal = await instance.lastWithdrawal.call();
      const timingIsCorrect = lastWithdrawal['c'][0] + withdrawalPeriod['c'][0] == nextWithdrawal['c'][0];
      assert.equal(timingIsCorrect, true, "Contract withdrawal timing is correctly setup");
    });

    it("should get initial balance of contract", async () => {
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Contract initiated with 0 balance");
    });
  });

  describe('Account A setup', async () => {
    it("[account a] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({gas: 150000, from: account_a, to: instance.address, value: 10000});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 10000, "Contract has 10000 wei balance");
    });
  });

  describe('Add tokenization', async () => {
    it("should not have been tokenized yet", async () => {
      const tokenized = await instance.tokenized.call();
      assert.equal(tokenized, false, "Contract is not tokenized");
    });

    it("should fail being called by non-beneficiary", async () => {
      try {
        await instance.addTokenization({from: account_b});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("[account a] should fail claiming tokens cause it's not tokenized yet", async () => {
      try {
         await instance.claimTokens();
         assert.equal(true, false);
       } catch (err) {
         assert.equal(err.message, ERROR_INVALID_OPCODE);
       }
    });

    it("should add a token contract", async () => {
      await instance.addTokenization();
      const tokenized = await instance.tokenized.call();
      assert.equal(tokenized, true, "Contract is tokenized");
    });

    it("should fail adding tokenization again", async () => {
      try {
        await instance.addTokenization();
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });
  });

  describe('Claiming tokens', async () => {
    it("[account a] should fail claiming tokens cause there is nothing to claim", async () => {
      try {
         await instance.claimTokens();
         assert.equal(true, false);
       } catch (err) {
         assert.equal(err.message, ERROR_INVALID_OPCODE);
       }
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 9000, "Beneficiary has withdrawn 10%");
    });

    it("should fail being called by non-funder", async () => {
      try {
        await instance.claimTokens({from: account_c});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("[account a] should claim tokens", async () => {
      await instance.claimTokens();
      const tokenContractAddr = await instance.tokenContract.call();
      const tokenContractInstance = await MiniMeToken.at(tokenContractAddr);
      const tokenBalance = await tokenContractInstance.balanceOf.call(account_a);
      assert.equal(tokenBalance, 1000, "Account A claimed 1000 tokens");
    });

    it("[account a] should have claimed all tokens", async () => {
      const contribution = await instance.getFunderContribution.call(account_a);
      const contributionClaimed = await instance.getFunderContributionClaimed.call(account_a);
      assert.deepEqual(contribution, contributionClaimed, "Account A claimed all their tokens");
    });

    it("[account a] should fail claiming tokens again", async () => {
      try {
         await instance.claimTokens();
         assert.equal(true, false);
       } catch (err) {
         assert.equal(err.message, ERROR_INVALID_OPCODE);
       }
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 8100, "Beneficiary has withdrawn 10%");
    });

    it("[account a] should have the right contribution amount calculated on the fly", async () => {
      const contribution = await instance.getFunderContribution.call(account_a);
      assert.equal(contribution, 1900, "Account A contributed 1900");
    });

    it("[account a] should add more funds to the contract", async () => {
      await web3.eth.sendTransaction({gas: 150000, from: account_a, to: instance.address, value: 10000});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 18100, "Contract has 18100 wei balance");
    });

    it("[account a] should have the correct balance after adding more funds", async () => {
      const balance = await instance.getFunderBalance.call(account_a);
      assert.equal(balance, 18100, "Account A has 18100 wei balance");
    });

    it("[account a] should have the right contribution amount", async () => {
      const contribution = await instance.getFunderContribution.call(account_a);
      assert.equal(contribution, 1900, "Account A contributed 1900");
    });

    it("[account a] should have the right contribution claimed amount", async () => {
      const contribution = await instance.getFunderContributionClaimed.call(account_a);
      assert.equal(contribution, 1000, "Account A claimed 1000");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 16290, "Beneficiary has withdrawn 10%");
    });

    it("[account a] should claim tokens", async () => {
      await instance.claimTokens();
      const tokenContractAddr = await instance.tokenContract.call();
      const tokenContractInstance = await MiniMeToken.at(tokenContractAddr);
      const tokenBalance = await tokenContractInstance.balanceOf.call(account_a);
      assert.equal(tokenBalance, 3710, "Account A claimed tokens");
    });

    it("[account a] should have claimed all tokens", async () => {
      const contribution = await instance.getFunderContribution.call(account_a);
      const contributionClaimed = await instance.getFunderContributionClaimed.call(account_a);
      assert.deepEqual(contribution, contributionClaimed, "Account A claimed all their tokens");
    });
  });
});