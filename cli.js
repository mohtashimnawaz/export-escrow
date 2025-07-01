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

// Helper to create metadata
function createMetadata(title, description, tags, category) {
  return {
    title: title || "Default Order",
    description: description || "Escrow order for goods/services",
    tags: tags || ["escrow", "trade"],
    category: category || "general"
  };
}

// Helper to validate metadata
function validateMetadata(metadata) {
  if (metadata.title.length > 50) throw new Error("Title too long (max 50 characters)");
  if (metadata.description.length > 200) throw new Error("Description too long (max 200 characters)");
  if (metadata.category.length > 30) throw new Error("Category too long (max 30 characters)");
  if (metadata.tags.length > 5) throw new Error("Too many tags (max 5)");
  for (let tag of metadata.tags) {
    if (tag.length > 20) throw new Error(`Tag too long: ${tag} (max 20 characters)`);
  }
}

async function createOrder() {
  const order = Keypair.generate();
  let amount = 0.1 * LAMPORTS_PER_SOL;

  // Prompt for payment type
  let paymentType;
  while (true) {
    const type = (await question("Payment type (SOL/SPL): ")).trim().toUpperCase();
    if (type === "SOL" || type === "SPL") {
      paymentType = type;
      break;
    } else {
      console.log("❌ Invalid payment type. Enter 'SOL' or 'SPL'.");
    }
  }

  let tokenMint = null;
  let importerTokenAccount = null;
  let escrowTokenAccount = null;
  if (paymentType === "SPL") {
    // Prompt for SPL token mint
    const mintStr = await question("Enter SPL token mint address: ");
    tokenMint = new PublicKey(mintStr.trim());
    // Prompt for importer token account
    const importerTokenStr = await question("Enter importer's token account address: ");
    importerTokenAccount = new PublicKey(importerTokenStr.trim());
    // Prompt for escrow token account
    const escrowTokenStr = await question("Enter escrow's token account address: ");
    escrowTokenAccount = new PublicKey(escrowTokenStr.trim());
    // Prompt for amount in tokens
    const amountStr = await question("Enter amount (in tokens, not decimals): ");
    amount = parseInt(amountStr.trim());
    if (isNaN(amount) || amount <= 0) {
      console.log("❌ Invalid amount.");
      return null;
    }
  }

  console.log("📦 Creating escrow order...");
  if (paymentType === "SOL") {
    console.log(`💰 Amount: ${amount / LAMPORTS_PER_SOL} SOL`);
  } else {
    console.log(`💰 Amount: ${amount} tokens (mint: ${tokenMint.toString()})`);
  }
  
  // Get metadata from user
  console.log("\n📝 Order Metadata:");
  const title = await question("Order title (max 50 chars, or press Enter for default): ") || "Default Order";
  const description = await question("Order description (max 200 chars, or press Enter for default): ") || "Escrow order for goods/services";
  const category = await question("Category (max 30 chars, or press Enter for 'general'): ") || "general";
  
  console.log("Tags (comma-separated, max 5 tags, each max 20 chars):");
  const tagsInput = await question("Enter tags (or press Enter for default): ") || "escrow,trade";
  const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  
  const metadata = createMetadata(title, description, tags, category);
  
  try {
    validateMetadata(metadata);
  } catch (error) {
    console.log(`❌ Metadata validation error: ${error.message}`);
    return null;
  }
  
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
  
  const method = program.methods.createOrder(
    exporter.publicKey,
    verifier.publicKey,
    new anchor.BN(amount),
    new anchor.BN(proposedDeadline),
    new anchor.BN(creationTime),
    metadata,
    tokenMint ? tokenMint : null
  );
  let accounts = {
    order: order.publicKey,
    importer: importer.publicKey,
    escrowPda,
    systemProgram: SystemProgram.programId,
  };
  if (paymentType === "SPL") {
    accounts = {
      ...accounts,
      importerTokenAccount,
      escrowTokenAccount,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
    };
  }
  await method.accounts(accounts).signers([importer, order]).rpc();
  
  console.log("✅ Order created successfully!");
  console.log(`📋 Order ID: ${order.publicKey.toString()}`);
  console.log(`🏦 Escrow PDA: ${escrowPda.toString()}`);
  console.log(`📝 Title: ${metadata.title}`);
  console.log(`📄 Description: ${metadata.description}`);
  console.log(`🏷️ Tags: ${metadata.tags.join(', ')}`);
  console.log(`📂 Category: ${metadata.category}`);
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
  // Prompt for payment type
  let paymentType;
  while (true) {
    const type = (await question("Payment type for delivery (SOL/SPL): ")).trim().toUpperCase();
    if (type === "SOL" || type === "SPL") {
      paymentType = type;
      break;
    } else {
      console.log("❌ Invalid payment type. Enter 'SOL' or 'SPL'.");
    }
  }
  let escrowTokenAccount = null;
  let exporterTokenAccount = null;
  if (paymentType === "SPL") {
    const escrowTokenStr = await question("Enter escrow's token account address: ");
    escrowTokenAccount = new PublicKey(escrowTokenStr.trim());
    const exporterTokenStr = await question("Enter exporter's token account address: ");
    exporterTokenAccount = new PublicKey(exporterTokenStr.trim());
  }
  try {
    const method = program.methods.confirmDelivery();
    const accounts = {
      order: order.publicKey,
      signer: verifier.publicKey,
      escrowPda,
      exporter: exporter.publicKey,
      systemProgram: SystemProgram.programId,
    };
    if (paymentType === "SPL") {
      accounts.escrowTokenAccount = escrowTokenAccount;
      accounts.exporterTokenAccount = exporterTokenAccount;
      accounts.tokenProgram = anchor.utils.token.TOKEN_PROGRAM_ID;
    }
    await method.accounts(accounts).signers([verifier]).rpc();
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
  // Prompt for payment type
  let paymentType;
  while (true) {
    const type = (await question("Payment type for refund (SOL/SPL): ")).trim().toUpperCase();
    if (type === "SOL" || type === "SPL") {
      paymentType = type;
      break;
    } else {
      console.log("❌ Invalid payment type. Enter 'SOL' or 'SPL'.");
    }
  }
  let escrowTokenAccount = null;
  let importerTokenAccount = null;
  if (paymentType === "SPL") {
    const escrowTokenStr = await question("Enter escrow's token account address: ");
    escrowTokenAccount = new PublicKey(escrowTokenStr.trim());
    const importerTokenStr = await question("Enter importer's token account address: ");
    importerTokenAccount = new PublicKey(importerTokenStr.trim());
  }
  try {
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
    
    const method = program.methods.checkDeadlineAndRefund(new anchor.BN(localTime));
    const accounts = {
      order: order.publicKey,
      escrowPda,
      importer: importer.publicKey,
      systemProgram: SystemProgram.programId,
    };
    if (paymentType === "SPL") {
      accounts.escrowTokenAccount = escrowTokenAccount;
      accounts.importerTokenAccount = importerTokenAccount;
      accounts.tokenProgram = anchor.utils.token.TOKEN_PROGRAM_ID;
    }
    await method.accounts(accounts).rpc();
    
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
  // Optionally, prompt for SPL token accounts to show token balances
  const showTokens = (await question("Show SPL token balances? (y/n): ")).trim().toLowerCase();
  if (showTokens === 'y') {
    const tokenAccountStr = await question("Enter SPL token account address to check: ");
    const tokenAccount = new PublicKey(tokenAccountStr.trim());
    try {
      const tokenAccInfo = await program.provider.connection.getParsedAccountInfo(tokenAccount);
      const amount = tokenAccInfo.value.data.parsed.info.tokenAmount.uiAmount;
      console.log(`💎 SPL Token Account ${tokenAccount.toString()}: ${amount}`);
    } catch (e) {
      console.log("❌ Could not fetch SPL token account balance.");
    }
  }
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
    // Show payment type
    if (orderAccount.tokenMint === null || orderAccount.tokenMint === undefined) {
      console.log(`Payment Type: SOL`);
      console.log(`Amount: ${orderAccount.amount / LAMPORTS_PER_SOL} SOL`);
    } else {
      console.log(`Payment Type: SPL Token`);
      console.log(`Token Mint: ${orderAccount.tokenMint.toString()}`);
      console.log(`Amount: ${orderAccount.amount} tokens`);
    }
    console.log(`Released: ${orderAccount.releasedAmount || 0}`);
    console.log(`Refunded: ${orderAccount.refundedAmount || 0}`);
    console.log(`State: ${JSON.stringify(orderAccount.state)}`);
    console.log(`Created at: ${formatDeadline(orderAccount.createdAt)}`);
    console.log(`Proposed deadline: ${formatDeadline(orderAccount.proposedDeadline)}`);
    console.log(`Approved deadline: ${formatDeadline(orderAccount.approvedDeadline)}`);
    console.log(`Deadline approved: ${orderAccount.deadlineApproved}`);
    console.log(`Extension requested: ${orderAccount.extensionRequested}`);
    if (orderAccount.extensionRequested) {
      console.log(`Extension deadline: ${formatDeadline(orderAccount.extensionDeadline)}`);
    }
    console.log(`Current time: ${formatDeadline(localTime)}`);
    console.log(`Time until deadline: ${orderAccount.approvedDeadline - localTime} seconds`);
    
    if (orderAccount.approvedDeadline > 0) {
      if (localTime > orderAccount.approvedDeadline) {
        console.log("⚠️  DEADLINE HAS PASSED - Refund should be available!");
      } else {
        console.log("⏰ Deadline is still active");
      }
    }
    
    // Show extension status
    if (orderAccount.extensionRequested) {
      console.log("🔄 Extension request pending approval");
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
  console.log("10. Request deadline extension (Exporter)");
  console.log("11. Approve deadline extension (Importer)");
  console.log("12. Reject deadline extension (Importer)");
  console.log("13. Run complete escrow flow");
  console.log("--- Enhanced Order Management ---");
  console.log("14. Update order metadata");
  console.log("15. View order history");
  console.log("16. Dispute order");
  console.log("17. Resolve dispute (Verifier)");
  console.log("18. Search orders (Demo)");
  console.log("19. Bulk operations (Demo)");
  console.log("20. Exit");
  console.log("21. Partial release funds to exporter");
  console.log("22. Partial refund to importer");
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

async function requestDeadlineExtension(order) {
  console.log("⏰ Requesting deadline extension...");
  
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
  
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    
    await program.methods.requestDeadlineExtension(new anchor.BN(newDeadline), new anchor.BN(currentTime))
      .accounts({
        order: order.publicKey,
        exporter: exporter.publicKey,
      })
      .signers([exporter])
      .rpc();
    
    console.log(`✅ Extension requested! New deadline: ${formatDeadline(newDeadline)}`);
    console.log("⏳ Waiting for importer to approve extension...");
  } catch (error) {
    if (error.message.includes("ExtensionAlreadyRequested")) {
      console.log("❌ Extension already requested. Wait for importer response.");
    } else if (error.message.includes("DeadlinePassed")) {
      console.log("❌ Cannot request extension: Current deadline has passed.");
    } else if (error.message.includes("InvalidState")) {
      console.log("❌ Invalid state: Order must be in PendingShipment or InTransit state.");
    } else if (error.message.includes("DeadlineTooShort")) {
      console.log("❌ New deadline must be after current approved deadline.");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function approveDeadlineExtension(order) {
  console.log("✅ Approving deadline extension...");
  
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    
    await program.methods.approveDeadlineExtension(new anchor.BN(currentTime))
      .accounts({
        order: order.publicKey,
        importer: importer.publicKey,
      })
      .signers([importer])
      .rpc();
    
    console.log("✅ Deadline extension approved!");
  } catch (error) {
    if (error.message.includes("ExtensionRequestNotFound")) {
      console.log("❌ No extension request found.");
    } else if (error.message.includes("InvalidState")) {
      console.log("❌ Invalid state: Order must be in PendingExtensionApproval state.");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function rejectDeadlineExtension(order) {
  console.log("❌ Rejecting deadline extension...");
  
  try {
    await program.methods.rejectDeadlineExtension()
      .accounts({
        order: order.publicKey,
        importer: importer.publicKey,
      })
      .signers([importer])
      .rpc();
    
    console.log("❌ Deadline extension rejected!");
  } catch (error) {
    if (error.message.includes("ExtensionRequestNotFound")) {
      console.log("❌ No extension request found.");
    } else if (error.message.includes("InvalidState")) {
      console.log("❌ Invalid state: Order must be in PendingExtensionApproval state.");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Enhanced Order Management Functions
async function updateOrderMetadata(order) {
  console.log("📝 Updating order metadata...");
  
  // Get new metadata from user
  console.log("\n📝 New Order Metadata:");
  const title = await question("New title (max 50 chars, or press Enter to skip): ");
  const description = await question("New description (max 200 chars, or press Enter to skip): ");
  const category = await question("New category (max 30 chars, or press Enter to skip): ");
  
  console.log("New tags (comma-separated, max 5 tags, each max 20 chars):");
  const tagsInput = await question("Enter new tags (or press Enter to skip): ");
  
  // Get current order data to preserve unchanged fields
  const orderData = await program.account.order.fetch(order.publicKey);
  const currentMetadata = orderData.metadata;
  
  const newMetadata = {
    title: title || currentMetadata.title,
    description: description || currentMetadata.description,
    category: category || currentMetadata.category,
    tags: tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : currentMetadata.tags
  };
  
  try {
    validateMetadata(newMetadata);
  } catch (error) {
    console.log(`❌ Metadata validation error: ${error.message}`);
    return;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  await program.methods.updateOrderMetadata(newMetadata, new anchor.BN(currentTime))
    .accounts({
      order: order.publicKey,
      signer: importer.publicKey, // Using importer as signer
    })
    .signers([importer])
    .rpc();
  
  console.log("✅ Order metadata updated successfully!");
}

async function disputeOrder(order) {
  console.log("⚠️ Disputing order...");
  
  const reason = await question("Enter dispute reason (max 80 chars): ");
  if (reason.length > 80) {
    console.log("❌ Reason too long (max 80 characters)");
    return;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  await program.methods.disputeOrder(reason, new anchor.BN(currentTime))
    .accounts({
      order: order.publicKey,
      signer: importer.publicKey, // Using importer as signer
    })
    .signers([importer])
    .rpc();
  
  console.log("✅ Order disputed successfully!");
  console.log(`📝 Reason: ${reason}`);
}

async function resolveDispute(order) {
  console.log("🔧 Resolving dispute...");
  
  const resolution = await question("Enter resolution details (max 80 chars): ");
  if (resolution.length > 80) {
    console.log("❌ Resolution too long (max 80 characters)");
    return;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  await program.methods.resolveDispute(resolution, new anchor.BN(currentTime))
    .accounts({
      order: order.publicKey,
      verifier: verifier.publicKey,
    })
    .signers([verifier])
    .rpc();
  
  console.log("✅ Dispute resolved successfully!");
  console.log(`📝 Resolution: ${resolution}`);
}

async function viewOrderHistory(order) {
  console.log("📜 Order History:");
  
  try {
    const orderData = await program.account.order.fetch(order.publicKey);
    const history = orderData.history;
    
    if (history.length === 0) {
      console.log("No history entries found.");
      return;
    }
    
    console.log(`\n📋 Order: ${order.publicKey.toString()}`);
    console.log(`📝 Title: ${orderData.metadata.title}`);
    console.log(`📄 Description: ${orderData.metadata.description}`);
    console.log(`🏷️ Tags: ${orderData.metadata.tags.join(', ')}`);
    console.log(`📂 Category: ${orderData.metadata.category}`);
    console.log(`💰 Amount: ${orderData.amount / LAMPORTS_PER_SOL} SOL`);
    console.log(`🔄 Current State: ${orderData.state}`);
    console.log(`📅 Created: ${formatDeadline(orderData.createdAt)}`);
    console.log(`🕒 Last Updated: ${formatDeadline(orderData.lastUpdated)}`);
    
    console.log("\n📜 History Entries:");
    history.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${formatDeadline(entry.timestamp)}`);
      console.log(`   State: ${entry.state}`);
      console.log(`   Description: ${entry.description}`);
    });
    
  } catch (error) {
    console.log(`❌ Error fetching order history: ${error.message}`);
  }
}

async function searchOrders() {
  console.log("🔍 Order Search (Demo - showing current order details)");
  console.log("Note: In a real implementation, this would search across multiple orders");
  
  // For demo purposes, we'll just show the current order if it exists
  try {
    // This is a placeholder - in a real implementation you'd search by various criteria
    console.log("Search functionality would include:");
    console.log("- Search by status (Pending, InTransit, Completed, etc.)");
    console.log("- Search by date range");
    console.log("- Search by parties (importer, exporter, verifier)");
    console.log("- Search by metadata (title, description, tags, category)");
    console.log("- Search by amount range");
    console.log("- Bulk operations on search results");
  } catch (error) {
    console.log(`❌ Error in search: ${error.message}`);
  }
}

async function bulkOperations() {
  console.log("⚡ Bulk Operations (Demo)");
  console.log("Note: In a real implementation, this would handle multiple orders");
  
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    
    // This is a placeholder - in a real implementation you'd process multiple orders
    await program.methods.bulkCheckDeadlines(new anchor.BN(currentTime))
      .accounts({
        order: Keypair.generate().publicKey, // Placeholder
        escrowPda: Keypair.generate().publicKey, // Placeholder
        importer: Keypair.generate().publicKey, // Placeholder
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("✅ Bulk deadline check initiated!");
    console.log("Bulk operations would include:");
    console.log("- Bulk deadline checks and refunds");
    console.log("- Bulk status updates");
    console.log("- Bulk metadata updates");
    console.log("- Bulk dispute resolution");
    
  } catch (error) {
    console.log(`❌ Error in bulk operations: ${error.message}`);
  }
}

async function partialReleaseFunds(order, escrowPda) {
  if (!order || !escrowPda) {
    console.log("❌ No order created yet. Please create an order first.");
    return;
  }
  let paymentType;
  while (true) {
    const type = (await question("Payment type for partial release (SOL/SPL): ")).trim().toUpperCase();
    if (type === "SOL" || type === "SPL") {
      paymentType = type;
      break;
    } else {
      console.log("❌ Invalid payment type. Enter 'SOL' or 'SPL'.");
    }
  }
  let escrowTokenAccount = null;
  let exporterTokenAccount = null;
  if (paymentType === "SPL") {
    const escrowTokenStr = await question("Enter escrow's token account address: ");
    escrowTokenAccount = new PublicKey(escrowTokenStr.trim());
    const exporterTokenStr = await question("Enter exporter's token account address: ");
    exporterTokenAccount = new PublicKey(exporterTokenStr.trim());
  }
  const amountStr = await question("Enter amount to release: ");
  const amount = parseInt(amountStr.trim());
  if (isNaN(amount) || amount <= 0) {
    console.log("❌ Invalid amount.");
    return;
  }
  try {
    const method = program.methods.partialReleaseFunds(new anchor.BN(amount));
    const accounts = {
      order: order.publicKey,
      signer: verifier.publicKey,
      escrowPda,
      exporter: exporter.publicKey,
      systemProgram: SystemProgram.programId,
    };
    if (paymentType === "SPL") {
      accounts.escrowTokenAccount = escrowTokenAccount;
      accounts.exporterTokenAccount = exporterTokenAccount;
      accounts.tokenProgram = anchor.utils.token.TOKEN_PROGRAM_ID;
    }
    await method.accounts(accounts).signers([verifier]).rpc();
    console.log(`✅ Released ${amount} units to exporter.`);
  } catch (error) {
    if (error.message.includes("InvalidPartialAmount")) {
      console.log("❌ Invalid partial release amount (too much or zero).");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function partialRefund(order, escrowPda) {
  if (!order || !escrowPda) {
    console.log("❌ No order created yet. Please create an order first.");
    return;
  }
  let paymentType;
  while (true) {
    const type = (await question("Payment type for partial refund (SOL/SPL): ")).trim().toUpperCase();
    if (type === "SOL" || type === "SPL") {
      paymentType = type;
      break;
    } else {
      console.log("❌ Invalid payment type. Enter 'SOL' or 'SPL'.");
    }
  }
  let escrowTokenAccount = null;
  let importerTokenAccount = null;
  if (paymentType === "SPL") {
    const escrowTokenStr = await question("Enter escrow's token account address: ");
    escrowTokenAccount = new PublicKey(escrowTokenStr.trim());
    const importerTokenStr = await question("Enter importer's token account address: ");
    importerTokenAccount = new PublicKey(importerTokenStr.trim());
  }
  const amountStr = await question("Enter amount to refund: ");
  const amount = parseInt(amountStr.trim());
  if (isNaN(amount) || amount <= 0) {
    console.log("❌ Invalid amount.");
    return;
  }
  const currentTime = Math.floor(Date.now() / 1000);
  try {
    const method = program.methods.partialRefund(new anchor.BN(amount), new anchor.BN(currentTime));
    const accounts = {
      order: order.publicKey,
      escrowPda,
      importer: importer.publicKey,
      systemProgram: SystemProgram.programId,
    };
    if (paymentType === "SPL") {
      accounts.escrowTokenAccount = escrowTokenAccount;
      accounts.importerTokenAccount = importerTokenAccount;
      accounts.tokenProgram = anchor.utils.token.TOKEN_PROGRAM_ID;
    }
    await method.accounts(accounts).signers([importer]).rpc();
    console.log(`✅ Refunded ${amount} units to importer.`);
  } catch (error) {
    if (error.message.includes("InvalidPartialAmount")) {
      console.log("❌ Invalid partial refund amount (too much or zero).");
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log("🚀 Starting Escrow Smart Contract Interface...");
  
  let currentOrder = null;
  let currentEscrowPda = null;
  
  while (true) {
    await showMenu();
    const choice = await question("Enter your choice (1-22): ");
    
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
          await requestDeadlineExtension(currentOrder);
          break;
        case "11":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await approveDeadlineExtension(currentOrder);
          break;
        case "12":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await rejectDeadlineExtension(currentOrder);
          break;
        case "13":
          await runCompleteFlow();
          break;
        case "14":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await updateOrderMetadata(currentOrder);
          break;
        case "15":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await viewOrderHistory(currentOrder);
          break;
        case "16":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await disputeOrder(currentOrder);
          break;
        case "17":
          if (!currentOrder) {
            console.log("❌ No order created yet. Please create an order first.");
            break;
          }
          await resolveDispute(currentOrder);
          break;
        case "18":
          await searchOrders();
          break;
        case "19":
          await bulkOperations();
          break;
        case "20":
          console.log("👋 Goodbye!");
          rl.close();
          return;
        case "21":
          await partialReleaseFunds(currentOrder, currentEscrowPda);
          break;
        case "22":
          await partialRefund(currentOrder, currentEscrowPda);
          break;
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