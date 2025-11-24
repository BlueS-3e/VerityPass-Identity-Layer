// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPriceOracle {
    // simple mapping from asset address to price (18-decimal)
    mapping(address => uint256) public prices;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function setPrice(address asset, uint256 price) external {
        require(msg.sender == owner, "only owner");
        prices[asset] = price;
    }

    function getAssetPrice(address asset) external view returns (uint256) {
        uint256 p = prices[asset];
        require(p > 0, "price not set");
        return p;
    }
}
