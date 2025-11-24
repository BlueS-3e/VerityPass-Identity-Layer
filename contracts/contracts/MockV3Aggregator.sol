// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockV3Aggregator {
    uint8 public decimals;
    int256 public answer;
    uint256 public roundTimestamp;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        answer = _initialAnswer;
        roundTimestamp = block.timestamp;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (0, answer, 0, roundTimestamp, 0);
    }

    function updateAnswer(int256 _answer) external {
        answer = _answer;
        roundTimestamp = block.timestamp;
    }

    // test helper: set a custom updated timestamp
    function setUpdatedAt(uint256 ts) external {
        roundTimestamp = ts;
    }
}
