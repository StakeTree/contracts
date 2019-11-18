pragma solidity >=0.5.0 < 0.6.0;
import './StakeTreeMVP.sol';

contract StakeTreeMVPFactory {
  uint public contractCount;
  mapping(address => address[]) public contracts;

  function newContract(
    address payable beneficiaryAddress,
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

    contracts[msg.sender].push(address(mvp));
    contractCount += 1;

    return address(mvp);
  }

  function getContractAddress() public view returns (address[] memory) {
    return contracts[msg.sender];
  }
}
