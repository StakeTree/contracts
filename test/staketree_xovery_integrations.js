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
      await instance.fund(20, {value: 100, from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 100, "Contract has 100 wei balance");
    });

    it("should get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There is 1 total funders");
    });

    it("[account c] should have arrived at withdrawal 0", async () => {
      const withdrawalCounter = await instance.getWithdrawalEntryForFunder.call(account_c);
      assert.equal(withdrawalCounter, 0, "Arrived at withdrawal 0");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw({from: account_a});
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 95, "Beneficiary has withdrawn");
    });

    it("[account c] should refund by funder", async () => {
      await instance.refund({from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Account C has been refunded 95. Wallet balance is now 0");
    });
  });

  describe('Simple integration test: New funder, account_c arrives with two different payments, withdrawal, refund', async () => {
    it("[account c] should add funds to the contract", async () => {
      await instance.fund(5, {value: 100, from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 100, "Contract has 100 wei balance");
    });

    it("[account c] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_c);
      assert.equal(totalRefund, 100, "Account C 100 left to refund");
    });

    it("should get correct withdrawal amount at future position", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+3);
      assert.equal(futureWithdrawal, 20, "Future withdrawal is 20");
    });

    // Add funds on different schedule
    it("[account c] should add funds to the contract", async () => {
      await instance.fund(2, {value: 100, from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 200, "Contract has 200 wei balance");
    });

    it("[account c] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_c);
      assert.equal(totalRefund, 200, "Account C 200 left to refund");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 70, "Next withdrawal is 70");
    });

    it("should get correct withdrawal amount at future position", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+3);
      assert.equal(futureWithdrawal, 20, "Future withdrawal is 20");
    });

    it("should get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There is 1 total funders");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw({from: account_a});
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 130, "Beneficiary has withdrawn");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 70, "Next withdrawal is 70");
    });

    it("[account c] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_c);
      assert.equal(totalRefund, 130, "Account C has 130 left to refund");
    });

    it("[account c] should refund by funder", async () => {
      await instance.refund({from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Account C has been refunded. Wallet balance is now 0");
    });

    it("[account c] should have no amount left to refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_c);
      assert.equal(totalRefund, 0, "Account C has nothing left to refund");
    });

    it("[account c] should have no allocation left", async () => {
      let currentWithdrawalCounter = await instance.withdrawalCounter.call();
      currentWithdrawalCounter = currentWithdrawalCounter.c[0];
      const funderAlloc = await instance.getFunderAllocationAt.call(account_c, currentWithdrawalCounter+1);
      assert.equal(funderAlloc, 0, "Account C has nothing left to refund");
    });
  });

  describe('Simple integration test: New funder, account_c arrives with two different payments, withdrawal, refund', async () => {
    it("[account c] should add funds to the contract", async () => {
      await instance.fund(2, {value: 100, from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 100, "Contract has 100 wei balance");
    });

    it("[account c] should have correct refund amount", async () => {
      let currentWithdrawalCounter = await instance.withdrawalCounter.call();
      currentWithdrawalCounter = currentWithdrawalCounter.c[0];
      const totalRefund = await instance.getRefundAmountForFunder.call(account_c);
      assert.equal(totalRefund, 100, "Account C 100 left to refund");
    });

    it("should get correct withdrawal amount at future position", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+2);
      assert.equal(futureWithdrawal, 50, "Future withdrawal is 50");
    });

    // Add funds on different schedule
    it("[account c] should add funds to the contract", async () => {
      await instance.fund(5, {value: 100, from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 200, "Contract has 200 wei balance");
    });

    it("[account c] should have correct refund amount", async () => {
      let currentWithdrawalCounter = await instance.withdrawalCounter.call();
      currentWithdrawalCounter = currentWithdrawalCounter.c[0];
      const totalRefund = await instance.getRefundAmountForFunder.call(account_c);
      assert.equal(totalRefund, 200, "Account C 200 left to refund");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 70, "Next withdrawal is 70");
    });

    it("should get correct withdrawal amount at future position", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+3);
      assert.equal(futureWithdrawal, 20, "Future withdrawal is 20");
    });

    it("should get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There is 1 total funders");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw({from: account_a});
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 130, "Beneficiary has withdrawn");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 70, "Next withdrawal is 70");
    });

    it("[account c] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_c);
      assert.equal(totalRefund, 130, "Account C has 130 left to refund");
    });

    it("[account c] should refund by funder", async () => {
      await instance.refund({from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Account C has been refunded. Wallet balance is now 0");
    });
  });

  describe('Complex integration test 1: one funder -> two withdrawals -> funder tops up -> three withdrawals -> funder refunds', async () => {
    it("[account d] should add funds to the contract", async () => {
      await instance.fund(20, {value: 10000, from: account_d});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 10000, "Contract has 100 wei balance");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 500, "Next withdrawal is 500");
    });

    // x2
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 9500, "Beneficiary has withdrawn");
    });
    it("[account d] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 9500, "Account D has 9500 left to withdraw");
    });
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 9000, "Beneficiary has withdrawn");
    });
    it("[account d] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 9000, "Account D has 9000 left to withdraw");
    });

    // Topup
    it("[account d] should add funds to the contract", async () => {
      await instance.fund(20, {value: 10000, from: account_d});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 19000, "Contract has 19000 wei balance");
    });

    it("[account d] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 19000, "Account D has 19000 left to withdraw");
    });

    // it("[account d] should have a contribution allocated after topping up after a withdrawal", async () => {
    //   const contribution = await instance.getFunderContribution.call(account_d);
    //   assert.equal(contribution, 1900, "Account D should have been allocated 1900 as a contribution");
    // });

    // x3
    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 1000, "Next withdrawal is 500");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 18000, "Beneficiary has withdrawn");
    });

    it("[account d] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 18000, "Account D has 18000 left to withdraw");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 17000, "Beneficiary has withdrawn");
    });

    it("[account d] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 17000, "Account D has 17000 left to withdraw");
    });
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 16000, "Beneficiary has withdrawn");
    });
    it("[account d] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 16000, "Account D has 16000 left to withdraw");
    });

    it("[account d] should refund their funds", async () => {
      await instance.refund({from: account_d});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Account D has been refunded 17000. Wallet balance is now 0");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 0, "Next withdrawal is 0");
    });

    it("should get total funders as 0", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 0, "There are 0 total funders");
    });
  });

  describe('Complex integration test 2: three funders arrive -> one tops up -> withdrawal -> refund one -> one tops up -> 2nd withdrawal -> refund two', async () => {
    // Three funders arrive

    it("[account d] should add funds to the contract", async () => {
      await instance.fund(10, {value: 10000, from: account_d});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 10000, "Contract has 10000 wei balance");
    }); // 1000

    it("should get correct withdrawal amount at future withdrawal 10", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+10);
      assert.equal(futureWithdrawal, 1000, "Future withdrawal at 10 is 1000");
    });

    it("should get correct withdrawal amount at future withdrawal 11", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+11);
      assert.equal(futureWithdrawal, 0, "Future withdrawal at 11 is 0");
    });

    it("[account e] should add funds to the contract", async () => {
      await instance.fund(5, {value: 10000, from: account_e});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 20000, "Contract has 20000 wei balance");
    }); // 2000

    it("should get correct withdrawal amount at future withdrawal 5", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+5);
      assert.equal(futureWithdrawal, 3000, "Future withdrawal at 5 is 3000");
    });

    it("should get correct withdrawal amount at future withdrawal 6", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+6);
      assert.equal(futureWithdrawal, 1000, "Future withdrawal at 6 is 1000");
    });

    it("[account f] should add funds to the contract", async () => {
      await instance.fund(20, {value: 10000, from: account_f});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 30000, "Contract has 30000 wei balance");
    }); // 500

    it("should get correct withdrawal amount at future withdrawal 15", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+15);
      assert.equal(futureWithdrawal, 500, "Future withdrawal at 15 is 500");
    });

    it("should get correct withdrawal amount at future withdrawal 6", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+6);
      assert.equal(futureWithdrawal, 1500, "Future withdrawal at 6 is 1600");
    });

    it("should get total funders as 3", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 3, "There are 3 total funders");
    });

    // One tops up
    it("[account e] should add funds to the contract", async () => {
      await instance.fund(4, {value: 8000, from: account_e});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 38000, "Contract has 38000 wei balance");
    }); // 2000

    it("should get correct withdrawal amount at future withdrawal 4", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+4);
      assert.equal(futureWithdrawal, 5500, "Future withdrawal at 6 is 1600");
    });

    it("should get correct withdrawal amount at future withdrawal 5", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+5);
      assert.equal(futureWithdrawal, 3500, "Future withdrawal at 6 is 1600");
    });

    // E 10000 -> 18000
    it("[account e] should have correct refund amount", async () => {
      const refundAmount = await instance.getRefundAmountForFunder.call(account_e);
      assert.equal(refundAmount, 18000, "Account E has 18000 wei balance");
    });

    it("should still get total funders as 3", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 3, "There are 3 total funders");
    });

    // Withdraw
    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 5500, "Next withdrawal is 5500");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 32500, "Beneficiary has withdrawn");
    });

    // D 10000 - 1000
    it("[account d] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
      assert.equal(totalRefund, 9000, "Account D has 9000 left to withdraw");
    });

    // E (10000 - 2000) + (8000 - 2000)
    it("[account e] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_e);
      assert.equal(totalRefund, 14000, "Account E has 14000 left to withdraw");
    });

    // F 10000 - 500
    it("[account f] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
      assert.equal(totalRefund, 9500, "Account F has 9500 left to withdraw");
    });

    // Refund Account D
    // D 9000 -> 0
    it("[account d] should refund their funds", async () => {
      await instance.refund({from: account_d});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 23500, "Account D has been refunded 9000. Wallet balance is now ");
    });

    it("[account d] should fail refunding their funds again", async () => {
      try {
        await instance.refund({from: account_d});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("should get correct withdrawal amount at future withdrawal 4", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+3);
      assert.equal(futureWithdrawal, 4500, "Future withdrawal at 4 is 4500");
    });

    it("should get correct withdrawal amount at future withdrawal 5", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+4);
      assert.equal(futureWithdrawal, 2500, "Future withdrawal at 5 is 2500");
    });

    // Account F tops up
    // F 270 -> 600
    it("[account f] should add funds to the contract again", async () => {
      await instance.fund(5, {value: 8000, from: account_f});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 31500, "Contract has 31500 wei balance");
    });

    it("[account f] should get balance", async () => {
      const balance = await instance.getFunderBalance.call(account_f);
      assert.equal(balance, 17500, "Account F has 17500 wei balance");
    });

    it("should get correct withdrawal amount at future withdrawal 5", async () => {
      const currentWithdrawalCounter = await instance.withdrawalCounter.call();
      const futureWithdrawal = await instance.getWithdrawalAt.call(currentWithdrawalCounter.c[0]+4);
      assert.equal(futureWithdrawal, 4100, "Future withdrawal at 5 is 4100");
    });

    // Withdraw
    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 6100, "Next withdrawal is 6100");
    });

    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 25400, "Beneficiary has withdrawn");
    });

    // E 14000-4000
    it("[account e] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_e);
      assert.equal(totalRefund, 10000, "Account E has 10000 left to withdraw");
    });

    // F
    it("[account f] should have correct refund amount", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
      assert.equal(totalRefund, 15400, "Account F has 15400 left to withdraw");
    });

    // Refund last two accounts
    // 1350 -> 540
    it("[account e] should refund their funds", async () => {
      await instance.refund({from: account_e});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 15400, "Account E has been refunded 10000. Wallet balance is now 15400");
    });

    // 540 -> 0
    it("[account f] should refund their funds", async () => {
      const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
      await instance.refund({from: account_f});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Account F has been refunded 15400. Wallet balance is now 0");
    });

  });
});