# How can a contract on one layer control a contract on the other

[![Discord](https://img.shields.io/discord/667044843901681675.svg?color=768AD4&label=discord&logo=https%3A%2F%2Fdiscordapp.com%2Fassets%2F8c9701b98ad4372b58f13fd9f65f966e.svg)](https://discord.com/channels/667044843901681675)
[![Twitter Follow](https://img.shields.io/twitter/follow/optimismPBC.svg?label=optimismPBC&style=social)](https://twitter.com/optimismPBC)

This tutorial teaches you how to write a contract on one layer (either L1 or L2) that sends a message to call a function on a contract on the other layer. 
[You can read more details about this process here](https://community.optimism.io/docs/developers/bridge/messaging/).

## Seeing it in action

To show how this works we installed [a slightly modified version of HardHat's `Greeter.sol`](contracts/Greeter.sol) on both L1 Kovan and Optimistic Kovan


| Network | Greeter address  |
| ------- | ---------------- |
| Kovan (L1) | [0x11fB328D5Bd8E27917535b6d40b881d35BC39Be0](https://kovan.etherscan.io/address/0x11fB328D5Bd8E27917535b6d40b881d35BC39Be0) |
| Optimistic Kovan (L2) | [0xD4c204223d6F1Dfad0b7a0b05BB0bCaB6665e0c9](https://kovan-optimistic.etherscan.io/address/0xD4c204223d6F1Dfad0b7a0b05BB0bCaB6665e0c9) |


### Setup

This setup assumes you already have [Node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/) installed on your system. 

1. Edit `hardhat.config.js`:
   1. Set `mnemonic` to point to an account that has ETH on the Kovan test network. 
   1. Set `module.exports.networks.kovan` to point to a URL that accesses the Kovan test network.

1. Install the necessary packages.

   ```sh
   yarn
   ```

### L1 message to L2

1. [Browse to the Greeter contract on Etherscan](https://kovan-optimistic.etherscan.io/address/0xD4c204223d6F1Dfad0b7a0b05BB0bCaB6665e0c9#readContract) and click **greet** to see the greeting.

1. Connect the Hardhat console to Kovan (L1):

   ```sh
   yarn hardhat console --network kovan
   ```

1. Deploy and call the `ControlL2Greeter` contract.

   ```js
   Controller = await ethers.getContractFactory("ControlL2Greeter")
   controller = await Controller.deploy()
   tx = await controller.setGreeting("Shalom")
   rcpt = await tx.wait()
   ```

1. Make a note of the address of `ControlL2Greeter`.

   ```js
   controller.address
   ```

1. [Browse to the Greeter contract on Etherscan](https://kovan-optimistic.etherscan.io/address/0xD4c204223d6F1Dfad0b7a0b05BB0bCaB6665e0c9#readContract) and click **greet** to see the new greeting.



### L2 message to L1


1. [Browse to the Greeter contract on Etherscan](https://kovan.etherscan.io/address/0x11fB328D5Bd8E27917535b6d40b881d35BC39Be0#readContract) and click **greet** to see the greeting.

1. Connect the Hardhat console to Optimistic Kovan (L2):

   ```sh
   yarn hardhat console --network kovan
   ```

1. Deploy and call the `ControlL1Greeter` contract.

   ```js
   Controller = await ethers.getContractFactory("ControlL1Greeter")
   controller = await Controller.deploy()
   tx = await controller.setGreeting("Shalom")
   rcpt = await tx.wait()
   ```

1. Make a note of the address of `ControlL1Greeter`.

   ```js
   controller.address
   ```

1. Keep a copy of the transaction hash.

   ```js
   tx.hash
   ```

Once the fault challenge period is over (one minute on Kovan, seven days on the production network) it is necessary to claim the transaction on L1. 
This is a complex process that requires a [Merkle proof](https://medium.com/crypto-0-nite/merkle-proofs-explained-6dd429623dc5):

1. Browse to the [message relayer](https://kovan-optimistic.etherscan.io/messagerelayer).

1. Enter the transaction hash and click the magnifying glass.

1. Ignore the fact that no token withdrawals are found and click **Execute** and then **Confirm**.

1. Approve the transaction in the wallet (which has to be connected to Kovan and have sufficient Kovan ETH).

1. [Browse to the Greeter contract on Etherscan](https://kovan.etherscan.io/address/0x11fB328D5Bd8E27917535b6d40b881d35BC39Be0#readContract) and click **greet** to see the new greeting.


## How it's done (in Solidity)

We'll go over the L1 contract that controls Greeter on L2, [`ControlL2Greeter.sol`](contracts/ControlL2Greeter.sol).
Except for addresses, the contract going the other direction, [`ControlL1Greeter.sol`](contracts/ControlL21reeter.sol), is identical.

```solidity
//SPDX-License-Identifier: Unlicense
// This contracts runs on L1, and controls a Greeter on L2.
pragma solidity ^0.8.0;

import { ICrossDomainMessenger } from 
    "@eth-optimism/contracts/libraries/bridge/ICrossDomainMessenger.sol";
```

This line imports the interface to send messages, [`ICrossDomainMessenger.sol`](https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts/contracts/libraries/bridge/ICrossDomainMessenger.sol).


```solidity
contract ControlL2Greeter {
    address crossDomainMessengerAddr = 0x4361d0F75A0186C05f971c566dC6bEa5957483fD;
```

This is the address of [`Proxy_OVM_L1CrossDomainMessenger`](https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts/deployments/kovan/Proxy__OVM_L1CrossDomainMessenger.json#L2) on Kovan. 
To call L2 from L1 on mainnet, you need to [use this address](https://github.com/ethereum-optimism/optimism/blob/develop/packages/contracts/deployments/mainnet/Proxy__OVM_L1CrossDomainMessenger.json#L2).
To call L1 from L2, on either mainnet or Kovan, use the address of `L2CrossDomainMessenger`, 0x4200000000000000000000000000000000000007.

```solidity
    address greeterL2Addr = 0xD4c204223d6F1Dfad0b7a0b05BB0bCaB6665e0c9;
```    

This is the address on which `Greeter` is installed on Optimistic Kovan.


```solidity
    function setGreeting(string calldata _greeting) public {
```

This function sets the new greeting. Note that the string is stored in `calldata`. 
This saves us some gas, because when we are called from an externally owned account or a different contract there no need to copy the input string to memory.
The downside is that we cannot call `setGreeting` from within this contract, because contracts cannot modify their own calldata.

```solidity
        bytes memory message;
```

This is where we'll store the message to send to L2.

```solidity 
        message = abi.encodeWithSignature("setGreeting(string)", 
            _greeting);
```

Here we create the message, the calldata to be sent on L2.
The Solidity [`abi.encodeWithSignature`](https://docs.soliditylang.org/en/v0.8.12/units-and-global-variables.html?highlight=abi.encodeWithSignature#abi-encoding-and-decoding-functions) function creates this calldata.
As [specified in the ABI](https://docs.soliditylang.org/en/v0.5.3/abi-spec.html), it is four bytes of signature for the function being called followed by the parameter, in this case a string.

```solidity
        ICrossDomainMessenger(crossDomainMessengerAddr).sendMessage(
            greeterL2Addr,
            message,
            1000000   // within the free gas limit amount
        );
```

This call actually sends the message. It gets three parameters:

1. The address on L2 of the contract being contacted
1. The calldata to send that contract
1. The gas limit.
   As long as the gas limit is below the [`enqueueL2GasPrepaid`](https://etherscan.io/address/0x5E4e65926BA27467555EB562121fac00D24E9dD2#readContract) value, there is no extra cost.
   Note that this parameter is also required on messages from L2 to L1, but there it does not affect anything.

```solidity
    }      // function setGreeting 
}          // contract ControlL2Greeter
```


## Getting the source address

If you look at Etherscan, for either the [L1 Greeter](https://kovan-optimistic.etherscan.io/address/0xD4c204223d6F1Dfad0b7a0b05BB0bCaB6665e0c9#events) or the [L2 Greeter](https://kovan-optimistic.etherscan.io/address/0xD4c204223d6F1Dfad0b7a0b05BB0bCaB6665e0c9#events), you will see events with the source address on the other layer.
The way this works is that the cross domain messenger that calls the target contract has a method, `xDomainMessageSender()`, that returns the source address. It is used by the `getXsource` function in `Greeter`.

```solidity
  // Get the cross domain origin, if any
  function getXorig() private view returns (address) {
    address cdmAddr = address(0);    
```

If might look like it would be more efficient to calculate the address of the cross domain messanger just once, but that would involve changing the state, which is an expensive operation. This way it can be a `view` function without a gas cost.

```solidity
    if (block.chainid == 1)
      cdmAddr = 0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1;

    // Kovan
    if (block.chainid == 42)
      cdmAddr = 0x4361d0F75A0186C05f971c566dC6bEa5957483fD;

    // L2
    if (block.chainid == 10 || block.chainid == 69)
      cdmAddr = 0x4200000000000000000000000000000000000007;
```

The three possibilities for the cross domain messenger's address.
On L2 Optimism has full control of the genesis block, so we can put all of our contracts on convenient addresses. L1 does not afford us this luxury.

```solidity
    // If this isn't a cross domain message
    if (msg.sender != cdmAddr)
      return address(0);
```

If the sender isn't the cross domain messenger, then this isn't a cross domain message.
Just return zero.


```solidity
    // If it is a cross domain message, find out where it is from
    return ICrossDomainMessenger(cdmAddr).xDomainMessageSender();
  }    // getXorig()
```

If it is the cross domain messenger, call `xDomainMessageSender()` to get the original source address.

## Conclusion

You should now be able to control contracts on one layer from the other.
This is useful, for example, if you want to hold cheap DAO votes on L2 to manage an L1 treasury (see [rollcall](https://github.com/withtally/rollcall)) or offload a complicated calculation, which must be done in a traceable manner, to L2 where gas is cheap.