use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke;

declare_id!("mfRuBefFNfUUUYpyDASDWHiFoHdpo4uejPEcUrsp9Ar");

#[program]
pub mod escrow {
    use super::*;

    pub fn create_order(
        ctx: Context<CreateOrder>,
        exporter: Pubkey,
        verifier: Pubkey,
        amount: u64,
        delivery_deadline: i64,
    ) -> Result<()> {
        let order = &mut ctx.accounts.order;
        order.importer = *ctx.accounts.importer.key;
        order.exporter = exporter;
        order.verifier = verifier;
        order.amount = amount;
        order.state = OrderState::PendingShipment;
        order.created_at = Clock::get()?.unix_timestamp;
        order.delivery_deadline = delivery_deadline;
        order.bill_of_lading_hash = [0u8; 32];
        // Transfer SOL from importer to escrow PDA
        let ix = system_instruction::transfer(
            ctx.accounts.importer.key,
            ctx.accounts.escrow_pda.key,
            amount,
        );
        invoke(
            &ix,
            &[
                ctx.accounts.importer.to_account_info(),
                ctx.accounts.escrow_pda.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    pub fn ship_goods(
        ctx: Context<ShipGoods>,
        bill_of_lading_hash: [u8; 32],
    ) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingShipment, EscrowError::InvalidState);
        require!(order.exporter == *ctx.accounts.exporter.key, EscrowError::Unauthorized);
        order.bill_of_lading_hash = bill_of_lading_hash;
        order.state = OrderState::InTransit;
        Ok(())
    }

    pub fn confirm_delivery(ctx: Context<ConfirmDelivery>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::InTransit, EscrowError::InvalidState);
        // Only verifier or importer can confirm delivery
        let signer = ctx.accounts.signer.key;
        require!(signer == &order.verifier || signer == &order.importer, EscrowError::Unauthorized);
        order.state = OrderState::Delivered;
        Ok(())
    }

    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::Delivered, EscrowError::InvalidState);
        // Transfer SOL from escrow PDA to exporter
        let amount = order.amount;
        **ctx.accounts.escrow_pda.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.exporter.to_account_info().try_borrow_mut_lamports()? += amount;
        order.state = OrderState::Completed;
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state != OrderState::Completed, EscrowError::InvalidState);
        let now = Clock::get()?.unix_timestamp;
        require!(now > order.delivery_deadline, EscrowError::TooEarlyForRefund);
        // Transfer SOL from escrow PDA back to importer
        let amount = order.amount;
        **ctx.accounts.escrow_pda.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.importer.to_account_info().try_borrow_mut_lamports()? += amount;
        order.state = OrderState::Refunded;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateOrder<'info> {
    #[account(init, payer = importer, space = 8 + Order::LEN)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub importer: Signer<'info>,
    /// CHECK: This is the escrow PDA
    #[account(mut)]
    pub escrow_pda: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ShipGoods<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    pub exporter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfirmDelivery<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    pub signer: Signer<'info>, // Importer or verifier
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    /// CHECK: This is the escrow PDA
    #[account(mut)]
    pub escrow_pda: UncheckedAccount<'info>,
    /// CHECK: Exporter account
    #[account(mut)]
    pub exporter: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    /// CHECK: This is the escrow PDA
    #[account(mut)]
    pub escrow_pda: UncheckedAccount<'info>,
    /// CHECK: Importer account
    #[account(mut)]
    pub importer: UncheckedAccount<'info>,
}

#[account]
pub struct Order {
    pub importer: Pubkey,
    pub exporter: Pubkey,
    pub verifier: Pubkey,
    pub amount: u64,
    pub state: OrderState,
    pub created_at: i64,
    pub delivery_deadline: i64,
    pub bill_of_lading_hash: [u8; 32],
}

impl Order {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1 + 8 + 8 + 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderState {
    PendingShipment,
    InTransit,
    Delivered,
    Completed,
    Refunded,
    Disputed,
}

#[error_code]
pub enum EscrowError {
    #[msg("Invalid state for this operation")] 
    InvalidState,
    #[msg("Unauthorized")] 
    Unauthorized,
    #[msg("Too early for refund")] 
    TooEarlyForRefund,
}
