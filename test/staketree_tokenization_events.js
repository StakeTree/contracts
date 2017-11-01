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

  describe('Events', async () => {
    it("[account a] should add funds to the contract", async () => {
      const paymentEvent = instance.Payment();

      await web3.eth.sendTransaction({gas: 150000, from: account_a, to: instance.address, value: 10000});
      paymentEvent.get(function(error, logs){ 
        const eventDetails = {
          name: logs[0].event,
          funder: logs[0].args.funder,
          amount: logs[0].args.amount.c[0]
        };

        assert.deepEqual(eventDetails, {
          name: "Payment",
          funder: account_a, 
          amount: 10000
        }, "Contract logged Payment event");
      });
    });

    it("should log withdraw event", async () => {
      const tx = await instance.withdraw();
      const eventDetails = {
        name: tx.logs[0].event,
        amount: tx.logs[0].args.amount.c[0]
      };
      assert.deepEqual(eventDetails, {name: "Withdrawal", amount: 1000}, "Contract logged Withdraw event");
    });

    it("should log claim tokens event", async () => {
      await instance.addTokenization("T", "T", 18);
      const tx = await instance.claimTokens();
      const eventDetails = {
        name: tx.logs[0].event,
        amount: tx.logs[0].args.amount.c[0]
      };
      assert.deepEqual(eventDetails, {name: "TokensClaimed", amount: 1000}, "Contract logged TokensClaimed event");
    });

    it("should log refund event", async () => {
      const tx = await instance.refund();
      const eventDetails = {
        name: tx.logs[0].event,
        amount: tx.logs[0].args.amount.c[0]
      };
      assert.deepEqual(eventDetails, {name: "Refund", amount: 9000}, "Contract logged Refund event");
    });

    it("should log sunset event", async () => {
      const tx = await instance.sunset();
      const eventDetails = {
        name: tx.logs[0].event,
        hasSunset: tx.logs[0].args.hasSunset
      };
      assert.deepEqual(eventDetails, {name: "Sunset", hasSunset: true}, "Contract logged Sunset event");
    });
  });
});