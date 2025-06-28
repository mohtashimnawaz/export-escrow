# Time Units for Deadlines in Escrow Smart Contract

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