# Escrow Smart Contract - Deadline Negotiation System

## Overview

The escrow smart contract now includes a deadline negotiation system where the exporter proposes a delivery deadline and the importer must approve it before the order can proceed. This ensures both parties agree on the delivery timeline.

## New Workflow

### 1. **Order Creation** 📦
- **Actor**: Importer
- **Action**: Creates order with initial proposed deadline
- **State**: `PendingDeadlineApproval`
- **Funds**: SOL is transferred to escrow PDA

### 2. **Deadline Approval** ✅
- **Actor**: Importer
- **Action**: Approves the proposed deadline
- **State**: `PendingShipment`
- **Result**: Order is ready for shipment

### 3. **Deadline Rejection & Re-proposal** 🔄
- **Actor**: Exporter
- **Action**: Proposes a new deadline if importer doesn't approve
- **State**: Remains `PendingDeadlineApproval`
- **Process**: Can repeat until importer approves

### 4. **Shipment & Delivery** 🚢
- **Actor**: Exporter → Verifier
- **Action**: Ship goods → Confirm delivery
- **State**: `InTransit` → `Delivered`

### 5. **Fund Release** 💸
- **Actor**: Anyone
- **Action**: Release funds to exporter
- **State**: `Completed`

## Smart Contract Functions

### New Functions

#### `approve_deadline`
```rust
pub fn approve_deadline(ctx: Context<ApproveDeadline>) -> Result<()>
```
- **Purpose**: Importer approves the proposed deadline
- **Requirements**: 
  - Order state must be `PendingDeadlineApproval`
  - Only importer can call this function
- **Result**: 
  - Sets `approved_deadline` to `proposed_deadline`
  - Sets `deadline_approved` to `true`
  - Changes state to `PendingShipment`

#### `propose_new_deadline`
```rust
pub fn propose_new_deadline(ctx: Context<ProposeNewDeadline>, new_deadline: i64) -> Result<()>
```
- **Purpose**: Exporter proposes a new deadline
- **Requirements**:
  - Order state must be `PendingDeadlineApproval`
  - Only exporter can call this function
- **Result**:
  - Updates `proposed_deadline`
  - Resets `deadline_approved` to `false`

### Updated Functions

#### `create_order`
- Now creates order with `PendingDeadlineApproval` state
- Sets `proposed_deadline` instead of `delivery_deadline`
- Initializes `deadline_approved` as `false`

#### `ship_goods`
- Now requires `deadline_approved` to be `true`
- Only works after importer approves deadline

#### `refund`
- Now uses `approved_deadline` instead of `delivery_deadline`
- Requires `deadline_approved` to be `true`

## Data Structure Changes

### Order Account
```rust
pub struct Order {
    pub importer: Pubkey,
    pub exporter: Pubkey,
    pub verifier: Pubkey,
    pub amount: u64,
    pub state: OrderState,
    pub created_at: i64,
    pub proposed_deadline: i64,  // NEW: Deadline proposed by exporter
    pub approved_deadline: i64,  // NEW: Final deadline after approval
    pub deadline_approved: bool, // NEW: Approval status
    pub bill_of_lading_hash: [u8; 32],
}
```

### OrderState Enum
```rust
pub enum OrderState {
    PendingDeadlineApproval,  // NEW: Waiting for importer approval
    PendingShipment,          // UPDATED: Deadline approved, ready for shipment
    InTransit,
    Delivered,
    Completed,
    Refunded,
    Disputed,
}
```

### New Error Types
```rust
pub enum EscrowError {
    InvalidState,
    Unauthorized,
    TooEarlyForRefund,
    DeadlineNotApproved,  // NEW: When trying to ship without approved deadline
}
```

## Usage Examples

### Basic Flow
```javascript
// 1. Create order
await program.methods.createOrder(exporter, verifier, amount, proposedDeadline)
  .accounts({...})
  .signers([...])
  .rpc();

// 2. Approve deadline
await program.methods.approveDeadline()
  .accounts({
    order: order.publicKey,
    importer: importer.publicKey,
  })
  .signers([importer])
  .rpc();

// 3. Ship goods (now allowed)
await program.methods.shipGoods(billOfLadingHash)
  .accounts({...})
  .signers([...])
  .rpc();
```

### Negotiation Flow
```javascript
// 1. Create order
await program.methods.createOrder(exporter, verifier, amount, initialDeadline)
  .accounts({...})
  .signers([...])
  .rpc();

// 2. Exporter proposes new deadline
await program.methods.proposeNewDeadline(new anchor.BN(newDeadline))
  .accounts({
    order: order.publicKey,
    exporter: exporter.publicKey,
  })
  .signers([exporter])
  .rpc();

// 3. Importer approves new deadline
await program.methods.approveDeadline()
  .accounts({
    order: order.publicKey,
    importer: importer.publicKey,
  })
  .signers([importer])
  .rpc();
```

## CLI Interface

The CLI now includes new options:
- **Option 3**: Approve deadline (Importer)
- **Option 4**: Propose new deadline (Exporter)

## Benefits

1. **Mutual Agreement**: Both parties must agree on delivery timeline
2. **Flexibility**: Exporter can propose new deadlines if needed
3. **Transparency**: Clear state management for deadline approval
4. **Security**: Prevents shipment without agreed deadline
5. **Automation**: Smart contract enforces deadline compliance

## Testing

All tests pass including:
- ✅ Basic escrow flow with deadline approval
- ✅ Deadline negotiation flow
- ✅ Error handling for unapproved deadlines
- ✅ State transitions
- ✅ Fund transfers

The system ensures that no goods can be shipped and no refunds can be processed until the importer has approved a delivery deadline, creating a fair and transparent escrow process. 