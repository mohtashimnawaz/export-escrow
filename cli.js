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
  const match = input.match(/^(\d+(?:\.\d+)?)\s*(min|hour|day|week|month)s?$/i);
  if (!match) {
    throw new Error("Invalid format. Use: <number> <unit> (e.g., '1 day', '2 weeks', '30 min')");
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'min': return TimeHelpers.minutes(value);
    case 'hour': return TimeHelpers.hours(value);
    case 'day': return TimeHelpers.days(value);
    case 'week': return TimeHelpers.weeks(value);
    case 'month': return TimeHelpers.months(value);
    default: throw new Error("Invalid unit. Use: min, hour, day, week, month");
  }
}

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
  const proposedDeadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 1 day from now
  
  console.log("📦 Creating escrow order...");
  console.log(`💰 Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
  console.log(`📅 Proposed deadline: ${new Date(proposedDeadline * 1000).toLocaleString()}`);
  
  const escrowPda = (await getEscrowPda(order.publicKey, program.programId))[0];
  
  await program.methods.createOrder(
    exporter.publicKey,
    verifier.publicKey,
    new anchor.BN(amount),
    new anchor.BN(proposedDeadline)
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
  
  await program.methods.approveDeadline()
    .accounts({
      order: order.publicKey,
      importer: importer.publicKey,
    })
    .signers([importer])
    .rpc();
  
  console.log("✅ Deadline approved! Order is now ready for shipment.");
}

async function proposeNewDeadline(order) {
  const newDeadline = Math.floor(Date.now() / 1000) + 60 * 60 * 48; // 2 days from now
  
  console.log("📅 Proposing new deadline...");
  console.log(`🕐 New proposed deadline: ${new Date(newDeadline * 1000).toLocaleString()}`);
  
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
  const billOfLadingHash = new Array(32).fill(1); // Dummy hash
  
  await program.methods.shipGoods(billOfLadingHash)
    .accounts({
      order: order.publicKey,
      exporter: exporter.publicKey,
    })
    .signers([exporter])
    .rpc();
  
  console.log("✅ Goods shipped!");
}

async function confirmDelivery(order) {
  console.log("✅ Confirming delivery...");
  
  await program.methods.confirmDelivery()
    .accounts({
      order: order.publicKey,
      signer: verifier.publicKey,
    })
    .signers([verifier])
    .rpc();
  
  console.log("✅ Delivery confirmed!");
}

async function releaseFunds(order, escrowPda) {
  console.log("💸 Releasing funds to exporter...");
  
  const exporterBalanceBefore = await program.provider.connection.getBalance(exporter.publicKey);
  
  await program.methods.releaseFunds()
    .accounts({
      order: order.publicKey,
      escrowPda,
      exporter: exporter.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  const exporterBalanceAfter = await program.provider.connection.getBalance(exporter.publicKey);
  const received = (exporterBalanceAfter - exporterBalanceBefore) / LAMPORTS_PER_SOL;
  
  console.log(`✅ Funds released! Exporter received: ${received} SOL`);
}

async function refund(order, escrowPda) {
  console.log("🔄 Processing refund to importer...");
  
  const importerBalanceBefore = await program.provider.connection.getBalance(importer.publicKey);
  
  await program.methods.refund()
    .accounts({
      order: order.publicKey,
      escrowPda,
      importer: importer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  const importerBalanceAfter = await program.provider.connection.getBalance(importer.publicKey);
  const refunded = (importerBalanceAfter - importerBalanceBefore) / LAMPORTS_PER_SOL;
  
  console.log(`✅ Refund processed! Importer received: ${refunded} SOL`);
}

async function showBalances() {
  const importerBalance = await program.provider.connection.getBalance(importer.publicKey);
  const exporterBalance = await program.provider.connection.getBalance(exporter.publicKey);
  const verifierBalance = await program.provider.connection.getBalance(verifier.publicKey);
  
  console.log("\n💰 Current Balances:");
  console.log(`👤 Importer: ${importerBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`📦 Exporter: ${exporterBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`✅ Verifier: ${verifierBalance / LAMPORTS_PER_SOL} SOL`);
}

async function showMenu() {
  console.log("\n" + "=".repeat(50));
  console.log("🏦 ESCROW SMART CONTRACT INTERFACE");
  console.log("=".repeat(50));
  console.log("1. Airdrop SOL to importer");
  console.log("2. Create new escrow order");
  console.log("3. Approve deadline (Importer)");
  console.log("4. Propose new deadline (Exporter)");
  console.log("5. Ship goods");
  console.log("6. Confirm delivery");
  console.log("7. Release funds to exporter");
  console.log("8. Refund to importer");
  console.log("9. Show balances");
  console.log("10. Run complete escrow flow");
  console.log("11. Exit");
  console.log("=".repeat(50));
}

async function runCompleteFlow() {
  console.log("\n🔄 Running complete escrow flow...\n");
  
  // Step 1: Airdrop
  await airdropSol();
  await showBalances();
  
  // Step 2: Create order
  const { order, escrowPda } = await createOrder();
  await showBalances();
  
  // Step 3: Approve deadline
  await approveDeadline(order);
  
  // Step 4: Ship goods
  await shipGoods(order);
  
  // Step 5: Confirm delivery
  await confirmDelivery(order);
  
  // Step 6: Release funds
  await releaseFunds(order, escrowPda);
  await showBalances();
  
  console.log("\n🎉 Complete escrow flow finished successfully!");
}

async function runDeadlineNegotiationFlow() {
  console.log("\n🔄 Running deadline negotiation flow...\n");
  
  // Step 1: Airdrop
  await airdropSol();
  await showBalances();
  
  // Step 2: Create order
  const { order, escrowPda } = await createOrder();
  await showBalances();
  
  // Step 3: Exporter proposes new deadline
  await proposeNewDeadline(order);
  
  // Step 4: Importer approves new deadline
  await approveDeadline(order);
  
  // Step 5: Ship goods
  await shipGoods(order);
  
  // Step 6: Confirm delivery
  await confirmDelivery(order);
  
  // Step 7: Release funds
  await releaseFunds(order, escrowPda);
  await showBalances();
  
  console.log("\n🎉 Deadline negotiation flow finished successfully!");
}

async function main() {
  console.log("🚀 Starting Escrow Smart Contract Interface...");
  
  let order, escrowPda;
  
  while (true) {
    await showMenu();
    
    const choice = await new Promise((resolve) => {
      rl.question("Enter your choice (1-11): ", resolve);
    });
    
    try {
      switch (choice) {
        case '1':
          await airdropSol();
          break;
        case '2':
          const result = await createOrder();
          order = result.order;
          escrowPda = result.escrowPda;
          break;
        case '3':
          if (!order) {
            console.log("❌ Please create an order first (option 2)");
            break;
          }
          await approveDeadline(order);
          break;
        case '4':
          if (!order) {
            console.log("❌ Please create an order first (option 2)");
            break;
          }
          await proposeNewDeadline(order);
          break;
        case '5':
          if (!order) {
            console.log("❌ Please create an order first (option 2)");
            break;
          }
          await shipGoods(order);
          break;
        case '6':
          if (!order) {
            console.log("❌ Please create an order first (option 2)");
            break;
          }
          await confirmDelivery(order);
          break;
        case '7':
          if (!order || !escrowPda) {
            console.log("❌ Please create an order first (option 2)");
            break;
          }
          await releaseFunds(order, escrowPda);
          break;
        case '8':
          if (!order || !escrowPda) {
            console.log("❌ Please create an order first (option 2)");
            break;
          }
          await refund(order, escrowPda);
          break;
        case '9':
          await showBalances();
          break;
        case '10':
          await runCompleteFlow();
          break;
        case '11':
          console.log("👋 Goodbye!");
          rl.close();
          process.exit(0);
        default:
          console.log("❌ Invalid choice. Please try again.");
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
    }
    
    console.log("\nPress Enter to continue...");
    await new Promise((resolve) => rl.question("", resolve));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\n👋 Goodbye!");
  rl.close();
  process.exit(0);
});

main().catch(console.error); 