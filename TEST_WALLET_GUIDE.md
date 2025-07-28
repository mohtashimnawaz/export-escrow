# Test Wallet Guide for Escrow System

## Overview
I've created test keypairs for all three roles and updated the sample data to use these real addresses. Now you can test the complete escrow workflow!

## Test Accounts Created

### 🏢 **Importer** (Can approve deadlines and confirm delivery)
- **Address**: `Hzy81inT9z7YaKBkDxG58DYwGksoJNPQEr6REcFGHXkN`
- **Seed Phrase**: `nature ripple unknown profit weekend gift forward helmet obvious video pear surge`
- **Balance**: 100 SOL
- **Keypair File**: `./test-wallets/importer.json`

### 🚚 **Exporter** (Can ship goods and request extensions)
- **Address**: `Dbz2Y1yPtaJ6LiLtLujXoFokrnfGWoJYNREpdAcmrX7T`
- **Seed Phrase**: `title nuclear gallery clock noble coyote basket today debris shadow smart pattern`
- **Balance**: 100 SOL
- **Keypair File**: `./test-wallets/exporter.json`

### 🛡️ **Verifier** (Can confirm delivery and resolve disputes)
- **Address**: `HQo4Gy3XWnn4ZZYP6HEf5WnL3b8EEmL6mVP1ywekgQXK`
- **Seed Phrase**: `welcome warrior three pilot choose breeze stool filter duck approve conduct found`
- **Balance**: 100 SOL
- **Keypair File**: `./test-wallets/verifier.json`

## How to Connect and Test

### Method 1: Import Seed Phrase into Phantom Wallet

1. **Open Phantom Wallet** in your browser
2. **Click the wallet switcher** (top right of Phantom)
3. **Click "Add/Connect Wallet"**
4. **Select "Import Private Key"**
5. **Enter one of the seed phrases above**
6. **Switch to this wallet**
7. **Refresh the escrow app** (`localhost:3000`)

### Method 2: Use Solana CLI with Keypairs

```bash
# Set CLI to use importer wallet
solana config set --keypair ./test-wallets/importer.json

# Check balance
solana balance

# Set CLI to use exporter wallet  
solana config set --keypair ./test-wallets/exporter.json

# Set CLI to use verifier wallet
solana config set --keypair ./test-wallets/verifier.json
```

## Testing Scenarios

### 🧪 **Scenario 1: Confirm Delivery (Main Test)**
- **Order**: "Electronics Components Import" 
- **Current State**: `InTransit`
- **Connect as**: Importer (`Hzy81...`) OR Verifier (`HQo4...`)
- **Action Available**: "Confirm Delivery" button
- **Result**: Order completes, 25.5 SOL released to exporter

### 🧪 **Scenario 2: Ship Goods**
- **Order**: "Textile Goods Export"
- **Current State**: `PendingShipment` 
- **Connect as**: Exporter (`Hzy81...`)
- **Action Available**: "Ship Goods" button
- **Result**: Order moves to `InTransit`

### 🧪 **Scenario 3: Role Testing**
- Try connecting with different addresses
- See how available actions change based on your role
- Test the "No actions available for your role" message

## Quick Start for Confirm Delivery Test

1. **Import this seed phrase into Phantom**:
   ```
   nature ripple unknown profit weekend gift forward helmet obvious video pear surge
   ```

2. **Refresh the escrow app**

3. **Click on "Electronics Components Import"**

4. **You should see "Confirm Delivery" button** (green)

5. **Click it and follow the modal to complete the transaction**

## Notes
- All accounts have 100 SOL for testing
- Solana test validator must be running (`solana-test-validator --reset`)
- Escrow app must be running (`npm run dev`)
- Network should be set to localhost in your wallet

## Troubleshooting
- If "No actions available", double-check you're connected with the right address
- If transaction fails, ensure test validator is running
- If balance shows 0, run the airdrop commands again
- Refresh the page after switching wallets
