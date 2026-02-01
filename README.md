# Avalanche Launchpad - Arena-Style Fair Token Launch Platform

A next-generation token launchpad on Avalanche inspired by Arena's model, enabling creators to launch tokens for as low as **$1** with Easy or Pro launch modes.

## Features

### Core Features
- **Ultra-low cost**: Launch tokens for ~$1 (0.02 AVAX)
- **No-code interface**: Create tokens in under 60 seconds
- **Fair launch model**: No presales, no team allocations (Easy mode)
- **Bonding curve pricing**: Automatic price discovery
- **Anti-rug protection**: Automatic liquidity locking
- **Creator rewards**: Earn 0.2% of all trading volume

### Arena-Style Features
- **Creator Profiles**: Required profile with handle, avatar, bio
- **Easy Launch**: Simple token creation with immediate public trading
- **Pro Launch**: Advanced features with whitelist/blacklist/presale phases
- **Creator Initial Buy**: Slider to select initial buy percentage (0-20%)
- **Live Activity Feed**: Real-time trades, launches, and whale alerts
- **Graduated Tokens**: Track tokens that passed the bonding curve

## Launch Modes

### Easy Launch
Simple and fast token creation:
1. Token image
2. Token name
3. Token ticker
4. Creator handle
5. Initial buy percentage (slider: 0-20% of supply)

Token is immediately available for public trading.

### Pro Launch
Advanced launch with more control:
1. All Easy Launch fields
2. **Whitelist**: Add wallets that can trade during presale
3. **Blacklist**: Block specific wallets from trading
4. **Timeframe**: Set whitelist phase duration before public trading

```
Pro Launch Timeline:
├── Trading Start Time (optional delay)
├── Whitelist Phase (1 hour - 7 days)
└── Public Phase (open to everyone)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LaunchpadRouterV2                             │
│    (Easy/Pro Launch • Buy/Sell • Activity Tracking)             │
└─────────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────┬───────────┼───────────┬─────────────┐
    ▼             ▼           ▼           ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐
│ Factory │ │   Fee   │ │Liquidity│ │ Creator │ │  Activity   │
│   V2    │ │ Manager │ │ Manager │ │Registry │ │  Tracker    │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘
    │                         │
    ▼                         ▼
┌─────────────────┐    ┌─────────────┐
│ LaunchpadTokenV2│    │  Liquidity  │
│ (Whitelist/     │    │   Locker    │
│  Blacklist)     │    └─────────────┘
├─────────────────┤
│ BondingCurveV2  │
│ (Creator Buy)   │
└─────────────────┘
```

## Smart Contracts

### Core Contracts (V2)

| Contract | Description |
|----------|-------------|
| `LaunchpadTokenV2` | ERC20 with whitelist/blacklist, trading phases |
| `BondingCurveV2` | Linear curve with creator initial buy support |
| `LaunchpadFactoryV2` | Factory for Easy/Pro launches |
| `LaunchpadRouterV2` | Main entry point with activity tracking |
| `FeeManager` | Collects and distributes fees |
| `LiquidityManager` | TraderJoe DEX integration |
| `LiquidityLocker` | 1-year LP token locks |

### Platform Contracts

| Contract | Description |
|----------|-------------|
| `CreatorRegistry` | User profiles with handles, avatars, stats |
| `ActivityTracker` | Live feed of trades, launches, graduations |

## Token Economics

```
Total Supply: 1,000,000,000 (1 Billion)
├── Bonding Curve Pool: 800,000,000 (80%)
├── Liquidity Reserve: 200,000,000 (20%)
└── Team/Presale: 0 (0%) - TRUE FAIR LAUNCH

Graduation Threshold: $69,000 Market Cap
└── Auto-migrates to TraderJoe DEX with 1-year locked liquidity
```

## Fee Structure

| Fee Type | Amount | Distribution |
|----------|--------|--------------|
| Token Creation | 0.02 AVAX (~$1) | Platform Treasury |
| Trading Fee | 1% | Platform (0.8%) + Creator (0.2%) |
| Graduation Fee | 1.5% | Platform Treasury |

## Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd launchpad

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts
forge install OpenZeppelin/openzeppelin-contracts-upgradeable
forge install foundry-rs/forge-std

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Gas report
forge test --gas-report
```

### Deploy

```bash
# Deploy V2 to Fuji Testnet
forge script scripts/DeployV2.s.sol --rpc-url fuji --broadcast

# Deploy V2 to Mainnet
forge script scripts/DeployV2.s.sol --rpc-url avalanche --broadcast --verify
```

## Usage Examples

### 1. Register Creator Profile

```solidity
// Must register before launching tokens
creatorRegistry.createProfile(
    "my_handle",           // Unique handle
    "My Display Name",     // Display name
    "https://..../avatar", // Avatar URI
    "Building cool stuff"  // Bio
);
```

### 2. Easy Launch (Simple)

```solidity
// Launch token with 5% initial buy
(address token, address curve) = router.createTokenEasy{value: 0.5 ether}(
    "My Token",                    // name
    "MTK",                         // symbol
    "https://..../image.png",      // imageURI
    "An awesome token",            // description
    500                            // 5% initial buy (500 bps)
);
```

### 3. Pro Launch (Advanced)

```solidity
// Whitelist addresses
address[] memory whitelist = new address[](2);
whitelist[0] = 0x...;
whitelist[1] = 0x...;

