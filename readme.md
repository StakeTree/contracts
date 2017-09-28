# StakeTree Contracts

This repo contains all contracts used by StakeTree.
Current contracts:
*  MVP

## MVP Contract
The MVP contract currently powers the StakeTree project. It is intentionally minimal with only core functionality. There are three main actions:
1) Anyone can fund the contract by paying directly to the address.
2) The beneficiary can withdraw 10% each time after a set time (two weeks is the suggested time).
3) Funders can withdraw what's left of their funds at any time.

### Initial Variables
When deploying the contract the contract takes five initial config variables. 
```
address beneficiaryAddress,
uint withdrawalPeriodInit, 
uint withdrawalStart, 
uint sunsetWithdrawPeriodInit,
uint minimumFundingAmountInit
```
* `beneficiaryAddress` - This is the address for the beneficiary who can withdraw funds. The beneficiary also has additional priviliges. They can update the minimum funding amount, sunset the contract and swipe it after sunset withdrawal period. This address cannot be changed.
* `withdrawalPeriodInit` - This sets the withdrawal period interval in seconds. After how many seconds the beneficiary can withdraw each time. The suggested time is 604800 seconds, which is one week.
* `withdrawalStart` - This sets the initial start time of the contract. Usually setting it to the current time when contract deployed is a good idea. If you have to start the withdrawal time further in the future, you can extend if you like.
* `sunsetWithdrawPeriodInit` - The amount of time in seconds needs to lapse before the beneficiary can swip the funds after sunsetting the contract. Suggested time is 5184000 seconds, which is two months.
* `minimumFundingAmountInit` - The minimum amount in wei that funders can contribute at a time. Suggested amount 0.01 ether or 10000000000000000 wei.

### Funding contract
Funders can send ether to the contract address using external accounts. For contracts, there's a `fund()` function which takes care of the same functionality but provides more gas that the fallback function can't.
### Withdrawing to beneficiary
The beneficiary needs to call the `withdraw()` function from their beneficiary account.
### Refunding funders
The funder needs to call the `refund()` function using their funding address as a parameter. The ether will be returned to their original funding account and they'll be removed as a funder. Their isn't an option to send the ether to another address at the moment.

## Additional functions
### Remove funders
There's an additional function `removeFunder` that removes a funder without refunding. This could be used when a funder wants to back out but donate their eth to the pool, or in cases when the funder's balance has reached zero and they want to remove themselves cleanly.

### Sunsetting contract
If the beneficiary decides to end this contract, they can sunset it calling `sunset()`. This puts the contract into sunset mode. This prevents the beneficary from withdrawing more funds through `withdraw()` & also prevents people adding more funds. At the end of the sunset withdrawal period, the beneficiary can swipe the rest of the ether that was left in the contract.

## Contract Mechanism: Keeping track of funder balances
In an ideal world when a withdrawal occurs, we loop through each funder and deduct 10%. However, due to the constraints of running loops on dynamic mappings on Ethereum, we have to get a bit more creative to keep track of funder amounts when withdrawals occur.

The StakeTree MVP does this by using two additional variables: a global `withdrawalCounter` and an additional `withdrawalEntry` variable in the funder struct. 
* The global `withdrawalCounter` increases each time a withdrawal occurs.
* The funder `withdrawalEntry` keeps track of the withdrawal count at which the funder added their latest funding.

When the funder wants to refund, the contracts calculates the amount of withdrawals that occured since the funder came into the contract. It then uses that amount to figure out how many times to deduct 10% consecutively. We then reach the funder's true balance.

So for example, let's say you have funder A who adds 10 ether when there were 5 withdrawals prior. So the `withdrawalEntry` for funder A is stored as 5. Two withdrawals occur, increasing the global `withdrawalCounter` to 7. The funder's true balance is then calculated by deducting 10% twice (7-5). You can see this in action in the `getRefundAmountForFunder` function.

As additional point, when an existing funder tops up their funding, we calculate the true amount, reset their counter and then add the new amount.

## Deployment
Feel free to deploy this contract if you need for yourself. Do contact me as I'd love to hear how people are using StakeTree contract. While the StakeTree.com is being built, I can also deploy this contract for anyone who's interested in getting funded but need some technical help. Email me: nieldlr@gmail.com

## Contributing
Feel free to contribute any code or fork this project. If you have ideas, open up an issue or contact me via email (above) as well.
