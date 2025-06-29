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

    pub fn create_order(
        ctx: Context<CreateOrder>,
        exporter: Pubkey,
        verifier: Pubkey,
        amount: u64,
        proposed_deadline: i64,
        creation_time: i64,
    ) -> Result<()> {
        // Validate deadline range
        let time_until_deadline = proposed_deadline - creation_time;
        
        require!(
            time_until_deadline >= MIN_DEADLINE,
            EscrowError::DeadlineTooShort
        );
        require!(
            time_until_deadline <= MAX_DEADLINE,
            EscrowError::DeadlineTooLong
        );
        
        let order = &mut ctx.accounts.order;
        order.importer = *ctx.accounts.importer.key;
        order.exporter = exporter;
        order.verifier = verifier;
        order.amount = amount;
        order.state = OrderState::PendingDeadlineApproval;
        order.created_at = creation_time;
        order.proposed_deadline = proposed_deadline;
        order.approved_deadline = 0; // Will be set when importer approves
        order.deadline_approved = false;
        order.extension_requested = false;
        order.extension_deadline = 0;
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
        
        // Check if deadline has passed
        let now = Clock::get()?.unix_timestamp;
        require!(now <= order.approved_deadline, EscrowError::DeadlinePassed);
        
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
        
        // Check if deadline has passed
        let now = Clock::get()?.unix_timestamp;
        require!(now <= order.approved_deadline, EscrowError::DeadlinePassed);
        
        order.state = OrderState::Delivered;
        
        // Automatically release funds to exporter when delivery is confirmed
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

    pub fn check_deadline_and_refund(ctx: Context<CheckDeadlineAndRefund>, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state != OrderState::Completed, EscrowError::InvalidState);
        require!(order.deadline_approved, EscrowError::DeadlineNotApproved);
        
        // Use the current_time parameter from CLI to ensure consistency
        require!(current_time > order.approved_deadline, EscrowError::TooEarlyForRefund);
        
        // Automatically refund to importer if deadline has passed and goods not delivered
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
        
        // Debug: Print the values
        msg!("Debug - Current time: {}", current_time);
        msg!("Debug - Approved deadline: {}", order.approved_deadline);
        msg!("Debug - Time difference: {}", current_time - order.approved_deadline);
        
        Ok(())
    }

    pub fn approve_deadline(ctx: Context<ApproveDeadline>, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingDeadlineApproval, EscrowError::InvalidState);
        require!(order.importer == *ctx.accounts.importer.key, EscrowError::Unauthorized);
        
        // The proposed_deadline is an absolute timestamp from the CLI (local time)
        // We need to extract the duration and apply it from the approval time
        let creation_time = order.created_at;
        let proposed_duration = order.proposed_deadline - creation_time;
        
        // Set the approved deadline to start from now (approval time) with the same duration
        // Use the current_time parameter from CLI to ensure consistency
        order.approved_deadline = current_time + proposed_duration;
        order.deadline_approved = true;
        order.state = OrderState::PendingShipment;
        
        // Debug: Print the values (this will be in the transaction logs)
        msg!("Debug - Creation time: {}", creation_time);
        msg!("Debug - Proposed deadline: {}", order.proposed_deadline);
        msg!("Debug - Proposed duration: {}", proposed_duration);
        msg!("Debug - Approval time: {}", current_time);
        msg!("Debug - Approved deadline: {}", order.approved_deadline);
        
        Ok(())
    }

    pub fn propose_new_deadline(ctx: Context<ProposeNewDeadline>, new_deadline: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingDeadlineApproval, EscrowError::InvalidState);
        require!(order.exporter == *ctx.accounts.exporter.key, EscrowError::Unauthorized);
        
        // Validate deadline range
        let now = Clock::get()?.unix_timestamp;
        let time_until_deadline = new_deadline - now;
        
        require!(
            time_until_deadline >= MIN_DEADLINE,
            EscrowError::DeadlineTooShort
        );
        require!(
            time_until_deadline <= MAX_DEADLINE,
            EscrowError::DeadlineTooLong
        );
        
        order.proposed_deadline = new_deadline;
        order.deadline_approved = false;
        
        Ok(())
    }

    pub fn request_deadline_extension(ctx: Context<RequestDeadlineExtension>, new_deadline: i64, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingShipment || order.state == OrderState::InTransit, EscrowError::InvalidState);
        require!(order.exporter == *ctx.accounts.exporter.key, EscrowError::Unauthorized);
        require!(!order.extension_requested, EscrowError::ExtensionAlreadyRequested);
        
        // Check if current deadline has passed
        require!(current_time <= order.approved_deadline, EscrowError::DeadlinePassed);
        
        // Validate new deadline is in the future and within range
        let time_until_new_deadline = new_deadline - current_time;
        require!(
            time_until_new_deadline >= MIN_DEADLINE,
            EscrowError::DeadlineTooShort
        );
        require!(
            time_until_new_deadline <= MAX_DEADLINE,
            EscrowError::DeadlineTooLong
        );
        
        // New deadline must be after current approved deadline
        require!(new_deadline > order.approved_deadline, EscrowError::DeadlineTooShort);
        
        order.extension_requested = true;
        order.extension_deadline = new_deadline;
        order.state = OrderState::PendingExtensionApproval;
        
        // Debug: Print the values
        msg!("Debug - Current approved deadline: {}", order.approved_deadline);
        msg!("Debug - Requested extension deadline: {}", new_deadline);
        msg!("Debug - Extension duration: {}", new_deadline - order.approved_deadline);
        
        Ok(())
    }

    pub fn approve_deadline_extension(ctx: Context<ApproveDeadlineExtension>, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingExtensionApproval, EscrowError::InvalidState);
        require!(order.importer == *ctx.accounts.importer.key, EscrowError::Unauthorized);
        require!(order.extension_requested, EscrowError::ExtensionRequestNotFound);
        
        // Update the approved deadline to the extension deadline
        order.approved_deadline = order.extension_deadline;
        order.extension_requested = false;
        order.extension_deadline = 0;
        
        // Return to previous state (PendingShipment or InTransit)
        if order.bill_of_lading_hash != [0u8; 32] {
            order.state = OrderState::InTransit;
        } else {
            order.state = OrderState::PendingShipment;
        }
        
        // Debug: Print the values
        msg!("Debug - Extension approved at: {}", current_time);
        msg!("Debug - New approved deadline: {}", order.approved_deadline);
        
        Ok(())
    }

    pub fn reject_deadline_extension(ctx: Context<RejectDeadlineExtension>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingExtensionApproval, EscrowError::InvalidState);
        require!(order.importer == *ctx.accounts.importer.key, EscrowError::Unauthorized);
        require!(order.extension_requested, EscrowError::ExtensionRequestNotFound);
        
        // Clear extension request
        order.extension_requested = false;
        order.extension_deadline = 0;
        
        // Return to previous state (PendingShipment or InTransit)
        if order.bill_of_lading_hash != [0u8; 32] {
            order.state = OrderState::InTransit;
        } else {
            order.state = OrderState::PendingShipment;
        }
        
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
pub struct CheckDeadlineAndRefund<'info> {
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

#[derive(Accounts)]
pub struct RequestDeadlineExtension<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub exporter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveDeadlineExtension<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub importer: Signer<'info>,
}

#[derive(Accounts)]
pub struct RejectDeadlineExtension<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub importer: Signer<'info>,
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
    pub extension_requested: bool, // Whether an extension has been requested
    pub extension_deadline: i64, // Proposed extension deadline
    pub bill_of_lading_hash: [u8; 32],
}

impl Order {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1 + 8 + 8 + 8 + 1 + 1 + 8 + 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderState {
    PendingDeadlineApproval,  // Waiting for importer to approve deadline
    PendingShipment,          // Deadline approved, waiting for shipment
    PendingExtensionApproval, // Waiting for importer to approve deadline extension
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
    #[msg("Deadline passed")] 
    DeadlinePassed,
    #[msg("Extension request not found")] 
    ExtensionRequestNotFound,
    #[msg("Extension already requested")] 
    ExtensionAlreadyRequested,
}
