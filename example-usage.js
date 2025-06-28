const anchor = require("@coral-xyz/anchor");
const { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } = anchor.web3;

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

async function main() {
  try {
    // Configure the client to use the local cluster
    anchor.setProvider(anchor.AnchorProvider.env());
    const program = anchor.workspace.Escrow;

    console.log("🚢 Escrow Smart Contract - Example Usage");
    console.log("========================================\n");

    // Generate keypairs for demonstration
    const importer = Keypair.generate();
    const exporter = Keypair.generate();
    const verifier = Keypair.generate();
    const order = Keypair.generate();

    const amount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL

    // Airdrop SOL to importer
    console.log("💰 Airdropping SOL to importer...");
    const sig = await program.provider.connection.requestAirdrop(importer.publicKey, 2 * LAMPORTS_PER_SOL);
    await program.provider.connection.confirmTransaction(sig);
    console.log("✅ Airdrop successful\n");

    // Step 1: Create Order
    console.log("📋 Step 1: Creating Order");
    console.log("==========================");
    console.log(`Importer: ${importer.publicKey.toString()}`);
    console.log(`Exporter: ${exporter.publicKey.toString()}`);
    console.log(`Verifier: ${verifier.publicKey.toString()}`);
    console.log(`Amount: ${amount / LAMPORTS_PER_SOL} SOL`);

    // Create deadline using helper function (1 day from now)
    const proposedDeadline = TimeHelpers.days(1);
    console.log(`Proposed Deadline: ${formatDeadline(proposedDeadline)}`);

    const escrowPda = (await getEscrowPda(order.publicKey, program.programId))[0];
    console.log(`Escrow PDA: ${escrowPda.toString()}`);

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

    console.log("✅ Order created successfully!\n");

    // Step 2: Approve Deadline
    console.log("✅ Step 2: Approving Deadline");
    console.log("=============================");
    await program.methods.approveDeadline()
      .accounts({
        order: order.publicKey,
        importer: importer.publicKey,
      })
      .signers([importer])
      .rpc();
    console.log("✅ Deadline approved by importer\n");

    // Step 3: Ship Goods
    console.log("📦 Step 3: Shipping Goods");
    console.log("=========================");
    const billOfLadingHash = new Array(32).fill(1); // Dummy hash
    await program.methods.shipGoods(billOfLadingHash)
      .accounts({
        order: order.publicKey,
        exporter: exporter.publicKey,
      })
      .signers([exporter])
      .rpc();
    console.log("✅ Goods shipped by exporter\n");

    // Step 4: Confirm Delivery
    console.log("✅ Step 4: Confirming Delivery");
    console.log("==============================");
    await program.methods.confirmDelivery()
      .accounts({
        order: order.publicKey,
        signer: verifier.publicKey,
      })
      .signers([verifier])
      .rpc();
    console.log("✅ Delivery confirmed by verifier\n");

    // Step 5: Release Funds
    console.log("💰 Step 5: Releasing Funds");
    console.log("==========================");
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
    console.log(`✅ Funds released to exporter: ${(exporterBalanceAfter - exporterBalanceBefore) / LAMPORTS_PER_SOL} SOL\n`);

    // Demonstrate deadline negotiation flow
    console.log("🔄 Bonus: Deadline Negotiation Flow");
    console.log("===================================");
    
    // Create a new order for demonstration
    const newOrder = Keypair.generate();
    const newEscrowPda = (await getEscrowPda(newOrder.publicKey, program.programId))[0];
    
    // Create order with initial deadline
    const initialDeadline = TimeHelpers.days(1);
    await program.methods.createOrder(
      exporter.publicKey,
      verifier.publicKey,
      new anchor.BN(amount),
      new anchor.BN(initialDeadline)
    ).accounts({
      order: newOrder.publicKey,
      importer: importer.publicKey,
      escrowPda: newEscrowPda,
      systemProgram: SystemProgram.programId,
    }).signers([importer, newOrder]).rpc();
    console.log("✅ New order created with 1 day deadline");

    // Exporter proposes a new deadline
    const newDeadline = TimeHelpers.weeks(2);
    await program.methods.proposeNewDeadline(new anchor.BN(newDeadline))
      .accounts({
        order: newOrder.publicKey,
        exporter: exporter.publicKey,
      })
      .signers([exporter])
      .rpc();
    console.log(`✅ Exporter proposed new deadline: ${formatDeadline(newDeadline)}`);

    // Importer approves the new deadline
    await program.methods.approveDeadline()
      .accounts({
        order: newOrder.publicKey,
        importer: importer.publicKey,
      })
      .signers([importer])
      .rpc();
    console.log("✅ Importer approved the new deadline\n");

    // Demonstrate deadline range validation
    console.log("🔍 Deadline Range Validation Examples");
    console.log("====================================");
    
    try {
      // Test minimum deadline (1 minute)
      const minDeadline = TimeHelpers.minutes(1);
      console.log(`✅ Minimum deadline (1 minute): ${formatDeadline(minDeadline)}`);
      
      // Test maximum deadline (8 months)
      const maxDeadline = TimeHelpers.months(8);
      console.log(`✅ Maximum deadline (8 months): ${formatDeadline(maxDeadline)}`);
      
      // Test invalid deadlines
      try {
        TimeHelpers.minutes(0.5); // Less than 1 minute
        console.log("❌ Should have failed for deadline too short");
      } catch (error) {
        console.log("✅ Correctly rejected deadline too short:", error.message);
      }
      
      try {
        TimeHelpers.months(9); // More than 8 months
        console.log("❌ Should have failed for deadline too long");
      } catch (error) {
        console.log("✅ Correctly rejected deadline too long:", error.message);
      }
      
    } catch (error) {
      console.log("❌ Error in deadline validation:", error.message);
    }

    console.log("\n🎉 Example completed successfully!");
    console.log("\nKey Features Demonstrated:");
    console.log("- Order creation with deadline range validation (1 minute to 8 months)");
    console.log("- Deadline approval workflow");
    console.log("- Goods shipping and delivery confirmation");
    console.log("- Fund release to exporter");
    console.log("- Deadline negotiation between exporter and importer");
    console.log("- Second-level precision for all deadlines");

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main().catch(console.error); 