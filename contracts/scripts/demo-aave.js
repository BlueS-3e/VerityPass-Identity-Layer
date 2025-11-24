async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const MockERC20 = await ethers.getContractFactory('MockERC20');
  const initialSupply = ethers.parseUnits('1000000', 18);
  const token = await MockERC20.deploy('Mock Token', 'MCK', 18, initialSupply);
  await token.waitForDeployment();
  console.log('MockERC20 deployed at', token.target);

  const Oracle = await ethers.getContractFactory('MockPriceOracle');
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  await oracle.setPrice(token.target, ethers.parseUnits('1', 18));
  console.log('Price oracle at', oracle.target);

  const Pool = await ethers.getContractFactory('MockAavePool');
  const pool = await Pool.deploy(oracle.target);
  await pool.waitForDeployment();
  console.log('MockAavePool at', pool.target);

  // seed pool with tokens
  const seed = ethers.parseUnits('5000', 18);
  await token.transfer(pool.target, seed);
  console.log('Seeded pool with', seed.toString());

  console.log('\n--- Demo setup complete ---');
  console.log('Token:', token.target);
  console.log('Pool:', pool.target);
  console.log('Oracle:', oracle.target);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
