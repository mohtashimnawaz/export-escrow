const anchor = require("@coral-xyz/anchor");
const { SystemProgram, Keypair, PublicKey, LAMPORTS_PER_SOL } = anchor.web3;

// Helper to create a PDA for escrow
async function getEscrowPda(orderKey, programId) {
  return await PublicKey.findProgramAddressSync([
    Buffer.from("escrow_pda"),
    orderKey.toBuffer(),
  ], programId);
}

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
  const deliveryDeadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24; // 1 day from now

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
      new anchor.BN(deliveryDeadline)
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
      })
      .rpc();
    const exporterBalanceAfter = await program.provider.connection.getBalance(exporter.publicKey);
    console.log("Exporter received:", (exporterBalanceAfter - exporterBalanceBefore) / LAMPORTS_PER_SOL, "SOL");
  });

  it("Refund to importer if not delivered (simulate)", async () => {
    // For a real test, create a new order and skip delivery confirmation, then call refund after deadline
    // This is left as an exercise for further testing
  });
});
