# Contributing to VerityPass

Welcome to VerityPass! We're excited that you're interested in contributing to decentralized identity and under-collateralized lending infrastructure.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Setup](#development-setup)
3. [Contribution Guidelines](#contribution-guidelines)
4. [Code Standards](#code-standards)
5. [Testing](#testing)
6. [Security](#security)
7. [Pull Request Process](#pull-request-process)
8. [Reporting Issues](#reporting-issues)

---

## Getting Started

### Prerequisites

- **Node.js:** 18.0.0 or higher
- **Python:** 3.11+
- **Git:** Latest version
- **Docker:** (optional, for full stack testing)

### Fork & Clone

```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR_USERNAME/VerityPass-Identity-Layer.git
cd VerityPass-Identity-Layer

# Add upstream remote
git remote add upstream https://github.com/BlueS-3e/VerityPass-Identity-Layer.git
```

---

## Development Setup

### 1. Smart Contracts (Hardhat)

```bash
cd contracts

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local Hardhat network
npx hardhat run scripts/deploy-localhost.js --network localhost
```

**Environment Variables:**
```bash
# .env (create in contracts/)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SEPOLIA_PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_etherscan_key
```

### 2. Backend API (Flask)

```bash
cd api

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env

# Run database migrations
python migrate_projects_db.py

# Start development server
./run_dev.sh
# API available at http://localhost:5000
```

**Environment Variables:**
```bash
# .env (create in api/)
FLASK_ENV=development
FLASK_DEBUG=1
DATABASE_URL=sqlite:///instance/veritypass.db
REDIS_URL=redis://localhost:6379/0
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
WEB3_PROVIDER=http://localhost:8545
```

### 3. Frontend (React + Vite)

```bash
cd webapp

# Install dependencies
npm install

# Start development server
npm run dev
# App available at http://localhost:5173

# Build for production
npm run build
```

**Environment Variables:**
```bash
# .env.local (create in webapp/)
VITE_API_URL=http://localhost:5000
VITE_CONTRACT_ADDRESS=0x...
VITE_NETWORK_ID=11155111  # Sepolia
```

### 4. Admin Dashboard (React + Vite)

```bash
cd webapp-admin

# Install dependencies
npm install

# Start development server
npm run dev
# Admin available at http://localhost:5174

# Build for production
npm run build
```

---

## Contribution Guidelines

### Before You Start

1. **Check existing issues:** Is someone already working on this?
   - GitHub Issues: https://github.com/BlueS-3e/VerityPass-Identity-Layer/issues

2. **Discussion for major features:**
   - Open an issue first to discuss approach
   - Get feedback before writing code

3. **Create a branch:**
   ```bash
   git checkout -b feature/my-feature
   # or for bug fixes:
   git checkout -b fix/bug-description
   ```

### What We Welcome

✅ **Bug fixes** with test coverage  
✅ **Documentation improvements** (code comments, guides, examples)  
✅ **Test additions** (especially edge cases)  
✅ **Performance optimizations** with benchmarks  
✅ **Security improvements** (report sensitive issues privately first)  
✅ **New features** (discuss in issue first)

### What We Don't Accept

❌ **Unrelated refactoring** without clear benefit  
❌ **Breaking changes** without RFC discussion  
❌ **Dependencies upgrades** without justification  
❌ **Code without tests**

---

## Code Standards

### Solidity

```solidity
// Follow OpenZeppelin style guide
pragma solidity ^0.8.20;

// SPDX-License-Identifier at top
// NatSpec comments for all public functions

/// @notice Brief description
/// @param param1 Description of parameter
/// @return Description of return value
function myFunction(uint256 param1) external returns (bool) {
    // Implementation
}
```

**Tools:**
- **Linter:** Solhint (`npm run lint:contracts`)
- **Formatter:** Prettier (`npm run format:contracts`)

### Python (Flask/API)

```python
"""Module docstring explaining purpose."""

import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class MyClass:
    """Class docstring with type hints."""

    def my_method(self, param: str) -> Dict[str, any]:
        """
        Method docstring following Google style.
        
        Args:
            param: Description of parameter
            
        Returns:
            Dictionary with keys: 'key1', 'key2'
            
        Raises:
            ValueError: If param is empty
        """
        if not param:
            raise ValueError("param cannot be empty")
        return {"result": param}
```

**Tools:**
- **Formatter:** Black (`black api/`)
- **Linter:** Flake8 (`flake8 api/`)
- **Type Checker:** mypy (`mypy api/`)

### JavaScript/React

```javascript
// Use ES6+ syntax and functional components
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Brief component description
 * @param {Object} props - Component props
 * @param {string} props.title - Display title
 * @returns {JSX.Element}
 */
export const MyComponent = ({ title }) => {
  const [state, setState] = React.useState(null);

  return (
    <div className="my-component">
      <h1>{title}</h1>
      {/* Content */}
    </div>
  );
};

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
};
```

**Tools:**
- **Linter:** ESLint (`npm run lint`)
- **Formatter:** Prettier (`npm run format`)

---

## Testing

### Smart Contracts (Hardhat)

```bash
cd contracts

# Run all tests
npm test

# Run specific test file
npm test test/VerityPassLaunchpad.test.js

# Run with coverage
npm run test:coverage
```

**Writing Tests:**
```javascript
// test/MyContract.test.js
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('MyContract', () => {
  let contract;
  let owner;

  before(async () => {
    [owner] = await ethers.getSigners();
    const MyContract = await ethers.getContractFactory('MyContract');
    contract = await MyContract.deploy();
  });

  it('should do something', async () => {
    const result = await contract.myFunction();
    expect(result).to.equal(expectedValue);
  });
});
```

### Backend API (pytest)

```bash
cd api

# Run all tests
pytest

# Run specific test
pytest tests/test_metrics_exposed.py

# Run with coverage
pytest --cov=. --cov-report=html
```

**Writing Tests:**
```python
# tests/test_my_feature.py
import pytest
from api.app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_endpoint(client):
    response = client.get('/api/endpoint')
    assert response.status_code == 200
```

### Frontend (Vitest)

```bash
cd webapp

# Run all tests
npm run test

# Run specific test
npm run test MyComponent.test.jsx

# Run with coverage
npm run test:coverage
```

---

## Security

### Reporting Security Issues

⚠️ **DO NOT open public issues for security vulnerabilities!**

Instead:
1. Email: `security@veritypass.org` (TBD - use GitHub private report for now)
2. Include: vulnerability description, steps to reproduce, potential impact
3. Expected response: Within 48 hours

### Security Checklist

Before submitting:
- [ ] No secrets or API keys in code
- [ ] No hardcoded addresses (use environment variables)
- [ ] Input validation on all endpoints
- [ ] Proper error handling (no information leakage)
- [ ] Tests include edge cases and malicious inputs

---

## Pull Request Process

### 1. Before Opening PR

```bash
# Update from upstream
git fetch upstream
git rebase upstream/main

# Run all tests locally
npm test              # contracts/
pytest               # api/
npm run test         # webapp/

# Run linters
npm run lint
npm run format

# Commit with clear message
git commit -m "feat: add amazing feature

This PR adds X feature which improves Y by Z%.

- Added unit tests (100% coverage)
- Updated docs
- Tested on Sepolia testnet"

git push origin feature/my-feature
```

### 2. Open PR on GitHub

**PR Title Format:**
```
[type]: Brief description

Examples:
feat: add attestation verification
fix: resolve Oracle price feed timeout
docs: update installation guide
test: increase contract coverage to 100%
perf: optimize Merkle tree validation
```

**PR Description Template:**
```markdown
## Description
Brief explanation of changes

## Related Issue
Fixes #123 (or relates to #123)

## Changes Made
- Change 1
- Change 2

## Testing
- [ ] Unit tests added
- [ ] Integration tests passed
- [ ] Tested locally on [network]

## Screenshots (if UI change)
[Add screenshots]

## Checklist
- [ ] Code follows style guide
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] Docs updated
- [ ] No breaking changes
```

### 3. Review Process

- **Code Review:** Maintainers review within 48 hours
- **CI Checks:** All GitHub Actions must pass
- **Coverage:** New code must maintain >90% test coverage
- **Approval:** Need 1 maintainer approval (2 for security fixes)

---

## Reporting Issues

### Bug Reports

```markdown
## Description
Brief description of bug

## Steps to Reproduce
1. Go to...
2. Click...
3. Observe...

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [Linux/Mac/Windows]
- Node version: v18.x
- Python version: 3.11
- Browser: [Chrome/Firefox]

## Logs
```
[Paste relevant error logs]
```

## Additional Context
Any other information
```

### Feature Requests

```markdown
## Description
Brief description of feature

## Problem It Solves
What pain point does this address?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you thought of

## Additional Context
Any mockups, examples, or resources
```

---

## Community

### Get Help
- **Discord:** [TBD - Community chat]
- **GitHub Discussions:** [TBD]
- **Twitter:** [@VerityPassDeFi](https://twitter.com)

### Contributor Recognition

- Listed in `CONTRIBUTORS.md`
- Acknowledged in release notes
- Eligible for community contributor grants (TBD)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Questions?

- Read the [README](README.md)
- Check [FAQ](FUNDING.md#faqs)
- Open an issue for guidance

**Thank you for contributing to VerityPass!** 🚀

---

**Last Updated:** December 14, 2025
