pragma solidity 0.4.15;
import './SafeMath.sol';
import './minime/MiniMeToken.sol';

contract StakeTreeXOverY {
  using SafeMath for uint256;

  uint public version = 3;

  struct Funder {
    bool exists;
    uint balance;
    uint withdrawalEntry;
    uint contribution;
    uint contributionClaimed;
    uint until;
    mapping(uint => uint) fundingAmountsAllocated;
  }

  mapping(address => Funder) public funders;
  mapping(uint => uint) public withdrawalAmountsAllocated;
  uint public dust = 0;

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
  uint public lastWithdrawal; // Last withdrawal time
  uint public nextWithdrawal; // Next withdrawal time

  uint public contractStartTime; // For accounting purposes

  event Payment(address indexed funder, uint amount);
  event Refund(address indexed funder, uint amount);
  event Withdrawal(uint amount);
  event TokensClaimed(address indexed funder, uint amount);
  event Sunset(bool hasSunset);

  function StakeTreeXOverY(
    address beneficiaryAddress, 
    uint withdrawalPeriodInit, 
    uint withdrawalStart, 
    uint sunsetWithdrawPeriodInit) {

    beneficiary = beneficiaryAddress;
    withdrawalPeriod = withdrawalPeriodInit;
    sunsetWithdrawalPeriod = sunsetWithdrawPeriodInit;

    lastWithdrawal = withdrawalStart; 
    nextWithdrawal = lastWithdrawal + withdrawalPeriod;

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
  * Funding
  * Can only happen when live
  */

  function fund(uint duration) public payable onlyWhenLive {
    // Fit within one year duration (default 7 day duration)
    // Cap this on any interval also due to increasing gas costs.
    require(duration > 0 && duration <= 52); 
    // Make sure lowest value is more than highest duration
    // Otherwise with division the value would be zero per interal
    require(msg.value >= 52); 

    // Only increase total funders when we have a new funder
    if(!isFunder(msg.sender)) {
      totalCurrentFunders = totalCurrentFunders.add(1); // Increase total funder count
      uint until = duration.add(withdrawalCounter);

      funders[msg.sender] = Funder({
        exists: true,
        balance: msg.value,
        withdrawalEntry: withdrawalCounter, // Set the withdrawal counter. Ie at which withdrawal the funder "entered" the patronage contract
        contribution: 0,
        contributionClaimed: 0,
        until: until
      });

      uint amountPerInterval = msg.value.div(duration);
      uint from = withdrawalCounter+1;
      for(uint i=from; i<=until; i++) {
        withdrawalAmountsAllocated[i] = withdrawalAmountsAllocated[i].add(amountPerInterval);
        funders[msg.sender].fundingAmountsAllocated[i] = amountPerInterval;
      }

      // Update dust
      // Store the dust that's left if division dropped some wei due to no decimals in solidity
      updateDust(msg.value, amountPerInterval, duration);
      
      // Update to actual balance after dividing pieces up
      funders[msg.sender].balance = getRefundAmountForFunder(msg.sender); // Calculates based on actual divided amounts
    }
    else {
      consolidate(msg.sender, duration, msg.value);
    }

    Payment(msg.sender, msg.value);
  }

  // Getter functions
  function getRefundAmountForFunder(address addr) public constant returns (uint) {
    uint totalLeft = 0;
    uint until = getFunderDurationLeft(addr);

    uint from = withdrawalCounter+1;
    for(uint i=from; i<=until; i++) {
      totalLeft = totalLeft.add(funders[addr].fundingAmountsAllocated[i]);
    }

    return totalLeft;
  }

  function getFunderDurationLeft(address addr) public constant returns (uint) {
    return funders[addr].until;
  }

  function getNextWithdrawalAmount() public constant returns (uint) {
    return withdrawalAmountsAllocated[withdrawalCounter+1];
  }

  function getWithdrawalAt(uint index) public constant returns (uint) {
    return withdrawalAmountsAllocated[index];
  }

  function getFunderAllocationAt(address addr, uint index) public constant returns (uint) {
    return funders[addr].fundingAmountsAllocated[index];
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

  function withdraw() external onlyByBeneficiary onlyAfterNextWithdrawalDate onlyWhenLive {
    // Check
    uint amount = getNextWithdrawalAmount();

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
  // We also remove the funder
  function refund() external onlyByFunder {
    // Check
    uint walletBalance = this.balance;
    uint amount = getRefundAmountForFunder(msg.sender);

    // Effects
    // Deduct allocated amounts for beneficiary
    // And nullify fundingAmountsAllocated in funder struct
    uint until = getFunderDurationLeft(msg.sender);
    uint from = withdrawalCounter+1;
    for(uint i=from; i<=until; i++) {
      withdrawalAmountsAllocated[i] = withdrawalAmountsAllocated[i].sub(funders[msg.sender].fundingAmountsAllocated[i]);
      funders[msg.sender].fundingAmountsAllocated[i] = 0;
    }

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

  function updateDust(uint newPayment, uint amountPerInterval, uint duration) private returns (uint) {
    uint actualAmount = amountPerInterval.mul(duration);
    if(actualAmount < newPayment) {
      dust = dust.add(newPayment.sub(actualAmount));
    }

    return dust;
  }

  /*
  * This is a bookkeeping function which updates the state for the funder
  * when top up their funds.
  */

  function consolidate(address funder, uint duration, uint newPayment) private {
    // Update contribution
    funders[funder].contribution = getFunderContribution(funder);
    
    // Update allocated withdrawal amounts
    uint amountPerInterval = newPayment.div(duration);
    uint until = duration.add(withdrawalCounter);
    uint from = withdrawalCounter+1;
    for(uint i=from; i<=until; i++) {
      withdrawalAmountsAllocated[i] = withdrawalAmountsAllocated[i].add(amountPerInterval);
      funders[funder].fundingAmountsAllocated[i] = funders[funder].fundingAmountsAllocated[i].add(amountPerInterval);
    }

    // Update until
    // Only update this if the until is smaller than a new duration
    if(funders[funder].until < until) {
      funders[funder].until = until;
    }

    // Update dust
    updateDust(newPayment, amountPerInterval, duration);
    
    // Update balance
    funders[funder].balance = getRefundAmountForFunder(funder); // Calculates based on actual divided amounts

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