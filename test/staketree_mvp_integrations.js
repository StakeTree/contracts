var StakeTreeMVP = artifacts.require("./StakeTreeMVP.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';

contract('StakeTreeMVP', function(accounts) {
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
      instance = await StakeTreeMVP.new(
        config.beneficiaryAddress, 
        config.withdrawalPeriod, 
        config.startTime, 
        config.sunsetWithdrawalPeriod,
        config.minimumFundingAmount,
      {from: account_a});
      deployed = true;
    }
  });

  describe('Init & unit tests of pure functions', async () => {
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

    it("[account c] should have arrived at withdrawal 0", async () => {
      const withdrawalCounter = await instance.getWithdrawalCounterForFunder.call(account_c);
      assert.equal(withdrawalCounter, 0, "Arrived at withdrawal 0");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw({from: account_a});
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 90, "Beneficiary has withdrawn 10%");
    });

    it("[account c] should refund by funder", async () => {
      await instance.refund({from: account_c});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Account B has been refunded 90. Wallet balance is now 0");
    });
  });

  describe('Complex integration test 1: one funder -> two withdrawals -> funder tops up -> three withdrawals -> funder refunds', async () => {
    it("[account d] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_d, to: instance.address, value: 10000});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 10000, "Contract has 100 wei balance");
    });

    it("[account d] should have arrived at withdrawal 1", async () => {
      const withdrawalCounter = await instance.getWithdrawalCounterForFunder.call(account_d);
      assert.equal(withdrawalCounter, 1, "Arrived at withdrawal 1");
    });

    // x2
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 9000, "Beneficiary has withdrawn 10%");
    });
    it("[account d] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 9000, "Account D has 9000 left to withdraw");
    });
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 8100, "Beneficiary has withdrawn 10%");
    });
    it("[account d] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 8100, "Account D has 81000 left to withdraw");
    });

    // Topup
    it("[account d] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_d, to: instance.address, value: 11900});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 20000, "Contract has 20000 wei balance");
    });
    it("[account d] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 20000, "Account D has 20000 left to withdraw");
    });

    // x3
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 18000, "Beneficiary has withdrawn 10%");
    });
    it("[account d] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 18000, "Account D has 9000 left to withdraw");
    });
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 16200, "Beneficiary has withdrawn 10%");
    });
    it("[account d] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 16200, "Account D has 81000 left to withdraw");
    });
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 14580, "Beneficiary has withdrawn 10%");
    });
    it("[account d] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 14580, "Account D has 9000 left to withdraw");
    });

    it("[account d] should refund their funds", async () => {
      await instance.refund({from: account_d});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Account D has been refunded 14580. Wallet balance is now 0");
    });

  });
  describe('Complex integration test 2: three funders arrive -> one tops up -> withdrawal -> refund one -> one tops up -> 2nd withdrawal -> refund two', async () => {
    // Three funders arrive
    it("[account d] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_d, to: instance.address, value: 100});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 100, "Contract has 100 wei balance");
    });
    it("[account e] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_e, to: instance.address, value: 200});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 300, "Contract has 300 wei balance");
    });
    it("[account f] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_f, to: instance.address, value: 300});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 600, "Contract has 600 wei balance");
    });

    it("should get total funders as 3", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 3, "There are 3 total funders");
    });

    // One tops up
    it("[account e] should add funds to the contract", async () => {
      await web3.eth.sendTransaction({from: account_e, to: instance.address, value: 800});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 1400, "Contract has 1100 wei balance");
    });

    // E 200 -> 1000
    it("[account e] should have funds correct balance", async () => {
      const balance = await instance.balanceOf.call(account_e);
      assert.equal(balance, 1000, "Account E has 1000 wei balance");
    });

    it("should still get total funders as 3", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 3, "There are 3 total funders");
    });

    // Withdraw
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 1260, "Beneficiary has withdrawn 10%");
    });

    // D 100 -> 90
    it("[account d] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 90, "Account D has 90 left to withdraw");
    });

    // E 1000 -> 900
    it("[account e] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_e);
      assert.equal(totalRefund, 900, "Account E has 900 left to withdraw");
    });

    // F 300 -> 270
    it("[account f] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
      assert.equal(totalRefund, 270, "Account F has 270 left to withdraw");
    });

    // Refund Account D
    // D 90 -> 0
    it("[account d] should refund their funds", async () => {
      await instance.refund({from: account_d});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 1170, "Account D has been refunded 90. Wallet balance is now 1170");
    });

    it("[account d] should fail refunding their funds again", async () => {
      try {
        await instance.refund({from: account_d});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    // Account F tops up
    // F 270 -> 600
    it("[account f] should add funds to the contract again", async () => {
      await web3.eth.sendTransaction({from: account_f, to: instance.address, value: 330});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 1500, "Contract has 1500 wei balance");
    });

    it("[account f] should get balance", async () => {
      const balance = await instance.balanceOf.call(account_f);
      assert.equal(balance, 600, "Account F has 600 wei balance");
    });

    // Withdraw
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getBalance.call();
      assert.equal(balanceAfter, 1350, "Beneficiary has withdrawn 10%");
    });

    // E 900 -> 810
    it("[account e] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_e);
      assert.equal(totalRefund, 810, "Account E has 567 left to withdraw");
    });

    // F 600 -> 540
    it("[account f] should have correct withdrawal amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
      assert.equal(totalRefund, 540, "Account F has 540 left to withdraw");
    });

    it("should show get withdrawal counter", async () => {
      const counter = await instance.getWithdrawalCounter.call();
      assert.equal(counter, 8, "Counter is 8");
    });

    // Refund last two accounts
    // 1350 -> 540
    it("[account e] should refund their funds", async () => {
      await instance.refund({from: account_e});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 540, "Account E has been refunded 810. Wallet balance is now 540");
    });

    // 540 -> 0
    it("[account f] should refund their funds", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
      await instance.refund({from: account_f});
      const balance = await instance.getBalance.call();
      assert.equal(balance, 0, "Account F has been refunded 540. Wallet balance is now 0");
    });

  });
});