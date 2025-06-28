# Time Units and Deadline Management

This document explains how deadlines work in the escrow smart contract and provides helper functions for working with time units.

## Deadline Range Constraints

The escrow contract enforces the following deadline constraints:
- **Minimum deadline**: 1 minute (60 seconds)
- **Maximum deadline**: 8 months (approximately 20,736,000 seconds)
- **Precision**: Second-level precision (Unix timestamps in seconds)

## Time Helper Functions

The contract provides helper functions for creating deadlines within the valid range:

### JavaScript/TypeScript Helpers

```javascript
const TimeHelpers = {
  minutes: (mins) => {
    const deadline = Math.floor(Date.now() / 1000) + (mins * 60);
    if (mins < 1) throw new Error("Minimum deadline is 1 minute");
    if (mins > 8 * 30 * 24 * 60) throw new Error("Maximum deadline is 8 months");
    return deadline;
  },
  hours: (hrs) => {
    const deadline = Math.floor(Date.now() / 1000) + (hrs * 60 * 60);
    if (hrs < 1/60) throw new Error("Minimum deadline is 1 minute");
    if (hrs > 8 * 30 * 24) throw new Error("Maximum deadline is 8 months");
    return deadline;
  },
  days: (days) => {
    const deadline = Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);
    if (days < 1/1440) throw new Error("Minimum deadline is 1 minute");
    if (days > 8 * 30) throw new Error("Maximum deadline is 8 months");
    return deadline;
  },
  weeks: (weeks) => {
    const deadline = Math.floor(Date.now() / 1000) + (weeks * 7 * 24 * 60 * 60);
    if (weeks < 1/10080) throw new Error("Minimum deadline is 1 minute");
    if (weeks > 8 * 30 / 7) throw new Error("Maximum deadline is 8 months");
    return deadline;
  },
  months: (months) => {
    const deadline = Math.floor(Date.now() / 1000) + (months * 30 * 24 * 60 * 60);
    if (months < 1/43200) throw new Error("Minimum deadline is 1 minute");
    if (months > 8) throw new Error("Maximum deadline is 8 months");
    return deadline;
  }
};
```

### Rust Constants (Smart Contract)

```rust
// Deadline range constants (in seconds)
const MIN_DEADLINE: i64 = 60;           // 1 minute
const MAX_DEADLINE: i64 = 8 * 30 * 24 * 60 * 60; // 8 months (approximate)
```

## Usage Examples

### Creating Deadlines

```javascript
// Valid deadlines
const oneMinute = TimeHelpers.minutes(1);
const twoHours = TimeHelpers.hours(2);
const threeDays = TimeHelpers.days(3);
const oneWeek = TimeHelpers.weeks(1);
const sixMonths = TimeHelpers.months(6);

// Invalid deadlines (will throw errors)
try {
  TimeHelpers.minutes(0.5); // Less than 1 minute
} catch (error) {
  console.log("Error:", error.message); // "Minimum deadline is 1 minute"
}

try {
  TimeHelpers.months(9); // More than 8 months
} catch (error) {
  console.log("Error:", error.message); // "Maximum deadline is 8 months"
}
```

### CLI Usage

When using the CLI, you can specify deadlines in a natural format:

```bash
# Valid formats
"30 min"     # 30 minutes
"2 hours"    # 2 hours
"1 day"      # 1 day
"2 weeks"    # 2 weeks
"3 months"   # 3 months

# Invalid formats (will be rejected)
"30 seconds" # Too short
"9 months"   # Too long
"1 year"     # Too long
```

### Creating Orders with Deadlines

```javascript
// Create an order with a 1-day deadline
const deadline = TimeHelpers.days(1);
await program.methods.createOrder(
  exporter.publicKey,
  verifier.publicKey,
  new anchor.BN(amount),
  new anchor.BN(deadline)
).accounts({
  order: order.publicKey,
  importer: importer.publicKey,
  escrowPda,
  systemProgram: SystemProgram.programId,
}).signers([importer, order]).rpc();
```

