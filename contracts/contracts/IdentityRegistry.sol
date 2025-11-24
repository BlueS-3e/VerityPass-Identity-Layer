// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    mapping(address => string) private metadataCID;

    event IdentityCreated(address indexed owner, string metadataCID);
    event IdentityUpdated(address indexed owner, string oldCID, string newCID);

    function createIdentity(string calldata _metadataCID) external {
        require(bytes(metadataCID[msg.sender]).length == 0, "Identity exists");
        metadataCID[msg.sender] = _metadataCID;
        emit IdentityCreated(msg.sender, _metadataCID);
    }

    function updateIdentity(string calldata _metadataCID) external {
        require(bytes(metadataCID[msg.sender]).length != 0, "Identity missing");
        string memory old = metadataCID[msg.sender];
        metadataCID[msg.sender] = _metadataCID;
        emit IdentityUpdated(msg.sender, old, _metadataCID);
    }

    function getMetadata(address _owner) external view returns (string memory) {
        return metadataCID[_owner];
    }
}
