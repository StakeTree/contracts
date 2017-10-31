pragma solidity 0.4.15;
import './StakeTreeWithTokenization.sol';

contract StakeTreeWithTokenizationFactory {
  uint public contractCount;
  mapping(address => address[]) public contracts;

  function newContract(
    address beneficiaryAddress, 
    uint withdrawalPeriodInit, 
    uint withdrawalStart, 
    uint sunsetWithdrawPeriodInit,
    uint minimumFundingAmountInit ) public returns (address newAddress) {

    StakeTreeWithTokenization staketree = new StakeTreeWithTokenization(
      beneficiaryAddress, 
      withdrawalPeriodInit,
      withdrawalStart, 
      sunsetWithdrawPeriodInit,
      minimumFundingAmountInit
    );

    contracts[msg.sender].push(staketree);
    contractCount += 1;

    return staketree;
  }

  function getContractAddress() public constant returns (address[]) {
    return contracts[msg.sender];
  }
}