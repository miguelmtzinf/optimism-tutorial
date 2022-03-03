#! /usr/local/bin/node

// Deposits from L1 to L2 using the Optimism SDK

const ethers = require("ethers")

const optimismSDK = require("@eth-optimism/sdk")

const network = "kovan"    // "kovan" or "mainnet"

const mnemonic = "test test test test test test test test test test test junk"
const l2Url = "https://opt-kovan.g.alchemy.com/v2/LX8fbnFwi6eTRygEv2RSsY5hcvYBlmir" // `https://${network}.optimism.io`
const l1Url = "https://eth-kovan.alchemyapi.io/v2/gp03_wJCXf9VyAVCLeoNembJ9fV59iKy"
const getSigners = async () => {
//    const l1RpcProvider = new ethers.providers.getDefaultProvider(network)
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(l1Url)    
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(l2Url)
    const privateKey = ethers.utils.HDNode.fromMnemonic(mnemonic).privateKey
    const l1Wallet = new ethers.Wallet(privateKey, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(privateKey, l2RpcProvider)

    return [l1Wallet, l2Wallet]
}   // getSigners

// Contract addresses for DAI tokens, taken 
// from https://static.optimism.io/optimism.tokenlist.json
const daiAddrs = {
    l1Addr: network === "kovan" ? "0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa" 
                                : "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    l2Addr: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
}    // daiAddrs


// The ABI fragment for an ERC20 we need to get a user's balance.
const erc20ABI = [  
    // balanceOf
    {    
      constant: true,  
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      type: "function",
    },
  ]



const sleep = ms => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

const depositETH = async (l1Signer, l2Signer, crossChainMessenger) => {

    // The function is here so we won't have to explicitly pass 
    // it l1Signer and l2Signer
    const reportBalances = async () => {
        l1Balance = (await l1Signer.getBalance()).toString().slice(0,-9)
        l2Balance = (await l2Signer.getBalance()).toString().slice(0,-9)

        console.log(`On L1:${l1Balance} Gwei    On L2:${l2Balance} Gwei`)
    }    // reportBalances

    console.log("Deposit ETH")
    await reportBalances()

    const depositETHResponse = await crossChainMessenger.depositETH(1000000001n) // 1 GWei
    await depositETHResponse.wait()
    await crossChainMessenger.waitForMessageStatus(depositETHResponse, 
                                                  optimismSDK.MessageStatus.RELAYED, 
                                                  {pollIntervalMs: 1000, timeoutMs: 3600*1000})
    await reportBalances()    
}     // depositETH()



const withdrawETH = async (l1Signer, l2Signer, crossChainMessenger) => {

  // The function is here so we won't have to explicitly pass 
  // it l1Signer and l2Signer
  const reportBalances = async () => {
      l1Balance = (await l1Signer.getBalance()).toString().slice(0,-9)
      l2Balance = (await l2Signer.getBalance()).toString().slice(0,-9)

      console.log(`On L1:${l1Balance} Gwei    On L2:${l2Balance} Gwei`)
  }    // reportBalances

  console.log("Withdraw ETH")
  await reportBalances()

  const withdrawETHResponse = await crossChainMessenger.withdrawETH(1000000000000000n) // Million GWei
  await withdrawETHResponse.wait()

  await crossChainMessenger.waitForMessageStatus(withdrawETHResponse, 
    optimismSDK.MessageStatus.IN_CHALLENGE_PERIOD, 
    {pollIntervalMs: 1000, timeoutMs: 3600*1000}) 
  console.log("In the challenge period") 
  await crossChainMessenger.waitForMessageStatus(withdrawETHResponse, 
                                                optimismSDK.MessageStatus.READY_FOR_RELAY, 
                                                {pollIntervalMs: 1000, timeoutMs: 3600*1000})
  await reportBalances()
  await crossChainMessenger.finalizeMessage(withdrawETHResponse)
  console.log("Finalized message")
  await reportBalances()
  await crossChainMessenger.waitForMessageStatus(withdrawETHResponse, 
    optimismSDK.MessageStatus.RELAYED, 
    {pollIntervalMs: 1000, timeoutMs: 3600*1000})
  console.log("Message has been relayed")  
  await reportBalances()      
  for(var i=0; i<20; i++) {
    await sleep(1000)
    console.log(i)
    await reportBalances()
  }
}     // withdrawETH()




const main = async () => {    

    const [l1Signer, l2Signer] = await getSigners()
    const crossChainMessenger = new optimismSDK.CrossChainMessenger({
        l1ChainId: network === "kovan" ? 42 : 1,    
        l1SignerOrProvider: l1Signer,
        l2SignerOrProvider: l2Signer
    })

//    await depositETH(l1Signer, l2Signer, crossChainMessenger)
    await withdrawETH(l1Signer, l2Signer, crossChainMessenger)    
    /*
    const l1ERC20 = new ethers.Contract(daiAddrs.l1Addr, erc20ABI, l1Signer)
    const l2ERC20 = new ethers.Contract(daiAddrs.l2Addr, erc20ABI, l2Signer)    

    const ERC20Amt = 1000000000n

    console.log((await l1ERC20.balanceOf(l1Signer.address)).toString())
    console.log((await l2ERC20.balanceOf(l1Signer.address)).toString())    


    const txResponse = await crossChainMessenger.depositERC20(daiAddrs.l1Addr, 
                                                              daiAddrs.l2Addr,
                                                              ERC20Amt, {
                                                                  l2GasLimit: 30000000n,
                                                                  overrides: {
                                                                      gasLimit: 30000000n
                                                                  }
                                                              }) 
    await txResponse.wait()
    console.log((await l1ERC20.balanceOf(l1Signer.address)).toString()) 
    console.log((await l2ERC20.balanceOf(l1Signer.address)).toString())                                                                     
    */
}  // main



main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })





