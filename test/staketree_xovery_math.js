var StakeTreeXOverY = artifacts.require("./StakeTreeXOverY.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';

contract('StakeTreeXOverY', function(accounts) {
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
      instance = await StakeTreeXOverY.new(
        config.beneficiaryAddress, 
        config.withdrawalPeriod, 
        config.startTime, 
        config.sunsetWithdrawalPeriod,
        // config.minimumFundingAmount,
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

  describe('Account A', async () => {
    it("[account a] should add funds to the contract", async () => {
      await instance.fund(9, {value: 1000, from: account_a});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 1000, "Contract has 1000 wei balance");
    });

    it("should confirm that dust amount is correct", async () => {
      const dust = await instance.dust.call();
      assert.equal(dust, 1, "Dust balance should be 1 wei balance");
    });

    it("[account a] should show correct refund amout for funder", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 999, "Account A has 999 wei balance");
    });

    it("[account a] should show correct balance on funder struct", async () => {
      const funder = await instance.funders.call(account_a);
      assert.equal(funder[1], 999, "Account A has 999 wei balance");
    });

    it("should get total funders", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("[account a] should add more funds to the contract", async () => {
      await instance.fund(9, {value: 1000, from: account_a});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 2000, "Contract has 2000 wei balance");
    });

    it("should confirm that dust amount is correct", async () => {
      const dust = await instance.dust.call();
      assert.equal(dust, 2, "Dust balance should be 2 wei balance");
    });

    it("[account b] should add funds to the contract", async () => {
      await instance.fund(9, {value: 500, from: account_b});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 2500, "Contract has 2500 wei balance");
    });

    it("[account a] should show correct refund amout for funder", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 1998, "Account A has 1998 wei balance");
    });

    it("[account b] should show correct refund amout for funder", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_b);
      assert.equal(balance, 495, "Account B has 495 wei balance");
    });

    it("should confirm that dust amount is correct", async () => {
      const dust = await instance.dust.call();
      assert.equal(dust, 7, "Dust balance should be 7 wei balance");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 2223, "Beneficiary has withdrawn");
    });

    it("[account a] should get correct refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 1776, "Account A can withdraw 1776 wei balance");
    });

    it("[account b] should get refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_b);
      assert.equal(balance, 440, "Account B can withdraw 440 wei balance");
    });

    it("[account a] should refund funder", async () => {
      await instance.refund({from: account_a});
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 447, "Pool balance should be 447 wei balance");
    });

    it("[account b] should refund funder", async () => {
      await instance.refund({from: account_b});
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 7, "Pool balance should be 7 wei balance");
    });

    it("[account a] should add funds to the contract", async () => {
      await instance.fund(9, {value: 500, from: account_a});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 507, "Contract has 507 wei balance");
    });

    it("[account a] should get correct refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 495, "Account A can withdraw 495 wei balance");
    });

    it("[account a] should get correct balance amount in struct", async () => {
      const funder = await instance.funders.call(account_a);
      assert.equal(funder[1], 495, "Account A has 385 wei balance");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const actualBalance = await instance.getContractBalance.call();
      assert.equal(actualBalance, 452, "Beneficiary has withdrawn");
    });

    it("[account a] should get correct refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 440, "Account A can withdraw 440 wei balance");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const actualBalance = await instance.getContractBalance.call();
      assert.equal(actualBalance, 397, "Beneficiary has withdrawn");
    });

    it("[account a] should get correct refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 385, "Account A can withdraw 385 wei balance");
    });

    it("[account a] should refund funder", async () => {
      await instance.refund({from: account_a});
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 12, "Pool balance should be 12 wei balance");
    });
  });
});