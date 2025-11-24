const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Mock Aave flow', function () {
  it('approve -> supply -> borrow works on mock pool', async function () {
    const [deployer, user] = await ethers.getSigners();

    // Deploy MockERC20 and mint tokens to deployer
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const initialSupply = ethers.parseUnits('1000000', 18);
  const token = await MockERC20.deploy('Mock Token', 'MCK', 18, initialSupply);
  await token.waitForDeployment();

    // Transfer some tokens to user
    const userAmount = ethers.parseUnits('1000', 18);
    await token.transfer(user.getAddress(), userAmount);

    // Deploy MockPriceOracle and set price to 1 (1e18)
    const Oracle = await ethers.getContractFactory('MockPriceOracle');
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  await oracle.setPrice(token.target, ethers.parseUnits('1', 18));

    // Deploy MockAavePool with oracle
    const Pool = await ethers.getContractFactory('MockAavePool');
  const pool = await Pool.deploy(oracle.target);
  await pool.waitForDeployment();

    // Seed pool with tokens so borrow can be satisfied: transfer from deployer to pool
    const poolSeed = ethers.parseUnits('5000', 18);
  await token.transfer(pool.target, poolSeed);

    // User approves pool to spend collateral
    const collateralAmount = ethers.parseUnits('100', 18);
    await token.connect(user).approve(pool.target, collateralAmount);

    // User calls supply -> transfers tokens from user to pool
    await pool.connect(user).supply(token.target, collateralAmount, await user.getAddress(), 0);

    // Pool should have increased collateral recorded for user
  const recorded = await pool.collateral(await user.getAddress(), token.target);
  expect(recorded.toString()).to.equal(collateralAmount.toString());

    // Now attempt to borrow: ensure pool has enough balance
    const borrowAmount = ethers.parseUnits('50', 18);
    // borrow to user
    await pool.borrow(token.target, borrowAmount, 2, 0, await user.getAddress());

    const userBalance = await token.balanceOf(await user.getAddress());
    // user had 1000, supplied 100 -> 900, then borrowed 50 -> 950
    expect(userBalance.toString()).to.equal(ethers.parseUnits('950', 18).toString());

    const poolBalance = await token.balanceOf(pool.target);
    // pool initial seed 5000 + supply 100 from user - borrow 50 = 5050
  // poolSeed, collateralAmount, borrowAmount are bigint (ethers v6 parseUnits)
  const expectedPool = (BigInt(poolSeed.toString()) + BigInt(collateralAmount.toString()) - BigInt(borrowAmount.toString()));
  expect(poolBalance.toString()).to.equal(expectedPool.toString());
  });
});
