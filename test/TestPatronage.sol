pragma solidity ^0.4.11;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/Patronage.sol";

contract TestPatronage {
  uint public initialBalance = 1 ether;
  Patronage patronage = Patronage(DeployedAddresses.Patronage());

  // function testBeneficiaryWithdrawal() {
  //   Assert.equal(balance, 2000, "Funder balance should total 2000 wei");
  // }

  function testRefundingByFunder() {
    // patronage.transfer(1); // This failed because there wasn't enough gas. Dig into this
    patronage.refundByFunder(this);
    uint balance = patronage.balanceOf(this);
    Assert.equal(balance, 0, "Funder balance should total 0 wei after refund");
  }

  
}
