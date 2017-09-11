var Patronage = artifacts.require("./Patronage.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';

contract('Patronage', function(accounts) {
  let instance;

  const account_a = accounts[0]; // Beneficiary
  const account_b = accounts[1];
  const account_c = accounts[2];

  const account_d = accounts[3];
  const account_e = accounts[4];
  const account_f = accounts[5];

  beforeEach(async () => {
    instance = await Patronage.deployed();
  });

  describe('Init & unit tests of decimal math', async () => {
    it("should set beneficiary address", async () => {
      await instance.setInitialBeneficiary(account_a);
      const beneficiary = await instance.getBeneficiary.call();
      assert.equal(beneficiary, account_a, "Beneficiary address has been set");
    });

    it("should set withdrawal timeframe to 0 for testing", async () => {
      await instance.changeWithdrawalPeriod(0);
      const withdrawalPeriod = await instance.withdrawalPeriod.call();
      assert.equal(withdrawalPeriod, 0, "Withdrawal period set to zero for integration testing");
    });

    it("should get initial balance of contract", async () => {
      const balance = await instance.getWithdrawalPool.call();
      assert.equal(balance, 0, "Contract initiated with 0 balance");
    });
  });

  describe('Account A', async () => {
    it("[account a] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_a, to: instance.address, value: 99});
      const balance = await instance.getWithdrawalPool.call();
      assert.equal(balance, 99, "Contract has 99 wei balance");
    });

    it("[account a] should show funds of funder", async () => {
      const balance = await instance.balanceOf.call(account_a);
      assert.equal(balance, 99, "Account A has 99 wei balance");
    });

    it("should get total funders", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("[account a] should add more funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_a, to: instance.address, value: 133});
      const balance = await instance.getWithdrawalPool.call();
      assert.equal(balance, 232, "Contract has 2000 wei balance");
    });

    it("[account b] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_b, to: instance.address, value: 345});
      const balance = await instance.getWithdrawalPool.call();
      assert.equal(balance, 577, "Contract has 577 wei balance");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdrawToBeneficiary();
      const balanceAfter = await instance.getWithdrawalPool.call();
      assert.equal(balanceAfter, 520, "Beneficiary has withdrawn 10%");
    });

    it("[account a] should get refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 208, "Account A can withdraw 208 wei balance");
    });

    it("[account b] should get refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_b);
      assert.equal(balance, 310, "Account B can withdraw 310 wei balance");
    });

    it("[account a] should refund funder", async () => {
      await instance.refundByFunder(account_a, {from: account_a});
      const balanceAfter = await instance.getWithdrawalPool.call();
      assert.equal(balanceAfter, 312, "Pool balance should be 312 wei balance");
    });

    it("[account b] should refund funder", async () => {
      await instance.refundByFunder(account_b, {from: account_b});
      const balanceAfter = await instance.getWithdrawalPool.call();
      assert.equal(balanceAfter, 2, "Pool balance should be 2 wei balance");
    });

    it("[account a] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_a, to: instance.address, value: 107});
      const balance = await instance.getWithdrawalPool.call();
      assert.equal(balance, 109, "Contract has 109 wei balance");
    });

    it("[account a] should get refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 107, "Account A can withdraw 107 wei balance");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdrawToBeneficiary();
      const balanceAfter = await instance.getWithdrawalPool.call();
      const actualBalance = await instance.getBalance.call();
      assert.equal(actualBalance, 99, "Beneficiary has withdrawn 10%");
    });

    it("[account a] should get refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 96, "Account A can withdraw 96 wei balance");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdrawToBeneficiary();
      const balanceAfter = await instance.getWithdrawalPool.call();
      const actualBalance = await instance.getBalance.call();
      assert.equal(actualBalance, 90, "Beneficiary has withdrawn 10%");
    });

    it("[account a] should get refund amount", async () => {
      const balance = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(balance, 86, "Account A can withdraw 86 wei balance");
    });

    it("[account a] should refund funder", async () => {
      await instance.refundByFunder(account_a, {from: account_a});
      const balanceAfter = await instance.getWithdrawalPool.call();
      assert.equal(balanceAfter, 4, "Pool balance should be 3 wei balance");
    });

  });
});