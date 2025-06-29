const anchor = require("@coral-xyz/anchor");
const { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } = anchor.web3;
const readline = require('readline');

// Time helper functions with range validation
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

// Helper to create a PDA for escrow
async function getEscrowPda(orderKey, programId) {
  return await PublicKey.findProgramAddressSync([
    Buffer.from("escrow_pda"),
    orderKey.toBuffer(),
  ], programId);
}

// Helper to format timestamp
function formatDeadline(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

// Helper to validate deadline input
function validateDeadlineInput(input) {
  // Accept both singular and plural forms with more flexible matching
  const match = input.match(/^(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes|hour|hours|day|days|week|weeks|month|months)$/i);
  if (!match) {
    throw new Error("Invalid format. Use: <number> <unit> (e.g., '1 day', '2 weeks', '30 min', '2 minutes')");
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  // Normalize unit names
  let normalizedUnit;
  if (unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes') normalizedUnit = 'min';
  else if (unit === 'hour' || unit === 'hours') normalizedUnit = 'hour';
  else if (unit === 'day' || unit === 'days') normalizedUnit = 'day';
  else if (unit === 'week' || unit === 'weeks') normalizedUnit = 'week';
  else if (unit === 'month' || unit === 'months') normalizedUnit = 'month';
  else throw new Error("Invalid unit. Use: min/mins/minute/minutes, hour/hours, day/days, week/weeks, month/months");
  
  switch (normalizedUnit) {
    case 'min': return TimeHelpers.minutes(value);
    case 'hour': return TimeHelpers.hours(value);
    case 'day': return TimeHelpers.days(value);
    case 'week': return TimeHelpers.weeks(value);
    case 'month': return TimeHelpers.months(value);
    default: throw new Error("Invalid unit. Use: min/mins/minute/minutes, hour/hours, day/days, week/weeks, month/months");
  }
}

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Configure the client
anchor.setProvider(anchor.AnchorProvider.env());
const program = anchor.workspace.Escrow;

// Generate keypairs for demo
const importer = Keypair.generate();
const exporter = Keypair.generate();
const verifier = Keypair.generate();

async function airdropSol() {
  console.log("🪙 Airdropping SOL to importer...");
  const sig = await program.provider.connection.requestAirdrop(importer.publicKey, 2 * LAMPORTS_PER_SOL);
  await program.provider.connection.confirmTransaction(sig);
  console.log("✅ Airdrop successful!");
}

async function createOrder() {
  const order = Keypair.generate();
  const amount = 0.1 * LAMPORTS_PER_SOL;
  
  console.log("📦 Creating escrow order...");
  console.log(`💰 Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
  
  // Prompt for deadline input
  console.log("\nDeadline format examples:");
  console.log("- 30 min or 30 minutes");
  console.log("- 2 hour or 2 hours");
  console.log("- 1 day or 1 days");
  console.log("- 2 week or 2 weeks");
  console.log("- 3 month or 3 months");
  console.log("\nValid range: 1 minute to 8 months");
  
  let proposedDeadline;
  while (true) {
    try {
      const deadlineInput = await question("Enter deadline (e.g., '1 day'): ");
      proposedDeadline = validateDeadlineInput(deadlineInput);
      break;
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log("Please try again.");
    }
  }
  
  console.log(`📅 Proposed deadline: ${formatDeadline(proposedDeadline)}`);
  console.log("💡 Note: This is a proposal. The actual deadline will start from approval time.");
  
  const escrowPda = (await getEscrowPda(order.publicKey, program.programId))[0];
  const creationTime = Math.floor(Date.now() / 1000);
  
  await program.methods.createOrder(
    exporter.publicKey,
    verifier.publicKey,
    new anchor.BN(amount),
    new anchor.BN(proposedDeadline),
    new anchor.BN(creationTime)
  ).accounts({
    order: order.publicKey,
    importer: importer.publicKey,
    escrowPda,
    systemProgram: SystemProgram.programId,
  }).signers([importer, order]).rpc();
  
  console.log("✅ Order created successfully!");
  console.log(`📋 Order ID: ${order.publicKey.toString()}`);
  console.log(`🏦 Escrow PDA: ${escrowPda.toString()}`);
  console.log("⏳ Waiting for importer to approve deadline...");
  
  return { order, escrowPda };
}

async function approveDeadline(order) {
  console.log("✅ Approving proposed deadline...");
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  await program.methods.approveDeadline(new anchor.BN(currentTime))
    .accounts({
      order: order.publicKey,
      importer: importer.publicKey,
    })
    .signers([importer])
    .rpc();
  
  console.log("✅ Deadline approved! Order is now ready for shipment.");
  console.log("⏰ Deadline countdown starts from approval time.");
}

async function proposeNewDeadline(order) {
  console.log("📅 Proposing new deadline...");
  
  // Prompt for new deadline input
  console.log("\nDeadline format examples:");
  console.log("- 30 min or 30 minutes");
  console.log("- 2 hour or 2 hours");
  console.log("- 1 day or 1 days");
  console.log("- 2 week or 2 weeks");
  console.log("- 3 month or 3 months");
  console.log("\nValid range: 1 minute to 8 months");
  
  let newDeadline;
  while (true) {
    try {
      const deadlineInput = await question("Enter new deadline (e.g., '2 days'): ");
      newDeadline = validateDeadlineInput(deadlineInput);
      break;
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log("Please try again.");
    }
  }
  
  console.log(`🕐 New proposed deadline: ${formatDeadline(newDeadline)}`);
  
  await program.methods.proposeNewDeadline(new anchor.BN(newDeadline))
    .accounts({
      order: order.publicKey,
      exporter: exporter.publicKey,
    })
    .signers([exporter])
    .rpc();
  
  console.log("✅ New deadline proposed! Waiting for importer approval...");
}

async function shipGoods(order) {
  console.log("🚢 Shipping goods...");
  
  try {
    const billOfLadingHash = new Array(32).fill(1); // Dummy hash
    
    await program.methods.shipGoods(billOfLadingHash)
      .accounts({
        order: order.publicKey,
        exporter: exporter.publicKey,
      })
      .signers([exporter])
      .rpc();
    
    console.log("✅ Goods shipped!");
  } catch (error) {
    if (error.message.includes("DeadlinePassed")) {
      console.log("❌ Cannot ship goods: Deadline has passed!");
      console.log("💡 The importer should request a refund.");
    } else if (error.message.includes("InvalidState")) {
      console.log("❌ Invalid state: Order must be in PendingShipment state.");
    } else if (error.message.includes("DeadlineNotApproved")) {
      console.log("❌ Deadline not approved yet.");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function confirmDelivery(order, escrowPda) {
  console.log("✅ Confirming delivery...");
  
  try {
    await program.methods.confirmDelivery()
      .accounts({
        order: order.publicKey,
        signer: verifier.publicKey,
        escrowPda,
        exporter: exporter.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([verifier])
      .rpc();
    
    console.log("✅ Delivery confirmed and funds automatically released to exporter!");
  } catch (error) {
    if (error.message.includes("DeadlinePassed")) {
      console.log("❌ Cannot confirm delivery: Deadline has passed!");
      console.log("💡 The importer should request a refund.");
    } else if (error.message.includes("InvalidState")) {
      console.log("❌ Invalid state: Order must be in InTransit state.");
    } else if (error.message.includes("Unauthorized")) {
      console.log("❌ Unauthorized: Only verifier or importer can confirm delivery.");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function getSolanaTime() {
  const slot = await program.provider.connection.getSlot();
  const blockTime = await program.provider.connection.getBlockTime(slot);
  return blockTime;
}

async function checkDeadlineAndRefund(order, escrowPda) {
  console.log("⏰ Checking deadline and processing refund if needed...");
  
  try {
    // First, let's get the order details to debug
    const orderAccount = await program.account.order.fetch(order.publicKey);
    const localTime = Math.floor(Date.now() / 1000);
    
    console.log("🔍 Debug Information:");
    console.log(`Current time: ${formatDeadline(localTime)}`);
    console.log(`Approved deadline: ${formatDeadline(orderAccount.approvedDeadline)}`);
    console.log(`Order state: ${JSON.stringify(orderAccount.state)}`);
    console.log(`Deadline approved: ${orderAccount.deadlineApproved}`);
    console.log(`Time until deadline: ${orderAccount.approvedDeadline - localTime} seconds`);
    console.log(`Is deadline passed? ${localTime > orderAccount.approvedDeadline ? 'YES' : 'NO'}`);
    console.log(`Is state not completed? ${orderAccount.state.completed !== undefined ? 'NO (completed)' : 'YES (not completed)'}`);
    
    await program.methods.checkDeadlineAndRefund(new anchor.BN(localTime))
      .accounts({
        order: order.publicKey,
        escrowPda,
        importer: importer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Refund automatically processed to importer!");
  } catch (error) {
    if (error.message.includes("TooEarlyForRefund")) {
      console.log("⏳ Deadline has not passed yet. No refund needed.");
    } else if (error.message.includes("InvalidState")) {
      console.log("❌ Invalid state for refund. Order might be completed or in wrong state.");
    } else if (error.message.includes("DeadlineNotApproved")) {
      console.log("❌ Deadline not approved yet.");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function showBalances() {
  console.log("💰 Current Balances:");
  const importerBalance = await program.provider.connection.getBalance(importer.publicKey);
  const exporterBalance = await program.provider.connection.getBalance(exporter.publicKey);
  const verifierBalance = await program.provider.connection.getBalance(verifier.publicKey);
  
  console.log(`👤 Importer: ${importerBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`📦 Exporter: ${exporterBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`✅ Verifier: ${verifierBalance / LAMPORTS_PER_SOL} SOL`);
}

async function viewOrderDetails(order) {
  if (!order) {
    console.log("❌ No order created yet. Please create an order first.");
    return;
  }
  
  try {
    const orderAccount = await program.account.order.fetch(order.publicKey);
    const localTime = Math.floor(Date.now() / 1000);
    
    console.log("\n📋 Order Details:");
    console.log(`Order ID: ${order.publicKey.toString()}`);
    console.log(`Importer: ${orderAccount.importer.toString()}`);
    console.log(`Exporter: ${orderAccount.exporter.toString()}`);
    console.log(`Verifier: ${orderAccount.verifier.toString()}`);
    console.log(`Amount: ${orderAccount.amount / LAMPORTS_PER_SOL} SOL`);
    console.log(`State: ${JSON.stringify(orderAccount.state)}`);
    console.log(`Created at: ${formatDeadline(orderAccount.createdAt)}`);
    console.log(`Proposed deadline: ${formatDeadline(orderAccount.proposedDeadline)}`);
    console.log(`Approved deadline: ${formatDeadline(orderAccount.approvedDeadline)}`);
    console.log(`Deadline approved: ${orderAccount.deadlineApproved}`);
    console.log(`Current time: ${formatDeadline(localTime)}`);
    console.log(`Time until deadline: ${orderAccount.approvedDeadline - localTime} seconds`);
    
    if (orderAccount.approvedDeadline > 0) {
      if (localTime > orderAccount.approvedDeadline) {
        console.log("⚠️  DEADLINE HAS PASSED - Refund should be available!");
      } else {
        console.log("⏰ Deadline is still active");
      }
    }
  } catch (error) {
    console.log(`❌ Error fetching order details: ${error.message}`);
  }
}

async function showMenu() {
  console.log("\n==================================================");
  console.log("🏦 ESCROW SMART CONTRACT INTERFACE");
  console.log("==================================================");
  console.log("1. Airdrop SOL to importer");
  console.log("2. Create new escrow order");
  console.log("3. Approve deadline (Importer)");
  console.log("4. Propose new deadline (Exporter)");
  console.log("5. Ship goods");
  console.log("6. Confirm delivery (auto-releases funds)");
  console.log("7. Check deadline and refund (if needed)");
  console.log("8. View order details");
  console.log("9. Show balances");
  console.log("10. Run complete escrow flow");
  console.log("11. Exit");
  console.log("==================================================");
}

async function runCompleteFlow() {
  console.log("🔄 Running complete escrow flow...\n");
  
  await airdropSol();
  await showBalances();
  
  const { order, escrowPda } = await createOrder();
  
  // Ask if user wants to approve deadline or propose new one
  console.log("\nWhat would you like to do?");
  console.log("1. Approve the proposed deadline");
  console.log("2. Propose a new deadline");
  
  const choice = await question("Enter your choice (1-2): ");
  
  if (choice === "2") {
    await proposeNewDeadline(order);
    console.log("\nNow approving the new deadline...");
  }
  
  await approveDeadline(order);
  await shipGoods(order);
  await confirmDelivery(order, escrowPda);
  
  console.log("\n🎉 Complete escrow flow finished!");
  console.log("💡 Funds were automatically released to exporter upon delivery confirmation!");
  await showBalances();
}

async function main() {
  console.log("🚀 Starting Escrow Smart Contract Interface...");
  
  let currentOrder = null;
  let currentEscrowPda = null;
  
  while (true) {
    await showMenu();
    const choice = await question("Enter your choice (1-11): ");
    
    try {
      switch (choice) {
        case "1":
          await airdropSol();
          break;
        case "2":
          const result = await createOrder();
          currentOrder = result.order;
          currentEscrowPda = result.escrowPda;
          break;
        case "3":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await approveDeadline(currentOrder);
          break;
        case "4":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await proposeNewDeadline(currentOrder);
          break;
        case "5":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await shipGoods(currentOrder);
          break;
        case "6":
          if (!currentOrder || !currentEscrowPda) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await confirmDelivery(currentOrder, currentEscrowPda);
          break;
        case "7":
          if (!currentOrder || !currentEscrowPda) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await checkDeadlineAndRefund(currentOrder, currentEscrowPda);
          break;
        case "8":
          await viewOrderDetails(currentOrder);
          break;
        case "9":
          await showBalances();
          break;
        case "10":
          await runCompleteFlow();
          break;
        case "11":
          console.log("👋 Goodbye!");
          rl.close();
          return;
        default:
          console.log("❌ Invalid choice. Please try again.");
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log("\n" + "=".repeat(50) + "\n");
  }
}

main().catch(console.error);