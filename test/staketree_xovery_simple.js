var StakeTreeXOverY = artifacts.require("./StakeTreeXOverY.sol");

const ERROR_INVALID_OPCODE = 'VM Exception while processing transaction: invalid opcode';

contract('StakeTreeXOverY', function(accounts) {
  let instance;
  let instance2;

  const account_a = accounts[0]; // Beneficiary
  const account_b = accounts[1];
  const account_c = accounts[2];

  const account_d = accounts[3];
  const account_e = accounts[4];
  const account_f = accounts[5];

  const nowUnix = new Date().getTime()/1000 - 3000;
  const nowParsed = parseInt(nowUnix.toFixed(0), 10);

  let deployed = false;

  const config = {
    beneficiaryAddress: account_a,
    withdrawalPeriod: 3000,
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
        config.minimumFundingAmount , 
      {from: account_a});

      // For testing sunset & swiping
      instance2 = await StakeTreeXOverY.new(
        config.beneficiaryAddress, 
        0,
        config.startTime,
        0,
        config.minimumFundingAmount,  
      {from: account_a});

      // For testing sunset & swiping
      instance3 = await StakeTreeXOverY.new(
        config.beneficiaryAddress, 
        0,
        config.startTime-10000,
        1000,
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

    it("should have correct minimum funding amount", async () => { 
      const min = await instance.minimumFundingAmount.call();
      assert.equal(min, 1, "Minimum amount is set correctly to 1 wei");
    });

    it("should change minimum funding amount", async () => { 
      const weiAmount = web3.toWei(0.01, 'ether');
      await instance.setMinimumFundingAmount(weiAmount);
      const min = await instance.minimumFundingAmount.call();
      assert.equal(min, weiAmount, "Minimum amount is set correctly to 0.1 ether");
    });

    it("should fail changing minimum funding amount by non-beneficiary", async () => { 
      try {
        const weiAmount = web3.toWei(0.01, 'ether');
        await instance.setMinimumFundingAmount(weiAmount, {from: account_b});
        assert.equal(true, false);
      } catch(err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("should fail sending below minimum funding amount", async () => { 
      try {
        const weiAmount = web3.toWei(0.001, 'ether');
        await web3.eth.sendTransaction({gas: 100000, from: account_a, to: instance.address, value: weiAmount});
        assert.equal(true, false);
      } catch(err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("should change minimum funding amount back", async () => { 
      const weiAmount = web3.toWei(1, 'wei');
      await instance.setMinimumFundingAmount(weiAmount);
      const min = await instance.minimumFundingAmount.call();
      assert.equal(min, weiAmount, "Minimum amount is set correctly to 1 wei");
    });

    it("should have set withdrawal timeframe correctly", async () => {
      const withdrawalPeriod = await instance.withdrawalPeriod.call();
      assert.equal(withdrawalPeriod, config.withdrawalPeriod, "Withdrawal period correctly");
    });

    it("should have initial next withdrawal period in correct timeframe", async () => {
      const withdrawalPeriod = await instance.withdrawalPeriod.call();
      const nextWithdrawal = await instance.nextWithdrawal.call();
      const lastWithdrawal = await instance.lastWithdrawal.call();
      const timingIsCorrect = lastWithdrawal['c'][0] + withdrawalPeriod['c'][0] == nextWithdrawal['c'][0];
      assert.equal(timingIsCorrect, true, "Contract withdrawal timing is correctly setup");
    });

    it("should be in live mode", async () => {
      const isLive = await instance.live.call();
      assert.equal(isLive, true, "Contract is in live mode");
    });

    it("should get initial balance of contract", async () => {
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Contract initiated with 0 balance");
    });

    it("should fail withdrawing by non-beneficiary", async () => {
      try {
        await instance.withdraw({from: account_b});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });
  });

  describe('Account A unit testing', async () => {
    it("[account a] should fail adding funds with zero duration", async () => {
      try {
        await instance.fund(0, {value: 1000, from: account_a});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("[account a] should fail adding funds over 52 duration", async () => {
      try {
        await instance.fund(53, {value: 1000, from: account_a});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("[account a] should add funds to the contract", async () => {
      await instance.fund(8, {value: 1000, from: account_a});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 1000, "Contract has 1000 wei balance");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 125, "Next withdrawal is 125");
    });

    it("[account_a] should get the correct refund amount for funder", async () => {
      const refundAmount = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(refundAmount, 1000, "Account A Refund amount is 1000");
    });

    it("should get total funders", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("[account a] should add more funds to the contract", async () => {
      await instance.fund(8, {value: 1000, from: account_a});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 2000, "Contract has 2000 wei balance");
    });

    it("[account_a] should get the correct refund amount for funder", async () => {
      const refundAmount = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(refundAmount, 2000, "Account A Refund amount is 2000");
    });

    it("should still get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 250, "Next withdrawal is 250");
    });

    it("should fail refunding by non-funder", async () => {
      try {
        await instance.refund({from: account_b});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });
  });

  describe('Add account b integration testing', async () => {
    it("[account b] should add funds to the contract", async () => {
      await instance.fund(5, {value: 2000, from: account_b});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 4000, "Contract has 3000 wei balance");
    });

    it("[account b] should show funds of funder", async () => {
      const balance = await instance.getFunderBalance.call(account_b);
      assert.equal(balance, 2000, "Account B has 2000 wei balance");
    });

    it("should get total funders as 2", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 2, "There are 2 total funders");
    });
  });
  
  describe('Withdrawal testing', async () => {
    it("should withdraw to beneficiary", async () => {
      await instance.withdraw();
      const balanceAfter = await instance.getContractBalance.call();
      assert.equal(balanceAfter, 3350, "Beneficiary has withdrawn");
    });

    it("should fail withdrawing to beneficiary", async () => {
      try {
        await instance.withdraw();
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("should get withdrawal counter", async () => {
      const counter = await instance.getWithdrawalCounter.call();
      assert.equal(counter, 1, "Withdrawal counter is 1");
    });

  });

  describe('Refund testing', async () => {
    it("should fail to refund if refunding done by non-funder", async () => {
      try {
        await instance.refund({from: account_c});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("[account_a] should get the correct refund amount for funder", async () => {
      const refundAmount = await instance.getRefundAmountForFunder.call(account_a);
      assert.equal(refundAmount, 1750, "Account A Refund amount is 1750");
    });

    it("[account_b] should get the correct refund amount for funder", async () => {
      const refundAmount = await instance.getRefundAmountForFunder.call(account_b);
      assert.equal(refundAmount, 1600, "Account B Refund amount is 1600");
    });

    it("[account a] should refund by funder", async () => {
      await instance.refund({from: account_a});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 1600, "Account A has been refunded 1750. Wallet balance is now 1600");
    });

    it("[account a] should fail refunding again cause there's no funds left for funder", async () => {
      try {
        await instance.refund({from: account_a});
        assert.equal(true, false);
      } catch (err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("should get total funders as 1", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 1, "There are 1 total funders");
    });

    it("should get correct next withdrawal amount", async () => {
      const nextWithdrawal = await instance.getNextWithdrawalAmount.call();
      assert.equal(nextWithdrawal, 400, "Next withdrawal is 400");
    });

    it("[account b] should refund by funder", async () => {
      await instance.refund({from: account_b});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 0, "Account B has been refunded 1600. Wallet balance is now 0");
    });

    it("[account c] should add funds to the contract", async () => {
      await instance.fund(5, {value: 1500, from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 1500, "Contract has 1500 wei balance");
    });

    it("[account c] should fail to be removed by non-funder", async () => {
      try {
        await instance.removeFunder({from: account_b});
        assert.equal(true, false);
      } catch(err) {
        assert.equal(err.message, ERROR_INVALID_OPCODE);
      }
    });

    it("[account c] should remove themselves as funder without refunding", async () => {
      await instance.removeFunder({from: account_c});
      const balance = await instance.getContractBalance.call();
      assert.equal(balance, 1500, "Contract has 1500 wei balance");
    });

    it("should get total funders as 0", async () => {
      const totalFunders = await instance.getCurrentTotalFunders.call();
      assert.equal(totalFunders, 0, "There are 0 total funders");
    });
  });

  // describe('Sunset testing', async () => {
  //   // Instance 1
  //   it("[instance 1] should fail swiping because not in sunset mode", async () => {
  //     try {
  //       await instance.swipe(account_a, {from: account_a})
  //       assert.equal(true, false);
  //     } catch(err){
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }
  //   });

  //   it("[instance 1] should put contract into sunset mode", async () => {
  //     await instance.sunset({from: account_a});
  //     const isLive = await instance.live.call();
  //     assert.equal(isLive, false, "Contract has been put in sunset mode");
  //   });

  //   it("[instance 1] should fail calling sunset again", async () => {
  //     try {
  //       await instance.sunset({from: account_a});
  //       assert.equal(true, false);
  //     } catch(err) {
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }      
  //   });

  //   it("[instance 1] should fail swiping", async () => {
  //     try {
  //       await instance.swipe(account_a, {from: account_a});
  //     } catch(err) {
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }
  //   });

  //   it("[instance 1] should fail withdrawing by beneficiary", async () => {
  //     try {
  //       await instance.withdraw();
  //       assert.equal(true, false);
  //     } catch(err){
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }
  //   });

  //   it("[instance 2] should add funds to the contract", async () => {
  //     await web3.eth.sendTransaction({gas: 100000, from: account_a, to: instance2.address, value: 1000});
  //     const balance = await instance2.getContractBalance.call();
  //     assert.equal(balance, 1000, "Contract has 1000 wei balance");
  //   });

  //   it("[instance 2] should put contract into sunset mode", async () => {
  //     await instance2.sunset({from: account_a});
  //     const isLive = await instance2.live.call();
  //     assert.equal(isLive, false, "Contract has been put in sunset mode");
  //   });

  //   it("[instance 2] should fail adding funds to the contract after sunset", async () => {
  //     try {
  //       await web3.eth.sendTransaction({gas: 100000, from: account_a, to: instance2.address, value: 1000});
  //       assert.equal(true, false);
  //     } catch(err) {
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }      
  //   });

  //   it("[instance 2] should fail withdrawing by beneficiary", async () => {
  //     try {
  //       await instance2.withdraw();
  //       assert.equal(true, false);
  //     } catch(err){
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }
  //   });

  //   it("[instance 2] should fail swiping contract from non-beneficiary", async () => {
  //     try {
  //       await instance2.swipe(account_a, {from: account_b});
  //       assert.equal(true, false);
  //     } catch(err){
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }
  //   });

  //   it("[instance 2] should swipe contract", async () => {
  //     await instance2.swipe(account_a, {from: account_a});
  //     const balance = await instance2.getContractBalance.call();
  //     assert.equal(balance, 0, "Contract has been swiped by beneficiary");
  //   });

  //   it("[instance 3] should sunset contract", async () => {
  //     await instance3.sunset({from: account_a});
  //     const isLive = await instance3.live.call();
  //     assert.equal(isLive, false, "Contract has been put in sunset mode");
  //   });

  //   it("[instance 3] should not swipe contract immediately", async () => {
  //     try {
  //       await instance3.swipe(account_c, {from: account_a});
  //       assert.equal(true, false);
  //     } catch (err) {
  //       assert.equal(err.message, ERROR_INVALID_OPCODE);
  //     }
  //   });
  // });
});