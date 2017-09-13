pragma solidity ^0.4.11;

// Questions/thoughts
// Balance vs Pool?
// Rolling withdrawal periods vs fixed withdrawal periods (set ahead like 5 times)

contract Patronage {
  mapping(address => uint256) public funderBalances;
  mapping(address => uint256) public funderCounter;

  uint totalCurrentFunders = 0;
  uint withdrawalCounter = 0;
  address public beneficiary;
  uint public minimumFundingAmount = 1 wei; // Prevent spam & support meaningful contributions for now
  uint public withdrawalPeriod = 20 minutes;
  uint public lastWithdrawal = 0;
  uint public nextWithdrawal = 0;

  uint public decimalMultiplier = 1000000000;

  event LogFunding(address funderAddress, uint amount);
  event LogAmount(uint amount, string source);

  // Modifiers
  modifier onlyByFunder(address funder) {
    require(msg.sender == funder);
    _;
  }

  modifier onlyByBeneficiary() {
    require(msg.sender == beneficiary);
    _;
  }

  modifier onlyAfterNextWithdrawalDate() {
    require(now >= nextWithdrawal);
    _;
  }

  modifier onlyIfBeneficiaryIsNotSet() {
    require(beneficiary == address(0));
    _;
  }

  modifier onlyAfterSetup() {
    require(nextWithdrawal != 0);
    _;
  }

  modifier onlyBeforeSetup() {
    require(nextWithdrawal == 0);
    _;
  }

	function () payable onlyAfterSetup {
    if(msg.value > minimumFundingAmount){
      // Only increase total funders when they are a new funder
      if(balanceOf(msg.sender) == 0) {
        totalCurrentFunders += 1;
        // Set the withdrawal counter. Ie at which withdrawal the funder "entered" the patronage contract
        funderCounter[msg.sender] = withdrawalCounter;
        funderBalances[msg.sender] += msg.value;
      }
      else {
        // If the funder is already in the pool let's update things while we're at it
        funderBalances[msg.sender] = getRefundAmountForFunder(msg.sender) + msg.value;
        // Reset withdrawal counter
        funderCounter[msg.sender] = withdrawalCounter;
      }
    }
  }

  // Setup functions
  function setInitialBeneficiary(address beneficiaryAddress) onlyIfBeneficiaryIsNotSet {
    beneficiary = beneficiaryAddress;
  }
  function setInitialNextWithdrawal(uint timestamp) {
    lastWithdrawal = timestamp; // For tracking purposes
    nextWithdrawal = lastWithdrawal + withdrawalPeriod; // Fixed period increase
  }

  // Pure functions
  function calculateWithdrawalAmount(uint startAmount) returns (uint){
    uint bigNumber = startAmount*decimalMultiplier;
    uint bigWithdrawalAmount = bigNumber/100*10;
    uint withdrawalAmount = bigWithdrawalAmount/decimalMultiplier;
    return withdrawalAmount;
  }

  // Getter functions
  function getBeneficiary() constant returns (address) {
    return beneficiary;
  }

  function getCurrentTotalFunders() constant returns (uint) {
    return totalCurrentFunders;
  }

  function getWithdrawalCounter() constant returns (uint) {
    return withdrawalCounter;
  }

  function getWithdrawalCounterForFunder(address funder) constant returns (uint) {
    return funderCounter[funder];
  }

  function getRefundAmountForFunder(address funder) constant returns (uint) {
    uint amount = funderBalances[funder];
    uint withdrawalTimes = getHowManyWithdrawalsForFunder(funder);
    uint bigNumberAmount = amount*decimalMultiplier;
    
    for(uint i=0; i<withdrawalTimes; i++) {
      bigNumberAmount = bigNumberAmount-(bigNumberAmount/100*10);
    }

    return bigNumberAmount/decimalMultiplier;
  }

  function getBalance() constant returns (uint256 balance) {
    balance = this.balance;
  }

  function balanceOf(address funder) constant returns (uint256) {
    return funderBalances[funder];
  }

  function getHowManyWithdrawalsForFunder(address funder) constant returns (uint) {
    return withdrawalCounter - funderCounter[funder];
  }

  // State changing functions
  function setNextWithdrawalTime(uint timestamp) private {
    lastWithdrawal = timestamp; // For tracking purposes
    nextWithdrawal = nextWithdrawal + withdrawalPeriod; // Fixed period increase
  }

  // TODO: Set minimum withdrawal amount
  // TODO: Changed to check-effects-interactions. Question: what if the transfer fails?
  function withdrawToBeneficiary() onlyAfterSetup onlyAfterNextWithdrawalDate {
    uint amount = calculateWithdrawalAmount(this.balance);

    // Keep track of how many withdrawals have taken place
    withdrawalCounter += 1;

    setNextWithdrawalTime(now);

    beneficiary.transfer(amount); 
  }

  // Patron refunding from funder
  // Only funders can refund their own funding
  // Can only be sent back to the same address it was funded with
  // TODO: set minimum withdrawal amount?
  // TODO: Changed to check-effects-interactions. Question: what if the transfer fails?
  function refundByFunder(address funder) onlyAfterSetup onlyByFunder(funder) {
    // Check
    uint amount = getRefundAmountForFunder(funder);

    // Effects
    totalCurrentFunders -= 1;
    delete funderBalances[funder];
    delete funderCounter[funder];

    // Interaction
    funder.transfer(amount);
  }

  // Patron refund from beneficiary
  // This is for cases where the funder lost access to their original account
  // They can only refund by contacting the beneficiary.
  // TODO: Implement this properly
  // function refundByBeneficiary(address funder, address newAddress) onlyByBeneficiary() {
  //   uint amount = funderBalances[funder];
  //   newAddress.call.gas(50000).value(amount)();
  //   funderBalances[funder] -= amount;
  // }

  // Testing functions
  // private testingMode = false;
  // modifier onlyForTesting() returns bool {
  //   return testingMode;
  // }
  function changeWithdrawalPeriod(uint period) onlyBeforeSetup {
    withdrawalPeriod = period;
  }
}