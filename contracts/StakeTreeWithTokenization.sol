pragma solidity 0.4.15;
import './SafeMath.sol';
import './minime/MiniMeToken.sol';

contract StakeTreeWithTokenization {
  using SafeMath for uint256;

  uint public version = 2;

  struct Funder {
    bool exists;
    uint balance;
    uint withdrawalEntry;
    uint contribution;
    uint contributionClaimed;
  }

  mapping(address => Funder) public funders;

  bool public live = true; // For sunsetting contract
  uint public totalCurrentFunders = 0; // Keeps track of total funders
  uint public withdrawalCounter = 0; // Keeps track of how many withdrawals have taken place
  uint public sunsetWithdrawDate;
  
  MiniMeToken public tokenContract;
  MiniMeTokenFactory public tokenFactory;
  bool public tokenized = false;
  bool public canClaimTokens = false;

  address public beneficiary; // Address for beneficiary
  uint public sunsetWithdrawalPeriod; // How long it takes for beneficiary to swipe contract when put into sunset mode
  uint public withdrawalPeriod; // How long the beneficiary has to wait withdraw
  uint public minimumFundingAmount; // Setting used for setting minimum amounts to fund contract with
  uint public lastWithdrawal; // Last withdrawal time
  uint public nextWithdrawal; // Next withdrawal time

  uint public contractStartTime; // For accounting purposes

  event Payment(address indexed funder, uint amount);
  event Refund(address indexed funder, uint amount);
  event Withdrawal(uint amount);
  event TokensClaimed(address indexed funder, uint amount);
  event Sunset(bool hasSunset);

  function StakeTreeWithTokenization(
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

    contractStartTime = now;
  }

  // Modifiers
  modifier onlyByBeneficiary() {
    require(msg.sender == beneficiary);
    _;
  }

  modifier onlyWhenTokenized() {
    require(isTokenized());
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

  function fund() public payable onlyWhenLive {
    require(msg.value >= minimumFundingAmount);

    // Only increase total funders when we have a new funder
    if(!isFunder(msg.sender)) {
      totalCurrentFunders = totalCurrentFunders.add(1); // Increase total funder count

      funders[msg.sender] = Funder({
        exists: true,
        balance: msg.value,
        withdrawalEntry: withdrawalCounter, // Set the withdrawal counter. Ie at which withdrawal the funder "entered" the patronage contract
        contribution: 0,
        contributionClaimed: 0
      });
    }
    else { 
      consolidateFunder(msg.sender, msg.value);
    }

    Payment(msg.sender, msg.value);
  }

  // Pure functions

  /*
  * This function calculates how much the beneficiary can withdraw.
  * Due to no floating points in Solidity, we will lose some fidelity
  * if there's wei on the last digit. The beneficiary loses a neglibible amount
  * to withdraw but this benefits the beneficiary again on later withdrawals.
  * We multiply by 10 (which corresponds to the 10%) 
  * then divide by 100 to get the actual part.
  */
  function calculateWithdrawalAmount(uint startAmount) public returns (uint){
    return startAmount.mul(10).div(100); // 10%
  }

  /*
  * This function calculates the refund amount for the funder.
  * Due to no floating points in Solidity, we will lose some fidelity.
  * The funder loses a neglibible amount to refund. 
  * The left over wei gets pooled to the fund.
  */
  function calculateRefundAmount(uint amount, uint withdrawalTimes) public returns (uint) {    
    for(uint i=0; i<withdrawalTimes; i++){
      amount = amount.mul(9).div(10);
    }
    return amount;
  }

  // Getter functions

  /*
  * To calculate the refund amount we look at how many times the beneficiary
  * has withdrawn since the funder added their funds. 
  * We use that deduct 10% for each withdrawal.
  */

  function getRefundAmountForFunder(address addr) public constant returns (uint) {
    // Only calculate on-the-fly if funder has not been updated
    if(shouldUpdateFunder(addr)) {
      uint amount = funders[addr].balance;
      uint withdrawalTimes = getHowManyWithdrawalsForFunder(addr);
      return calculateRefundAmount(amount, withdrawalTimes);
    }
    else {
      return funders[addr].balance;
    }
  }

  function getFunderContribution(address funder) public constant returns (uint) {
    // Only calculate on-the-fly if funder has not been updated
    if(shouldUpdateFunder(funder)) {
      uint oldBalance = funders[funder].balance;
      uint newBalance = getRefundAmountForFunder(funder);
      uint contribution = oldBalance.sub(newBalance);
      return funders[funder].contribution.add(contribution);
    }
    else {
      return funders[funder].contribution;
    }
  }

  function getBeneficiary() public constant returns (address) {
    return beneficiary;
  }

  function getCurrentTotalFunders() public constant returns (uint) {
    return totalCurrentFunders;
  }

  function getWithdrawalCounter() public constant returns (uint) {
    return withdrawalCounter;
  }

  function getWithdrawalEntryForFunder(address addr) public constant returns (uint) {
    return funders[addr].withdrawalEntry;
  }

  function getContractBalance() public constant returns (uint256 balance) {
    balance = this.balance;
  }

  function getFunderBalance(address funder) public constant returns (uint256) {
    return getRefundAmountForFunder(funder);
  }

  function getFunderContributionClaimed(address addr) public constant returns (uint) {
    return funders[addr].contributionClaimed;
  }

  function isFunder(address addr) public constant returns (bool) {
    return funders[addr].exists;
  }

  function isTokenized() public constant returns (bool) {
    return tokenized;
  }

  function shouldUpdateFunder(address funder) public constant returns (bool) {
    return getWithdrawalEntryForFunder(funder) < withdrawalCounter;
  }

  function getHowManyWithdrawalsForFunder(address addr) private constant returns (uint) {
    return withdrawalCounter.sub(getWithdrawalEntryForFunder(addr));
  }

  // State changing functions
  function setMinimumFundingAmount(uint amount) external onlyByBeneficiary {
    require(amount > 0);
    minimumFundingAmount = amount;
  }

  function withdraw() external onlyByBeneficiary onlyAfterNextWithdrawalDate onlyWhenLive  {
    // Check
    uint amount = calculateWithdrawalAmount(this.balance);

    // Effects
    withdrawalCounter = withdrawalCounter.add(1);
    lastWithdrawal = now; // For tracking purposes
    nextWithdrawal = nextWithdrawal + withdrawalPeriod; // Fixed period increase

    // Interaction
    beneficiary.transfer(amount);

    Withdrawal(amount);
  }

  // Refunding by funder
  // Only funders can refund their own funding
  // Can only be sent back to the same address it was funded with
  // We also remove the funder if they succesfully exit with their funds
  function refund() external onlyByFunder {
    // Check
    uint walletBalance = this.balance;
    uint amount = getRefundAmountForFunder(msg.sender);
    require(amount > 0);

    // Effects
    removeFunder();

    // Interaction
    msg.sender.transfer(amount);

    Refund(msg.sender, amount);

    // Make sure this worked as intended
    assert(this.balance == walletBalance-amount);
  }

  // Used when the funder wants to remove themselves as a funder
  // without refunding. Their eth stays in the pool
  function removeFunder() public onlyByFunder {
    delete funders[msg.sender];
    totalCurrentFunders = totalCurrentFunders.sub(1);
  }

  /*
  * This is a bookkeeping function which updates the state for the funder
  * when top up their funds.
  */

  function consolidateFunder(address funder, uint newPayment) private {
    // Update contribution
    funders[funder].contribution = getFunderContribution(funder);
    // Update balance
    funders[funder].balance = getRefundAmountForFunder(funder).add(newPayment);
    // Update withdrawal entry
    funders[funder].withdrawalEntry = withdrawalCounter;
  }

  function addTokenization(string tokenName, string tokenSymbol, uint8 tokenDecimals ) external onlyByBeneficiary {
    require(!isTokenized());

    tokenFactory = new MiniMeTokenFactory();
    tokenContract = tokenFactory.createCloneToken(0x0, 0, tokenName, tokenDecimals, tokenSymbol, true);

    tokenized = true;
    canClaimTokens = true;
  }

  function claimTokens() external onlyByFunder onlyWhenTokenized {
    require(canClaimTokens);

    uint contributionAmount = getFunderContribution(msg.sender);
    uint contributionClaimedAmount = getFunderContributionClaimed(msg.sender);

    // Only claim tokens if they have some left to claim
    uint claimAmount = contributionAmount.sub(contributionClaimedAmount);
    require(claimAmount > 0);

    // Claim tokens
    funders[msg.sender].contributionClaimed = contributionAmount;
    tokenContract.generateTokens(msg.sender, claimAmount);

    TokensClaimed(msg.sender, claimAmount);
  }

  /*
  * The beneficiary can stop/enable funders from claiming more tokens.
  * This opens up opportunities for tokenizing only happening for a set periods.
  */
  function enableTokenClaiming(bool _enabled) external onlyWhenTokenized onlyByBeneficiary {
    canClaimTokens = _enabled;
  }

  /* --- Sunsetting --- */
  /*
  * The beneficiary can decide to stop using this contract.
  * They use this sunset function to put it into sunset mode.
  * The beneficiary can then swipe rest of the funds after a set time
  * if funders have not withdrawn their funds.
  */

  function sunset() external onlyByBeneficiary onlyWhenLive {
    sunsetWithdrawDate = now.add(sunsetWithdrawalPeriod);
    live = false;

    Sunset(true);
  }

  function swipe(address recipient) external onlyWhenSunset onlyByBeneficiary {
    require(now >= sunsetWithdrawDate);

    recipient.transfer(this.balance);
  }

  /* --- Token Contract Forwarding Controller Functions --- */
  /* 
  * Allows beneficiary to call two additional functions on the token contract:
  * claimTokens
  * enabledTransfers
  * 
  */
  function tokenContractClaimTokens(address _token) onlyByBeneficiary onlyWhenTokenized {
    tokenContract.claimTokens(_token);
  }
  function tokenContractEnableTransfers(bool _transfersEnabled) onlyByBeneficiary onlyWhenTokenized {
    tokenContract.enableTransfers(_transfersEnabled);
  }
}