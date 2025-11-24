// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CreditScoreManager {
    address public owner;
    mapping(address => bool) public oracles;

    struct Score {
        bytes32 scoreHash;
        uint8 bucket;
        uint256 updatedAt;
        address updater;
    }

    mapping(address => Score) public scores;

    event OracleUpdated(address indexed oracle, bool allowed);
    event ScorePublished(address indexed subject, address indexed updater, bytes32 scoreHash, uint8 bucket, uint256 updatedAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyOracle() {
        require(oracles[msg.sender], "only oracle");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setOracle(address _oracle, bool _allowed) external onlyOwner {
        oracles[_oracle] = _allowed;
        emit OracleUpdated(_oracle, _allowed);
    }

    function publishScore(address _subject, bytes32 _scoreHash, uint8 _bucket) external onlyOracle returns (bool) {
        scores[_subject] = Score({
            scoreHash: _scoreHash,
            bucket: _bucket,
            updatedAt: block.timestamp,
            updater: msg.sender
        });
        emit ScorePublished(_subject, msg.sender, _scoreHash, _bucket, block.timestamp);
        return true;
    }

    function getScore(address _subject) external view returns (bytes32, uint8, uint256, address) {
        Score memory s = scores[_subject];
        return (s.scoreHash, s.bucket, s.updatedAt, s.updater);
    }
}
