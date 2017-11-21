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
  });

  // describe('Complex integration test 2: three funders arrive -> one tops up -> withdrawal -> refund one -> one tops up -> 2nd withdrawal -> refund two', async () => {
  //   // Three funders arrive
  //   it("[account d] should add funds to the contract", async () => {
  //     await instance.fund(10, {value: 10000, from: account_d});
  //     const balance = await instance.getContractBalance.call();
  //     assert.equal(balance, 10000, "Contract has 10000 wei balance");
  //   });
  //   it("[account e] should add funds to the contract", async () => {
  //     await instance.fund(5, {value: 10000, from: account_d});
  //     const balance = await instance.getContractBalance.call();
  //     assert.equal(balance, 20000, "Contract has 20000 wei balance");
  //   });
  //   it("[account f] should add funds to the contract", async () => {
  //     await instance.fund(20, {value: 10000, from: account_d});
  //     const balance = await instance.getContractBalance.call();
  //     assert.equal(balance, 30000, "Contract has 30000 wei balance");
  //   });

  //   it("should get total funders as 3", async () => {
  //     const totalFunders = await instance.getCurrentTotalFunders.call();
  //     assert.equal(totalFunders, 3, "There are 3 total funders");
  //   });

  //   // One tops up
  //   it("[account e] should add funds to the contract", async () => {
  //    await instance.fund(4, {value: 8000, from: account_d});
  //     const balance = await instance.getContractBalance.call();
  //     assert.equal(balance, 38000, "Contract has 38000 wei balance");
  //   });

  //   // E 10000 -> 18000
  //   it("[account e] should have funds correct balance", async () => {
  //     const balance = await instance.getFunderBalance.call(account_e);
  //     assert.equal(balance, 18000, "Account E has 18000 wei balance");
  //   });

  //   it("should still get total funders as 3", async () => {
  //     const totalFunders = await instance.getCurrentTotalFunders.call();
  //     assert.equal(totalFunders, 3, "There are 3 total funders");
  //   });

    // Withdraw
    // it("should withdraw to beneficiary", async () => {
    //   await instance.withdraw();
    //   const balanceAfter = await instance.getContractBalance.call();
    //   assert.equal(balanceAfter, 1260, "Beneficiary has withdrawn 10%");
    // });

    // // D 100 -> 90
    // it("[account d] should have correct withdrawal amount", async () => {
    //   const totalRefund = await instance.getRefundAmountForFunder.call(account_d);
    //   assert.equal(totalRefund, 90, "Account D has 90 left to withdraw");
    // });

    // // E 1000 -> 900
    // it("[account e] should have correct withdrawal amount", async () => {
    //   const totalRefund = await instance.getRefundAmountForFunder.call(account_e);
    //   assert.equal(totalRefund, 900, "Account E has 900 left to withdraw");
    // });

    // // F 300 -> 270
    // it("[account f] should have correct withdrawal amount", async () => {
    //   const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
    //   assert.equal(totalRefund, 270, "Account F has 270 left to withdraw");
    // });

    // // Refund Account D
    // // D 90 -> 0
    // it("[account d] should refund their funds", async () => {
    //   await instance.refund({from: account_d});
    //   const balance = await instance.getContractBalance.call();
    //   assert.equal(balance, 1170, "Account D has been refunded 90. Wallet balance is now 1170");
    // });

    // it("[account d] should fail refunding their funds again", async () => {
    //   try {
    //     await instance.refund({from: account_d});
    //     assert.equal(true, false);
    //   } catch (err) {
    //     assert.equal(err.message, ERROR_INVALID_OPCODE);
    //   }
    // });

    // // Account F tops up
    // // F 270 -> 600
    // it("[account f] should add funds to the contract again", async () => {
    //   await web3.eth.sendTransaction({gas: 150000, from: account_f, to: instance.address, value: 330});
    //   const balance = await instance.getContractBalance.call();
    //   assert.equal(balance, 1500, "Contract has 1500 wei balance");
    // });

    // it("[account f] should get balance", async () => {
    //   const balance = await instance.getFunderBalance.call(account_f);
    //   assert.equal(balance, 600, "Account F has 600 wei balance");
    // });

    // // Withdraw
    // it("should withdraw to beneficiary", async () => {
    //   await instance.withdraw();
    //   const balanceAfter = await instance.getContractBalance.call();
    //   assert.equal(balanceAfter, 1350, "Beneficiary has withdrawn 10%");
    // });

    // // E 900 -> 810
    // it("[account e] should have correct withdrawal amount", async () => {
    //   const totalRefund = await instance.getRefundAmountForFunder.call(account_e);
    //   assert.equal(totalRefund, 810, "Account E has 567 left to withdraw");
    // });

    // // F 600 -> 540
    // it("[account f] should have correct withdrawal amount", async () => {
    //   const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
    //   assert.equal(totalRefund, 540, "Account F has 540 left to withdraw");
    // });

    // it("should show get withdrawal counter", async () => {
    //   const counter = await instance.getWithdrawalCounter.call();
    //   assert.equal(counter, 8, "Counter is 8");
    // });

    // // Refund last two accounts
    // // 1350 -> 540
    // it("[account e] should refund their funds", async () => {
    //   await instance.refund({from: account_e});
    //   const balance = await instance.getContractBalance.call();
    //   assert.equal(balance, 540, "Account E has been refunded 810. Wallet balance is now 540");
    // });

    // // 540 -> 0
    // it("[account f] should refund their funds", async () => {
    //   const totalRefund = await instance.getRefundAmountForFunder.call(account_f);
    //   await instance.refund({from: account_f});
    //   const balance = await instance.getContractBalance.call();
    //   assert.equal(balance, 0, "Account F has been refunded 540. Wallet balance is now 0");
    // });

  });
});