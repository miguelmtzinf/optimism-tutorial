async function main() {
  const l2CustomERC20Factory = await ethers.getContractFactory("L2CustomERC20");

  console.log("deploying L2CustomERC20 to", hre.network.name);

  // AAVE token
  const l1Token = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";

  const l2CustomERC20 = await l2CustomERC20Factory.deploy(
    "0x4200000000000000000000000000000000000010", // L2 Standard Bridge
    l1Token, // L1 token
    "Aave Token", // name
    "AAVE" // symbol
  );
  console.log("L2 CustomERC20 deployed to:", l2CustomERC20.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
