pragma solidity >=0.5.0 < 0.6.0;
import './StakeTreeWithTokenization.sol';

contract StakeTreeWithTokenizationFactory {
  uint public contractCount;
  mapping(address => address[]) public contracts;

  function newContract(
    address payable beneficiaryAddress,
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

    contracts[msg.sender].push(address(staketree));
    contractCount += 1;

    return address(staketree);
  }

  function getContractAddress() public view returns (address[] memory) {
    return contracts[msg.sender];
  }
}
