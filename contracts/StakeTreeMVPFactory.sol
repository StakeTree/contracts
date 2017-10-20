pragma solidity ^0.4.11;
import './StakeTreeMVP.sol';

contract StakeTreeMVPFactory {
  uint public contractCount;
  mapping(address => address[]) public contracts;

  function newContract(
    address beneficiaryAddress, 
    uint withdrawalPeriodInit, 
    uint withdrawalStart, 
    uint sunsetWithdrawPeriodInit,
    uint minimumFundingAmountInit ) public returns (address newAddress) {

    StakeTreeMVP mvp = new StakeTreeMVP(
      beneficiaryAddress, 
      withdrawalPeriodInit, 
      withdrawalStart, 
      sunsetWithdrawPeriodInit,
      minimumFundingAmountInit
    );

    contracts[msg.sender].push(mvp);
    contractCount += 1;

    return mvp;
  }

  function getContractAddress() public constant returns (address[]) {
    return contracts[msg.sender];
  }
}