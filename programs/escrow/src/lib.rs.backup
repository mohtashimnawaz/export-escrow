use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::{invoke, invoke_signed};

declare_id!("9KUNonirg79qR5SeSGdG49XfQ1DXKkB8GZEVzsakuZcR");

// Deadline range constants (in seconds)
const MIN_DEADLINE: i64 = 60;           // 1 minute
const MAX_DEADLINE: i64 = 8 * 30 * 24 * 60 * 60; // 8 months (approximate)

#[program]
pub mod escrow {
    use super::*;

    // Helper function to validate deadline range
    fn validate_deadline_range(proposed_deadline: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let time_until_deadline = proposed_deadline - now;
        
        require!(
            time_until_deadline >= MIN_DEADLINE,
            EscrowError::DeadlineTooShort
        );
        require!(
            time_until_deadline <= MAX_DEADLINE,
            EscrowError::DeadlineTooLong
        );
        
        Ok(())
    }

    pub fn create_order(
        ctx: Context<CreateOrder>,
        exporter: Pubkey,
        verifier: Pubkey,
        amount: u64,
        proposed_deadline: i64,
    ) -> Result<()> {
        // Validate deadline range
        validate_deadline_range(proposed_deadline)?;
        
        let order = &mut ctx.accounts.order;
        order.importer = *ctx.accounts.importer.key;
        order.exporter = exporter;
        order.verifier = verifier;
        order.amount = amount;
        order.state = OrderState::PendingDeadlineApproval;
        order.created_at = Clock::get()?.unix_timestamp;
        order.proposed_deadline = proposed_deadline;
        order.approved_deadline = 0; // Will be set when importer approves
        order.deadline_approved = false;
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
        require!(order.deadline_approved, EscrowError::DeadlineNotApproved);
        
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
        // Transfer SOL from escrow PDA to exporter using System Program
        let amount = order.amount;
        let ix = system_instruction::transfer(
            ctx.accounts.escrow_pda.key,
            ctx.accounts.exporter.key,
            amount,
        );
        
        let order_key = order.key();
        let seeds = &[
            b"escrow_pda",
            order_key.as_ref(),
            &[ctx.bumps.escrow_pda],
        ];
        let signer = &[&seeds[..]];
        
        invoke_signed(
            &ix,
            &[
                ctx.accounts.escrow_pda.to_account_info(),
                ctx.accounts.exporter.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
        order.state = OrderState::Completed;
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state != OrderState::Completed, EscrowError::InvalidState);
        require!(order.deadline_approved, EscrowError::DeadlineNotApproved);
        let now = Clock::get()?.unix_timestamp;
        require!(now > order.approved_deadline, EscrowError::TooEarlyForRefund);
        // Transfer SOL from escrow PDA back to importer using System Program
        let amount = order.amount;
        let ix = system_instruction::transfer(
            ctx.accounts.escrow_pda.key,
            ctx.accounts.importer.key,
            amount,
        );
        
        let order_key = order.key();
        let seeds = &[
            b"escrow_pda",
            order_key.as_ref(),
            &[ctx.bumps.escrow_pda],
        ];
        let signer = &[&seeds[..]];
        
        invoke_signed(
            &ix,
            &[
                ctx.accounts.escrow_pda.to_account_info(),
                ctx.accounts.importer.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
        order.state = OrderState::Refunded;
        Ok(())
    }

    pub fn approve_deadline(ctx: Context<ApproveDeadline>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingDeadlineApproval, EscrowError::InvalidState);
        require!(order.importer == *ctx.accounts.importer.key, EscrowError::Unauthorized);
        
        order.approved_deadline = order.proposed_deadline;
        order.deadline_approved = true;
        order.state = OrderState::PendingShipment;
        
        Ok(())
    }

    pub fn propose_new_deadline(ctx: Context<ProposeNewDeadline>, new_deadline: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingDeadlineApproval, EscrowError::InvalidState);
        require!(order.exporter == *ctx.accounts.exporter.key, EscrowError::Unauthorized);
        
        // Validate deadline range
        validate_deadline_range(new_deadline)?;
        
        order.proposed_deadline = new_deadline;
        order.deadline_approved = false;
        
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
    #[account(
        mut,
        seeds = [b"escrow_pda", order.key().as_ref()],
        bump
    )]
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
    #[account(
        mut,
        seeds = [b"escrow_pda", order.key().as_ref()],
        bump
    )]
    pub escrow_pda: UncheckedAccount<'info>,
    /// CHECK: Exporter account
    #[account(mut)]
    pub exporter: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    /// CHECK: This is the escrow PDA
    #[account(
        mut,
        seeds = [b"escrow_pda", order.key().as_ref()],
        bump
    )]
    pub escrow_pda: UncheckedAccount<'info>,
    /// CHECK: Importer account
    #[account(mut)]
    pub importer: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ApproveDeadline<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub importer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ProposeNewDeadline<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub exporter: Signer<'info>,
}

#[account]
pub struct Order {
    pub importer: Pubkey,
    pub exporter: Pubkey,
    pub verifier: Pubkey,
    pub amount: u64,
    pub state: OrderState,
    pub created_at: i64,
    pub proposed_deadline: i64,  // Deadline proposed by exporter
    pub approved_deadline: i64,  // Final deadline after importer approval
    pub deadline_approved: bool, // Whether importer has approved the deadline
    pub bill_of_lading_hash: [u8; 32],
}

impl Order {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1 + 8 + 8 + 8 + 1 + 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderState {
    PendingDeadlineApproval,  // Waiting for importer to approve deadline
    PendingShipment,          // Deadline approved, waiting for shipment
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
    #[msg("Deadline not approved")] 
    DeadlineNotApproved,
    #[msg("Deadline too short")] 
    DeadlineTooShort,
    #[msg("Deadline too long")] 
    DeadlineTooLong,
}
