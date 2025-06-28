const anchor = require("@coral-xyz/anchor");
const { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } = anchor.web3;
const assert = require("assert");

// Helper to create a PDA for escrow
async function getEscrowPda(orderKey, programId) {
  return await PublicKey.findProgramAddressSync([
    Buffer.from("escrow_pda"),
    orderKey.toBuffer(),
  ], programId);
}

// Time helper functions
const TimeHelpers = {
  minutes: (mins) => Math.floor(Date.now() / 1000) + (mins * 60),
  hours: (hrs) => Math.floor(Date.now() / 1000) + (hrs * 60 * 60),
  days: (days) => Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60),
  weeks: (weeks) => Math.floor(Date.now() / 1000) + (weeks * 7 * 24 * 60 * 60),
  months: (months) => Math.floor(Date.now() / 1000) + (months * 30 * 24 * 60 * 60)
};

describe("escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Escrow;

  let importer = Keypair.generate();
  let exporter = Keypair.generate();
  let verifier = Keypair.generate();
  let order = Keypair.generate();
  let escrowPda;

  const amount = 0.1 * LAMPORTS_PER_SOL;
  const proposedDeadline = TimeHelpers.days(1); // 1 day from now

  before(async () => {
    // Airdrop SOL to importer
    const sig = await program.provider.connection.requestAirdrop(importer.publicKey, 2 * LAMPORTS_PER_SOL);
    await program.provider.connection.confirmTransaction(sig);
  });

  it("Importer creates order and deposits SOL", async () => {
    escrowPda = (await getEscrowPda(order.publicKey, program.programId))[0];
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
    // Check escrow PDA balance
    const escrowBalance = await program.provider.connection.getBalance(escrowPda);
    console.log("Escrow PDA balance after deposit:", escrowBalance / LAMPORTS_PER_SOL, "SOL");
  });

  it("Importer approves the proposed deadline", async () => {
    await program.methods.approveDeadline()
      .accounts({
        order: order.publicKey,
        importer: importer.publicKey,
      })
      .signers([importer])
      .rpc();
    console.log("✅ Deadline approved by importer");
  });

  it("Exporter ships goods", async () => {
    const billOfLadingHash = new Array(32).fill(1); // Dummy hash
    await program.methods.shipGoods(billOfLadingHash)
      .accounts({
        order: order.publicKey,
        exporter: exporter.publicKey,
      })
      .signers([exporter])
      .rpc();
  });

  it("Verifier confirms delivery", async () => {
    await program.methods.confirmDelivery()
      .accounts({
        order: order.publicKey,
        signer: verifier.publicKey,
      })
      .signers([verifier])
      .rpc();
  });

  it("Release funds to exporter", async () => {
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
    console.log("Exporter received:", (exporterBalanceAfter - exporterBalanceBefore) / LAMPORTS_PER_SOL, "SOL");
  });

  it("Test deadline negotiation flow", async () => {
    // Create a new order for testing deadline negotiation
    const newOrder = Keypair.generate();
    const newEscrowPda = (await getEscrowPda(newOrder.publicKey, program.programId))[0];
    
    // Create order with initial deadline
    await program.methods.createOrder(
      exporter.publicKey,
      verifier.publicKey,
      new anchor.BN(amount),
      new anchor.BN(proposedDeadline)
    ).accounts({
      order: newOrder.publicKey,
      importer: importer.publicKey,
      escrowPda: newEscrowPda,
      systemProgram: SystemProgram.programId,
    }).signers([importer, newOrder]).rpc();
    
    // Exporter proposes a new deadline
    const newDeadline = TimeHelpers.weeks(2); // 2 weeks from now
    await program.methods.proposeNewDeadline(new anchor.BN(newDeadline))
      .accounts({
        order: newOrder.publicKey,
        exporter: exporter.publicKey,
      })
      .signers([exporter])
      .rpc();
    console.log("✅ New deadline proposed by exporter");
    
    // Importer approves the new deadline
    await program.methods.approveDeadline()
      .accounts({
        order: newOrder.publicKey,
        importer: importer.publicKey,
      })
      .signers([importer])
      .rpc();
    console.log("✅ New deadline approved by importer");
  });

  it("Test minimum deadline (1 minute)", async () => {
    const minOrder = Keypair.generate();
    const minEscrowPda = (await getEscrowPda(minOrder.publicKey, program.programId))[0];
    
    // Create order with 1 minute deadline
    const oneMinuteDeadline = TimeHelpers.minutes(1);
    await program.methods.createOrder(
      exporter.publicKey,
      verifier.publicKey,
      new anchor.BN(amount),
      new anchor.BN(oneMinuteDeadline)
    ).accounts({
      order: minOrder.publicKey,
      importer: importer.publicKey,
      escrowPda: minEscrowPda,
      systemProgram: SystemProgram.programId,
    }).signers([importer, minOrder]).rpc();
    
    console.log("✅ Order created with 1 minute deadline");
  });

  it("Test maximum deadline (7 months)", async () => {
    const maxOrder = Keypair.generate();
    const maxEscrowPda = (await getEscrowPda(maxOrder.publicKey, program.programId))[0];
    
    // Create order with 7 months deadline (within the 8 month limit)
    const sevenMonthsDeadline = TimeHelpers.months(7);
    await program.methods.createOrder(
      exporter.publicKey,
      verifier.publicKey,
      new anchor.BN(amount),
      new anchor.BN(sevenMonthsDeadline)
    ).accounts({
      order: maxOrder.publicKey,
      importer: importer.publicKey,
      escrowPda: maxEscrowPda,
      systemProgram: SystemProgram.programId,
    }).signers([importer, maxOrder]).rpc();
    
    console.log("✅ Order created with 7 months deadline");
  });

  it("Test deadline too short (30 seconds) - should fail", async () => {
    const shortOrder = Keypair.generate();
    const shortEscrowPda = (await getEscrowPda(shortOrder.publicKey, program.programId))[0];
    
    // Try to create order with 30 seconds deadline (less than 1 minute)
    const thirtySecondsDeadline = Math.floor(Date.now() / 1000) + 30;
    
    try {
      await program.methods.createOrder(
        exporter.publicKey,
        verifier.publicKey,
        new anchor.BN(amount),
        new anchor.BN(thirtySecondsDeadline)
      ).accounts({
        order: shortOrder.publicKey,
        importer: importer.publicKey,
        escrowPda: shortEscrowPda,
        systemProgram: SystemProgram.programId,
      }).signers([importer, shortOrder]).rpc();
      
      // If we reach here, the test should fail
      assert.fail("Should have thrown an error for deadline too short");
    } catch (error) {
      console.log("✅ Correctly rejected deadline too short (30 seconds)");
      assert(error.message.includes("DeadlineTooShort"));
    }
  });

  it("Test deadline too long (9 months) - should fail", async () => {
    const longOrder = Keypair.generate();
    const longEscrowPda = (await getEscrowPda(longOrder.publicKey, program.programId))[0];
    
    // Try to create order with 9 months deadline (more than 8 months)
    const nineMonthsDeadline = TimeHelpers.months(9);
    
    try {
      await program.methods.createOrder(
        exporter.publicKey,
        verifier.publicKey,
        new anchor.BN(amount),
        new anchor.BN(nineMonthsDeadline)
      ).accounts({
        order: longOrder.publicKey,
        importer: importer.publicKey,
        escrowPda: longEscrowPda,
        systemProgram: SystemProgram.programId,
      }).signers([importer, longOrder]).rpc();
      
      // If we reach here, the test should fail
      assert.fail("Should have thrown an error for deadline too long");
    } catch (error) {
      console.log("✅ Correctly rejected deadline too long (9 months)");
      assert(error.message.includes("DeadlineTooLong"));
    }
  });

  it("Refund to importer if not delivered (simulate)", async () => {
    // For a real test, create a new order and skip delivery confirmation, then call refund after deadline
    // This is left as an exercise for further testing
  });
});
