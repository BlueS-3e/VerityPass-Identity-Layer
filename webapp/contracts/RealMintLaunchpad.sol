// Archived duplicate. The canonical, up-to-date contract lives at:
// contracts/contracts/RealMintLaunchpad.sol
// This file was kept as a lightweight pointer to avoid accidental compilation of an outdated copy.

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
  NOTE: This is an archived duplicate of the Launchpad contract. See
  /contracts/contracts/RealMintLaunchpad.sol for the active implementation (OpenZeppelin-based,
  USD-denominated fees, referral/rebate, and staleness protections).

  The project keeps this pointer only to preserve history for reviewers during cleanup.
*/

contract Archived_RealMintLaunchpad_Pointer {}
    function setPlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 10, "Fee too high");
        platformFeePercent = newFeePercent;
    }

    // Chainlink price feed: returns ETH price in USD with 8 decimals
    function getLatestETHPrice() public view returns (int256) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        return price;
    }

    // Helper: get project count
    function getProjectCount() external view returns (uint256) {
        return projects.length;
    }

    // Helper: get project info
    function getProject(uint256 projectId) external view returns (
        address, string memory, address, uint256, uint256, uint256, uint256, ProjectStatus
    ) {
        Project storage p = projects[projectId];
        return (
            p.projectOwner,
            p.metadataHash,
            address(p.investToken),
            p.totalRaised,
            p.hardCap,
            p.startTime,
            p.endTime,
            p.status
        );
    }
}