// Launch with 24-hour whitelist phase
(address token, address curve) = router.createTokenPro{value: 0.5 ether}(
    "Pro Token",                   // name
    "PRO",                         // symbol
    "https://..../image.png",      // imageURI
    "A pro token with presale",    // description
    1000,                          // 10% initial buy
    whitelist,                     // whitelist addresses
    86400,                         // 24 hours whitelist duration
    0                              // start immediately
);
```

### 4. Buy Tokens

```solidity
router.buy{value: 1 ether}(
    LaunchpadRouterV2.SwapParams({
        token: tokenAddress,
        amountIn: 1 ether,
        minAmountOut: 0,           // Set slippage protection
        recipient: msg.sender,
        deadline: block.timestamp + 1 hours
    })
);
```

### 5. Sell Tokens

```solidity
IERC20(token).approve(address(router), amount);

router.sell(
    LaunchpadRouterV2.SwapParams({
        token: tokenAddress,
        amountIn: amount,
        minAmountOut: 0,           // Set slippage protection
        recipient: msg.sender,
        deadline: block.timestamp + 1 hours
    })
);
```

## Security Features

### Anti-Bot Protection
- 30-second cooldown between trades
- 1% max transaction size
- 2% max wallet size
- 5-minute launch protection with stricter limits

### Anti-Rug Protection
- No presales or team allocations (Easy mode)
- Creators must buy from bonding curve
- Automatic 1-year liquidity lock on graduation
- All transactions on-chain and transparent
- Blacklist capability (Pro mode) for bad actors

### Whitelist/Blacklist (Pro Mode)
- Creator can whitelist addresses for presale
- Creator can blacklist addresses from trading
- Trading phases enforced at token contract level

### Smart Contract Security
- OpenZeppelin standards
- Reentrancy guards
- Access control
- Pausable functionality
- EIP-1167 minimal proxies for gas efficiency
- Professional audit recommended before mainnet

## Activity Tracking

The platform tracks all activities for the live feed:

| Activity Type | Description |
|---------------|-------------|
| TokenLaunched | New token created |
| TokenBought | Token purchase |
| TokenSold | Token sale |
| TokenGraduated | Token passed bonding curve |
| WhaleBuy | Large purchase (>10 AVAX or >1% supply) |
| WhaleSell | Large sale (>10 AVAX or >1% supply) |
| CreatorRegistered | New creator profile |

## Network Configuration

### Avalanche Mainnet
- Chain ID: 43114
- RPC: https://api.avax.network/ext/bc/C/rpc
- TraderJoe Router: `0x60aE616a2155Ee3d9A68541Ba4544862310933d4`

### Fuji Testnet
- Chain ID: 43113
- RPC: https://api.avax-test.network/ext/bc/C/rpc
- TraderJoe Router: `0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901`

## Project Structure

```
launchpad/
├── contracts/
│   ├── core/
│   │   ├── LaunchpadTokenV2.sol    # Token with whitelist/blacklist
│   │   ├── BondingCurveV2.sol      # Curve with creator buy
│   │   ├── LaunchpadFactoryV2.sol  # Easy/Pro launch factory
│   │   ├── CreatorRegistry.sol     # User profiles
│   │   ├── ActivityTracker.sol     # Live feed events
│   │   ├── FeeManager.sol          # Fee collection
│   │   ├── LiquidityManager.sol    # DEX integration
│   │   └── LiquidityLocker.sol     # LP locking
│   ├── router/
│   │   └── LaunchpadRouterV2.sol   # Main entry point
│   ├── interfaces/
│   ├── libraries/
│   └── security/
├── scripts/
│   ├── DeployV2.s.sol              # V2 deployment
│   └── CreateToken.s.sol           # Token creation helper
├── test/
├── foundry.toml
└── README.md
```

## Development Roadmap

- [x] Core smart contracts (V1)
- [x] Bonding curve implementation
- [x] Anti-bot protection
- [x] Liquidity locking
- [x] Fee management
- [x] Creator profiles (Arena-style)
- [x] Easy/Pro launch modes
- [x] Whitelist/Blacklist
- [x] Creator initial buy
- [x] Activity tracking
- [ ] Frontend development
- [ ] Testnet deployment
- [ ] Security audit
- [ ] Mainnet launch

## License

MIT

## Disclaimer

This software is provided as-is. Users should conduct their own research and understand the risks involved in cryptocurrency investments. Always audit smart contracts before deploying to mainnet.