### Proposing New Deadlines

```javascript
// Propose a new deadline (2 weeks from now)
const newDeadline = TimeHelpers.weeks(2);
await program.methods.proposeNewDeadline(new anchor.BN(newDeadline))
  .accounts({
    order: order.publicKey,
    exporter: exporter.publicKey,
  })
  .signers([exporter])
  .rpc();
```

## Deadline Validation

The smart contract automatically validates all deadlines:

1. **Range Check**: Deadlines must be between 1 minute and 8 months from the current time
2. **Precision**: All deadlines are stored as Unix timestamps in seconds
3. **Real-time Validation**: Validation occurs at the time of order creation or deadline proposal

### Error Messages

- `DeadlineTooShort`: Deadline is less than 1 minute from now
- `DeadlineTooLong`: Deadline is more than 8 months from now

## Formatting Deadlines

To display deadlines in a human-readable format:

```javascript
function formatDeadline(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Usage
const deadline = TimeHelpers.days(1);
console.log(`Deadline: ${formatDeadline(deadline)}`);
// Output: "Deadline: 12/25/2024, 2:30:45 PM"
```

## Common Time Conversions

| Unit | Seconds | Examples |
|------|---------|----------|
| 1 minute | 60 | `TimeHelpers.minutes(1)` |
| 1 hour | 3,600 | `TimeHelpers.hours(1)` |
| 1 day | 86,400 | `TimeHelpers.days(1)` |
| 1 week | 604,800 | `TimeHelpers.weeks(1)` |
| 1 month | 2,592,000 | `TimeHelpers.months(1)` |
| 8 months | 20,736,000 | `TimeHelpers.months(8)` |

## Best Practices

1. **Use Helper Functions**: Always use the provided helper functions to ensure deadlines are within the valid range
2. **Handle Errors**: Wrap deadline creation in try-catch blocks to handle validation errors gracefully
3. **User-Friendly Input**: When accepting user input, provide clear examples of valid formats
4. **Display Formatting**: Use the `formatDeadline` function to show deadlines in a user-friendly format
5. **Test Edge Cases**: Always test minimum (1 minute) and maximum (8 months) deadlines in your applications

## Current Implementation

The deadline in the escrow smart contract is set using **Unix timestamp** in **seconds** since the Unix epoch (January 1, 1970, 00:00:00 UTC).

## Time Unit: **Seconds**

```javascript
// Current implementation uses seconds
const deadline = Math.floor(Date.now() / 1000) + (timeInSeconds);
```

## Common Deadline Calculations

### 1. **Minutes**
```javascript
// 30 minutes from now
const thirtyMinutes = Math.floor(Date.now() / 1000) + (30 * 60);

// 2 hours from now
const twoHours = Math.floor(Date.now() / 1000) + (2 * 60 * 60);
```

### 2. **Hours**
```javascript
// 1 hour from now
const oneHour = Math.floor(Date.now() / 1000) + (60 * 60);

// 24 hours from now
const oneDay = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
```

### 3. **Days**
```javascript
// 1 day from now
const oneDay = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

// 7 days from now
const oneWeek = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

// 30 days from now
const oneMonth = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
```

### 4. **Weeks**
```javascript
// 1 week from now
const oneWeek = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

// 2 weeks from now
const twoWeeks = Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60);
```

### 5. **Months**
```javascript
// 1 month from now (approximate)
const oneMonth = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

// 3 months from now
const threeMonths = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
```

## Helper Functions

You can create helper functions to make deadline setting more intuitive:

