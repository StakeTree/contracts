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

  describe('Init & unit tests of pure functions', async () => {
    it("should set beneficiary address", async () => {
      await instance.setInitialBeneficiary(account_a);
      const beneficiary = await instance.getBeneficiary.call();
      assert.equal(beneficiary, account_a, "Beneficiary address has been set");
    });

    it("should fail setting beneficiary address again", async () => {
      try {
        await instance.setInitialBeneficiary(account_a);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
        return;
      }    
    });

    it("should get initial balance of contract", async () => {
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Contract initiated with 0 balance");
    });

    it("should calculate withdrawal amount", async () => {
      const amount = await instance.calculateWithdrawalAmount.call(1000);
      assert.equal(amount, 100, "Calculated withdrawal amount");
    });
  });

  describe('Account A unit testing', async () => {
    it("[account a] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_a, to: instance.address, value: 1000});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 1000, "Contract has 1000 wei balance");
    });

    it("[account a] should show funds of funder", async () => {
      const balance = await instance.balanceOf.call(account_a);
      assert.equal(balance, 1000, "Account A has 1000 wei balance");
    });

    it("should get total funders", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("[account a] should add more funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_a, to: instance.address, value: 1000});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 2000, "Contract has 2000 wei balance");
    });

    it("[account a] should show funds of funder increased", async () => {
      const balance = await instance.balanceOf.call(account_a);
      assert.equal(balance, 2000, "Account A has 2000 wei balance");
    });

    it("should still get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });
  });

  describe('Add account b integration testing', async () => {
    it("[account b] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_b, to: instance.address, value: 500});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 2500, "Contract has 2500 wei balance");
    });

    it("[account b] should show funds of funder", async () => {
      const balance = await instance.balanceOf.call(account_b);
      assert.equal(balance, 500, "Account B has 500 wei balance");
    });

    it("should get total funders as 2", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 2, "There are 2 total funders");
    });
  });
  
  describe('Withdrawal testing', async () => {
    it("should withdraw to beneficiary", async () => {
      await instance.withdrawToBeneficiary();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 2250, "Beneficiary has withdrawn 10%");
    });

    it("should get withdrawal counter", async () => {
      const counter = await instance.getWithdrawalCounter.call();
      assert.equal(counter, 1, "Withdrawal counter is 1");
    });

    it("should fail to refund if refunding done by different account", async () => {
      try {
        await instance.refundByFunder(account_a, {from: account_b});
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
        return;
      }
    });
  });

  describe('Refund testing', async () => {
    it("[account a] should refund by funder", async () => {
      await instance.refundByFunder(account_a, {from: account_a});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 450, "Account A has been refunded 1800. Wallet balance is now 450");
    });

    it("should get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("[account b] should refund by funder", async () => {
      await instance.refundByFunder(account_b, {from: account_b});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Account B has been refunded 450. Wallet balance is now 0");
    });

    it("should get total funders as 0", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 0, "There are 0 total funders");
    });
  });

  describe('Simple integration test: New funder, account_c, arrives, withdrawal happens and then refund', async () => {
    it("[account c] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_c, to: instance.address, value: 100});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 100, "Contract has 100 wei balance");
    });

    it("should get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 0 total funders");
    });

    it("[account c] should have arrived at withdrawal 1", async () => {
      const withdrawalCounter = await instance.getWithdrawalCounterForFunder.call(account_c);
      assert.equal(withdrawalCounter, 1, "Arrived at withdrawal 1");
    });

    it("should withdraw to beneficiary again", async () => {
      await instance.withdrawToBeneficiary({from: account_a});
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 90, "Beneficiary has withdrawn 10%");
    });

    it("[account c] should refund by funder", async () => {
      await instance.refundByFunder(account_c, {from: account_c});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Account B has been refunded 90. Wallet balance is now 0");
    });
  });
});