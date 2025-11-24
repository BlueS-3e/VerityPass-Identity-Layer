// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IPriceOracle {
    function getAssetPrice(address asset) external view returns (uint256);
}

contract MockAavePool {
    IPriceOracle public oracle;
    address public owner;

    // holdings in token units mapped per user per asset
    mapping(address => mapping(address => uint256)) public collateral;
    mapping(address => mapping(address => uint256)) public debt;

    constructor(address _oracle) {
        oracle = IPriceOracle(_oracle);
        owner = msg.sender;
    }

    // supply token to pool; simplistic: pool holds tokens and records collateral
    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "transfer failed");
        collateral[onBehalfOf][asset] += amount;
    }

    // borrow: simplistic mint from the pool's own balance (not realistic)
    function borrow(address asset, uint256 amount, uint256 /*interestRateMode*/, uint16 /*referralCode*/, address onBehalfOf) external {
        // record debt for onBehalfOf
        debt[onBehalfOf][asset] += amount;
        // try to transfer tokens from pool to borrower if pool has balance
        require(IERC20(asset).balanceOf(address(this)) >= amount, "pool insufficient balance");
        require(IERC20(asset).transfer(onBehalfOf, amount), "transfer failed");
    }

    // getUserAccountData returns a tuple matching Aave's signature (simplified)
    // (totalCollateralBase,totalDebtBase,availableBorrowsBase,currentLiquidationThreshold, ltv, healthFactor)
    function getUserAccountData(address user) external view returns (uint256,uint256,uint256,uint256,uint256,uint256) {
        // sum collateral value across assets and debt value across assets using oracle prices
        uint256 totalCollateralBase = 0;
        uint256 totalDebtBase = 0;

        // for simplicity, we only consider the token addresses that have non-zero collateral field for the user
        // In this mock, we will not iterate dynamic keys; instead, callers should use a single-asset scenario.
        // To support tests, assume one asset supplied and borrowed (the test will only use one asset)
        // We'll just compute base values for the asset provided by test via a helper call pattern.

        // Fallback: return zeros; tests will use direct per-asset checks via oracle in the test script.
        return (totalCollateralBase, totalDebtBase, 0, 8250, 7500, type(uint256).max);
    }
}
