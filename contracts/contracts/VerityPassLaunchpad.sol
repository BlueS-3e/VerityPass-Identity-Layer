// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Use OpenZeppelin contracts for safety primitives
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

contract VerityPassLaunchpad is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Flat platform fee expressed in USD cents (e.g. 100 == $1.00)
    uint256 public platformFeeUsdCents = 100; // default $1.00
    // Percentage fee applied on withdrawals (basis points). e.g. 25 == 0.25%
    uint256 public platformPctBps = 0; // default disabled
    // Apply percentage fee only when totalRaised (or payout) exceeds this USD cents threshold
    uint256 public pctThresholdUsdCents = 100000; // $1,000 default threshold

    enum ProjectStatus { Pending, Approved, Rejected, Active, Ended }

    struct Project {
        address payable projectOwner;
        string metadataHash; // IPFS or backend reference
        IERC20 investToken;  // ERC20 token for investment
        uint256 totalRaised;
        uint256 hardCap;
        uint256 startTime;
        uint256 endTime;
        ProjectStatus status;
    }

    Project[] public projects;
    mapping(uint256 => mapping(address => uint256)) public investments; // projectId => investor => amount

    AggregatorV3Interface public priceFeed; // Chainlink price feed (ETH/USD) - optional helper

    event ProjectCreated(uint256 indexed projectId, address indexed owner, string metadataHash);
    event ProjectVetted(uint256 indexed projectId, ProjectStatus status);
    event Invested(uint256 indexed projectId, address indexed investor, uint256 amount);
    event Withdrawn(uint256 indexed projectId, uint256 amountToOwner, uint256 feeToPlatform);

    // simple paused flag (Pausable not available in this OZ version here)
    bool public paused;

    event Paused();
    event Unpaused();

    modifier onlyProjectOwner(uint256 projectId) {
        require(msg.sender == projects[projectId].projectOwner, "Not project owner");
        _;
    }

    modifier projectActive(uint256 projectId) {
        require(projects[projectId].status == ProjectStatus.Active, "Project not active");
        _;
    }

    constructor(address _priceFeed) Ownable(msg.sender) {
        // OpenZeppelin Ownable in this dependency requires an explicit initialOwner
        // argument in the base constructor (constructor(address initialOwner)).
        // Pass deployer (msg.sender) as the initial owner.
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }
    // token => Chainlink price feed (token / USD with 8 decimals)
    mapping(address => address) public tokenPriceFeed;
    // token => decimals (e.g., 18)
    mapping(address => uint8) public tokenDecimals;

    // Referral / loyalty
    // who referred whom (referee => referrer)
    mapping(address => address) public referrerOf;
    // rebate balances per token per user (token => user => amount in token units)
    mapping(address => mapping(address => uint256)) public rebateBalance;
    // rebate percentages (basis points) applied to collected fees: to referrer and to referee
    uint256 public referrerRebateBps = 0; // 0% default
    uint256 public refereeRebateBps = 0; // 0% default

    event ReferralRegistered(address indexed referee, address indexed referrer);
    event RebateClaimed(address indexed user, address indexed token, uint256 amount);
    event FeeCollected(uint256 indexed projectId, address indexed token, uint256 feeAmount, uint256 referrerRebate, uint256 refereeRebate, uint256 ownerReceives);
    event PlatformPctBpsUpdated(uint256 newBps);
    event PctThresholdUsdCentsUpdated(uint256 newThreshold);
    event ReferralRebateBpsUpdated(uint256 referrerBps, uint256 refereeBps);
    // price staleness threshold (seconds)
    uint256 public priceStaleThreshold = 300; // default 5 minutes

    event PriceStaleThresholdUpdated(uint256 newThresholdSeconds);

    event PlatformFeeUsdCentsUpdated(uint256 newFeeCents);
    event TokenPriceFeedSet(address indexed token, address indexed feed, uint8 decimals);
    

    function createProject(
        string calldata metadataHash,
        address investToken,
        uint256 hardCap,
        uint256 startTime,
        uint256 endTime
    ) external {
    require(startTime < endTime, "Invalid time range");
    require(!paused, "Paused");
        projects.push(Project({
            projectOwner: payable(msg.sender),
            metadataHash: metadataHash,
            investToken: IERC20(investToken),
            totalRaised: 0,
            hardCap: hardCap,
            startTime: startTime,
            endTime: endTime,
            status: ProjectStatus.Pending
        }));
        emit ProjectCreated(projects.length - 1, msg.sender, metadataHash);
    }

    // Admin vetting: approve or reject
    function vetProject(uint256 projectId, bool approve) external onlyOwner {
        require(projectId < projects.length, "Invalid project");
        require(projects[projectId].status == ProjectStatus.Pending, "Already vetted");
        projects[projectId].status = approve ? ProjectStatus.Approved : ProjectStatus.Rejected;
        emit ProjectVetted(projectId, projects[projectId].status);
    }

    // Anyone can activate an approved project when start time is reached
    function activateProject(uint256 projectId) external {
        Project storage proj = projects[projectId];
        require(proj.status == ProjectStatus.Approved, "Not approved");
        require(block.timestamp >= proj.startTime, "Too early");
        proj.status = ProjectStatus.Active;
    }

    function invest(uint256 projectId, uint256 amount) external projectActive(projectId) {
        Project storage proj = projects[projectId];
        require(block.timestamp >= proj.startTime, "Not started");
        require(block.timestamp <= proj.endTime, "Ended");
        // status already checked by modifier
        require(amount > 0, "Zero amount");
        require(proj.totalRaised + amount <= proj.hardCap, "Exceeds hard cap");
    require(!paused, "Paused");
    IERC20(address(proj.investToken)).safeTransferFrom(msg.sender, address(this), amount);
        proj.totalRaised += amount;
        investments[projectId][msg.sender] += amount;
        emit Invested(projectId, msg.sender, amount);

        // End project if hard cap reached
        if (proj.totalRaised == proj.hardCap) {
            proj.status = ProjectStatus.Ended;
        }
    }

    function withdraw(uint256 projectId) external onlyProjectOwner(projectId) {
        Project storage proj = projects[projectId];
        require(proj.status == ProjectStatus.Ended || block.timestamp > proj.endTime, "Not ended");
        require(proj.totalRaised > 0, "Nothing to withdraw");
        // Compute fee in token units based on USD target (platformFeeUsdCents)
        address tokenAddr = address(proj.investToken);
        address feed = tokenPriceFeed[tokenAddr];
        require(feed != address(0), "No price feed for token");
        uint8 decimals = tokenDecimals[tokenAddr];
        require(decimals > 0, "Token decimals not set");

    (, int256 price, , uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
    require(price > 0, "Invalid price");
    // check oracle freshness
    require(updatedAt > 0, "invalid feed timestamp");
    require(block.timestamp - updatedAt <= priceStaleThreshold, "stale price");
        // Helper to convert USD cents to token units (handles Chainlink 8 decimals)
        // tokenUnits = usdCents * 1e8 * 10**decimals / (100 * price)
        uint256 totalRaised = proj.totalRaised;

        uint256 flatFeeUnits = usdCentsToTokenUnits(tokenAddr, uint256(platformFeeUsdCents));
        if (flatFeeUnits > totalRaised) flatFeeUnits = totalRaised;

        // Start from payout after flat fee
        uint256 payout = totalRaised - flatFeeUnits;

        // Percentage fee logic
        uint256 pctFeeUnits = 0;
        if (platformPctBps > 0) {
            // compute threshold in token units
            uint256 thresholdUnits = usdCentsToTokenUnits(tokenAddr, pctThresholdUsdCents);
            // apply percentage fee only if raised exceeds thresholdUnits
            if (totalRaised > thresholdUnits) {
                // apply percentage to payout (after flat fee)
                pctFeeUnits = (payout * platformPctBps) / 10000;
                if (pctFeeUnits > payout) pctFeeUnits = payout;
                payout = payout - pctFeeUnits;
            }
        }

        uint256 totalFeeCollected = flatFeeUnits + pctFeeUnits;

        // zero state before external calls
        proj.totalRaised = 0;

        // delegate distribution and transfers to internal helper (reduces stack depth)
        _distributeAndTransfer(projectId, tokenAddr, proj.projectOwner, payout, totalFeeCollected);
    }

    function _distributeAndTransfer(uint256 projectId, address tokenAddr, address projectOwner, uint256 payout, uint256 totalFeeCollected) internal {
        uint256 referrerRebate = 0;
        uint256 refereeRebate = 0;
        address referrer = referrerOf[projectOwner];
        address referee = projectOwner;
        if (totalFeeCollected > 0) {
            if (referrer != address(0) && referrer != referee && referrerRebateBps > 0) {
                referrerRebate = (totalFeeCollected * referrerRebateBps) / 10000;
                rebateBalance[tokenAddr][referrer] += referrerRebate;
            }
            if (refereeRebateBps > 0) {
                refereeRebate = (totalFeeCollected * refereeRebateBps) / 10000;
                rebateBalance[tokenAddr][referee] += refereeRebate;
            }
        }

        uint256 ownerReceives = 0;
        if (totalFeeCollected > referrerRebate + refereeRebate) {
            ownerReceives = totalFeeCollected - referrerRebate - refereeRebate;
        }

        IERC20 token = IERC20(tokenAddr);
        if (ownerReceives > 0) {
            token.safeTransfer(owner(), ownerReceives);
        }
        if (payout > 0) {
            token.safeTransfer(projectOwner, payout);
        }

        emit FeeCollected(projectId, tokenAddr, totalFeeCollected, referrerRebate, refereeRebate, ownerReceives);
        emit Withdrawn(projectId, payout, totalFeeCollected);
    }

    /// @notice Convert USD cents to token units using token's registered feed and decimals
    /// @dev Multiplies by decimals BEFORE dividing to prevent integer division precision loss
    /**
     * Formula: tokenUnits = (usdCents * 1e8 * 10^decimals) / (100 * price)
     * Where 1e8 = Chainlink price decimals
     * 
     * Key fix: Multiply by token decimals first to preserve precision in integer division
     */
    function usdCentsToTokenUnits(address tokenAddr, uint256 usdCents) public view returns (uint256) {
        address feed = tokenPriceFeed[tokenAddr];
        require(feed != address(0), "No price feed");
        uint8 decimals = tokenDecimals[tokenAddr];
        require(decimals > 0, "Token decimals not set");
        
        (, int256 price,,,) = AggregatorV3Interface(feed).latestRoundData();
        require(price > 0, "Invalid price");
        uint256 priceUint = uint256(price);
        
        // FIXED: Multiply by decimals BEFORE dividing to prevent integer precision loss
        // Step 1: usdCents * 1e8 (Chainlink decimals)
        uint256 adjusted = usdCents * 1e8;
        // Step 2: Multiply by token decimals to preserve precision during division
        uint256 withDecimals = adjusted * (10 ** decimals);
        // Step 3: Divide by (100 * price) to get token units
        uint256 result = withDecimals / (100 * priceUint);
        
        return result;
    }

    /// Referrals: register a referrer (only once)
    function registerReferrer(address referrer) external {
        require(referrer != address(0), "zero referrer");
        require(referrer != msg.sender, "self referrer");
        require(referrerOf[msg.sender] == address(0), "already set");
        referrerOf[msg.sender] = referrer;
        emit ReferralRegistered(msg.sender, referrer);
    }

    /// Claim accumulated rebate for a token
    function claimRebate(address token) external nonReentrant {
        uint256 amount = rebateBalance[token][msg.sender];
        require(amount > 0, "no rebate");
        rebateBalance[token][msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit RebateClaimed(msg.sender, token, amount);
    }

    /// Admin setters for pct fee and thresholds and rebate bps
    function setPlatformPctBps(uint256 newBps) external onlyOwner {
        require(newBps <= 10000, "bps too large");
        platformPctBps = newBps;
        emit PlatformPctBpsUpdated(newBps);
    }

    function setPctThresholdUsdCents(uint256 newThreshold) external onlyOwner {
        pctThresholdUsdCents = newThreshold;
        emit PctThresholdUsdCentsUpdated(newThreshold);
    }

    function setReferralRebateBps(uint256 _referrerBps, uint256 _refereeBps) external onlyOwner {
        require(_referrerBps + _refereeBps <= 10000, "total rebate too large");
        referrerRebateBps = _referrerBps;
        refereeRebateBps = _refereeBps;
        emit ReferralRebateBpsUpdated(_referrerBps, _refereeBps);
    }

    function setPriceStaleThreshold(uint256 newThresholdSeconds) external onlyOwner {
        priceStaleThreshold = newThresholdSeconds;
        emit PriceStaleThresholdUpdated(newThresholdSeconds);
    }

    function setPlatformFeeUsdCents(uint256 newFeeCents) external onlyOwner {
        require(newFeeCents <= 1000000, "Fee too large");
        platformFeeUsdCents = newFeeCents;
        emit PlatformFeeUsdCentsUpdated(newFeeCents);
    }

    /// @notice Register a Chainlink price feed for a token and set its decimals
    function setTokenPriceFeed(address token, address feed, uint8 decimals) external onlyOwner {
        require(token != address(0) && feed != address(0), "zero addr");
        tokenPriceFeed[token] = feed;
        tokenDecimals[token] = decimals;
        emit TokenPriceFeedSet(token, feed, decimals);
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