```javascript
// Helper functions for different time units
const TimeHelpers = {
  // Minutes
  minutes: (mins) => Math.floor(Date.now() / 1000) + (mins * 60),
  
  // Hours
  hours: (hrs) => Math.floor(Date.now() / 1000) + (hrs * 60 * 60),
  
  // Days
  days: (days) => Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60),
  
  // Weeks
  weeks: (weeks) => Math.floor(Date.now() / 1000) + (weeks * 7 * 24 * 60 * 60),
  
  // Months (approximate)
  months: (months) => Math.floor(Date.now() / 1000) + (months * 30 * 24 * 60 * 60),
  
  // Custom timestamp
  fromDate: (date) => Math.floor(date.getTime() / 1000),
  
  // From ISO string
  fromISO: (isoString) => Math.floor(new Date(isoString).getTime() / 1000)
};

// Usage examples:
const deadline1 = TimeHelpers.minutes(30);    // 30 minutes
const deadline2 = TimeHelpers.hours(2);       // 2 hours
const deadline3 = TimeHelpers.days(7);        // 1 week
const deadline4 = TimeHelpers.weeks(2);       // 2 weeks
const deadline5 = TimeHelpers.months(1);      // 1 month
```

## Examples in Smart Contract Usage

### 1. **Short-term Deadlines (Minutes/Hours)**
```javascript
// For fast delivery items
const fastDelivery = TimeHelpers.hours(2); // 2 hours

await program.methods.createOrder(
  exporter.publicKey,
  verifier.publicKey,
  new anchor.BN(amount),
  new anchor.BN(fastDelivery)
).accounts({...}).rpc();
```

### 2. **Standard Deadlines (Days)**
```javascript
// For standard shipping
const standardDelivery = TimeHelpers.days(7); // 1 week

await program.methods.createOrder(
  exporter.publicKey,
  verifier.publicKey,
  new anchor.BN(amount),
  new anchor.BN(standardDelivery)
).accounts({...}).rpc();
```

### 3. **Long-term Deadlines (Weeks/Months)**
```javascript
// For international shipping
const internationalDelivery = TimeHelpers.weeks(4); // 4 weeks

await program.methods.createOrder(
  exporter.publicKey,
  verifier.publicKey,
  new anchor.BN(amount),
  new anchor.BN(internationalDelivery)
).accounts({...}).rpc();
```

### 4. **Custom Deadlines**
```javascript
// Specific date and time
const customDate = new Date('2024-12-31T23:59:59Z');
const customDeadline = TimeHelpers.fromDate(customDate);

await program.methods.createOrder(
  exporter.publicKey,
  verifier.publicKey,
  new anchor.BN(amount),
  new anchor.BN(customDeadline)
).accounts({...}).rpc();
```

## Displaying Deadlines

To display deadlines in a human-readable format:

```javascript
function formatDeadline(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Usage
const deadline = TimeHelpers.days(7);
console.log(`Deadline: ${formatDeadline(deadline)}`);
// Output: "Deadline: 12/25/2024, 3:30:45 PM"
```

## Precision and Limitations

### **Precision:**
- ✅ **Seconds**: Full second precision
- ✅ **Minutes**: 60-second precision
- ✅ **Hours**: 3600-second precision
- ✅ **Days**: 86400-second precision

### **Limitations:**
- ❌ **Milliseconds**: Not supported (rounded to seconds)
- ❌ **Sub-seconds**: Not supported
- ❌ **Time zones**: All timestamps are UTC

### **Best Practices:**
1. **Use helper functions** for readability
2. **Consider time zones** when displaying to users
3. **Add buffer time** for network delays
4. **Use reasonable deadlines** (avoid very short or very long periods)

## Example Implementation

Here's how you could update the CLI to use helper functions:

```javascript
// Add to cli.js
const TimeHelpers = {
  minutes: (mins) => Math.floor(Date.now() / 1000) + (mins * 60),
  hours: (hrs) => Math.floor(Date.now() / 1000) + (hrs * 60 * 60),
  days: (days) => Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60),
  weeks: (weeks) => Math.floor(Date.now() / 1000) + (weeks * 7 * 24 * 60 * 60),
  months: (months) => Math.floor(Date.now() / 1000) + (months * 30 * 24 * 60 * 60)
};

// Usage in createOrder function
const proposedDeadline = TimeHelpers.days(1); // 1 day from now
```

This gives you **second-level precision** with the flexibility to set deadlines from minutes to months! 