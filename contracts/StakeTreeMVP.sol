pragma solidity ^0.4.11;

contract StakeTreeMVP {

  struct Funder {
    bool exists;
    uint balance;
    uint withdrawalEntry;
  }
  mapping(address => Funder) public funders;

  bool public live = true; // For sunsetting contract
  uint totalCurrentFunders = 0; // Keeps track of total funders
  uint withdrawalCounter = 0; // Keeps track of how many withdrawals have taken place
 
  address public beneficiary; // Address for beneficiary
  uint public sunsetWithdrawalPeriod; // How long it takes for beneficiary to swipe contract when put into sunset mode
  uint public withdrawalPeriod; // How long the beneficiary has to wait withdraw
  uint public minimumFundingAmount; // Setting used for setting minimum amounts to fund contract with
  uint public lastWithdrawal; // Last withdrawal time
  uint public nextWithdrawal; // Next withdrawal time

  uint public sunsetWithdrawDate;

  uint public decimalMultiplier = 1000000000; // For maths

  function StakeTreeMVP(
    address beneficiaryAddress, 
    uint withdrawalPeriodInit, 
    uint withdrawalStart, 
    uint sunsetWithdrawPeriodInit,
    uint minimumFundingAmountInit) {

    beneficiary = beneficiaryAddress;
    withdrawalPeriod = withdrawalPeriodInit;
    sunsetWithdrawalPeriod = sunsetWithdrawPeriodInit;

    lastWithdrawal = withdrawalStart; 
    nextWithdrawal = lastWithdrawal + withdrawalPeriod;

    minimumFundingAmount = minimumFundingAmountInit;
  }

  // Modifiers
  modifier onlyByBeneficiary() {
    require(msg.sender == beneficiary);
    _;
  }

  modifier onlyByFunder() {
    require(isFunder(msg.sender));
    _;
  }

  modifier onlyAfterNextWithdrawalDate() {
    require(now >= nextWithdrawal);
    _;
  }

  modifier onlyWhenLive() {
    require(live);
    _;
  }

  modifier onlyWhenSunset() {
    require(!live);
    _;
  }

  /*
  * External accounts can pay directly to contract to fund it.
  */
  function () payable {
    fund();
  }

  /*
  * Additional api for contracts to use as well
  * Can only happen when live and over a minimum amount set by the beneficiary
  */

  function fund() payable onlyWhenLive {
    require(msg.value > minimumFundingAmount);

    // Only increase total funders when we have a new funder
    if(!isFunder(msg.sender)) {
      totalCurrentFunders += 1; // Increase total funder count

      funders[msg.sender] = Funder({
        exists: true,
        balance: msg.value,
        withdrawalEntry: withdrawalCounter // Set the withdrawal counter. Ie at which withdrawal the funder "entered" the patronage contract
      });
    }
    else {
      // If the funder is already in the pool let's update things while we're at it
      // This calculates their actual balance left and adds their top up amount
      funders[msg.sender].balance = getRefundAmountForFunder(msg.sender) + msg.value;
      // Reset withdrawal counter
      funders[msg.sender].withdrawalEntry = withdrawalCounter;
    }
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

  function getWithdrawalEntryForFunder(address addr) constant returns (uint) {
    return funders[addr].withdrawalEntry;
  }

  /*
  * To calculate the refund amount we look at how many times the beneficiary
  * has withdrawn since the funder added their funds. 
  * We use that deduct 10% for each withdrawal.
  */

  function getRefundAmountForFunder(address addr) constant returns (uint) {
    uint amount = funders[addr].balance;
    uint withdrawalTimes = getHowManyWithdrawalsForFunder(addr);
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
    return getRefundAmountForFunder(funder);
  }

  function getHowManyWithdrawalsForFunder(address addr) constant returns (uint) {
    return withdrawalCounter - getWithdrawalEntryForFunder(addr);
  }

  function isFunder(address addr) constant returns (bool) {
    return funders[addr].exists;
  }

  // State changing functions
  function setNextWithdrawalTime(uint timestamp) private {
    lastWithdrawal = timestamp; // For tracking purposes
    nextWithdrawal = nextWithdrawal + withdrawalPeriod; // Fixed period increase
  }

  function setMinimumFundingAmount(uint amount) onlyByBeneficiary {
    require(amount > 0);
    minimumFundingAmount = amount;
  }

  function withdraw() onlyByBeneficiary onlyAfterNextWithdrawalDate onlyWhenLive  {
    // Check
    uint amount = calculateWithdrawalAmount(this.balance);

    // Effects
    withdrawalCounter += 1;
    setNextWithdrawalTime(now);

    // Interaction
    beneficiary.transfer(amount);
  }

  // Refunding by funder
  // Only funders can refund their own funding
  // Can only be sent back to the same address it was funded with
  // We also remove the funder if they succesfully exit with their funds
  function refund() onlyByFunder {
    // Check
    uint walletBalance = this.balance;
    uint amount = getRefundAmountForFunder(msg.sender);
    require(amount > 0);

    // Effects
    removeFunder();

    // Interaction
    msg.sender.transfer(amount);

    // Make sure this worked as intended
    assert(this.balance == walletBalance-amount);
  }

  // Used when the funder wants to remove themselves as a funder
  // without refunding. Their eth stays in the pool
  function removeFunder() onlyByFunder {
    delete funders[msg.sender];
    totalCurrentFunders -= 1;
  }

  /*
  * The beneficiary can decide to stop using this contract.
  * They use this sunset function to put it into sunset mode.
  * The beneficiary can then swipe rest of the funds after a set time
  * if funders have not withdrawn their funds.
  */

  function sunset() onlyByBeneficiary {
    sunsetWithdrawDate = now + sunsetWithdrawalPeriod;
    live = false;
  }

  function swipe(address recipient) onlyWhenSunset onlyByBeneficiary {
    require(now >= sunsetWithdrawDate);

    recipient.transfer(this.balance);
  }
}