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
    
    // ADDED: Score freshness validation to prevent stale data
    uint256 public scoreMaxAgeSeconds = 30 days; // Default: scores older than 30 days are stale

    event OracleUpdated(address indexed oracle, bool allowed);
    event ScorePublished(address indexed subject, address indexed updater, bytes32 scoreHash, uint8 bucket, uint256 updatedAt);
    // ADDED: Event for freshness threshold changes
    event ScoreMaxAgeUpdated(uint256 newMaxAgeSeconds);

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
    
    // ADDED: Validate score freshness before using
    function getScoreFresh(address _subject) external view returns (bytes32, uint8, uint256, address) {
        Score memory s = scores[_subject];
        require(s.updatedAt > 0, "No score found");
        // FIXED: Check score is not stale
        require(block.timestamp - s.updatedAt <= scoreMaxAgeSeconds, "Score is stale");
        return (s.scoreHash, s.bucket, s.updatedAt, s.updater);
    }
    
    // ADDED: Admin can update max age threshold
    function setScoreMaxAge(uint256 _maxAgeSeconds) external onlyOwner {
        require(_maxAgeSeconds > 0, "Max age must be positive");
        scoreMaxAgeSeconds = _maxAgeSeconds;
        emit ScoreMaxAgeUpdated(_maxAgeSeconds);
    }
    
    // ADDED: Check if score is currently valid without retrieving it
    function isScoreFresh(address _subject) external view returns (bool) {
        Score memory s = scores[_subject];
        if (s.updatedAt == 0) return false;
        return (block.timestamp - s.updatedAt <= scoreMaxAgeSeconds);
    }
}
