use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::{invoke, invoke_signed};

declare_id!("9KUNonirg79qR5SeSGdG49XfQ1DXKkB8GZEVzsakuZcR");

// Deadline range constants (in seconds)
const MIN_DEADLINE: i64 = 60;           // 1 minute
const MAX_DEADLINE: i64 = 8 * 30 * 24 * 60 * 60; // 8 months (approximate)

// Order history entry
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct OrderHistoryEntry {
    pub timestamp: i64,
    pub state: OrderState,
    pub description: String, // Max 100 characters
}

// Order metadata for search/filter
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct OrderMetadata {
    pub title: String, // Max 50 characters
    pub description: String, // Max 200 characters
    pub tags: Vec<String>, // Max 5 tags, each max 20 characters
    pub category: String, // Max 30 characters
}

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
        metadata: OrderMetadata,
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
        order.history = Vec::new();
        order.metadata = metadata;
        order.last_updated = creation_time;
        
        // Add initial history entry
        order.add_history_entry(
            OrderState::PendingDeadlineApproval,
            "Order created - waiting for deadline approval".to_string(),
            creation_time,
        );
        
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
        
        // Add history entry
        order.add_history_entry(
            OrderState::InTransit,
            "Goods shipped - order in transit".to_string(),
            now,
        );
        
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
        
        // Add history entry for delivery
        order.add_history_entry(
            OrderState::Delivered,
            "Delivery confirmed by verifier/importer".to_string(),
            now,
        );
        
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
        
        // Add history entry for completion
        order.add_history_entry(
            OrderState::Completed,
            "Order completed - funds released to exporter".to_string(),
            now,
        );
        
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
        
        // Add history entry
        order.add_history_entry(
            OrderState::Refunded,
            "Deadline passed - funds refunded to importer".to_string(),
            current_time,
        );
        
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
        
        // Add history entry
        order.add_history_entry(
            OrderState::PendingShipment,
            "Deadline approved by importer - ready for shipment".to_string(),
            current_time,
        );
        
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
        
        // Validate new deadline range
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
        order.approved_deadline = 0;
        
        // Add history entry
        order.add_history_entry(
            OrderState::PendingDeadlineApproval,
            "New deadline proposed by exporter - waiting for approval".to_string(),
            now,
        );
        
        Ok(())
    }

    pub fn request_deadline_extension(ctx: Context<RequestDeadlineExtension>, new_deadline: i64, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.state == OrderState::PendingShipment || order.state == OrderState::InTransit, EscrowError::InvalidState);
        require!(order.exporter == *ctx.accounts.exporter.key, EscrowError::Unauthorized);
        require!(order.deadline_approved, EscrowError::DeadlineNotApproved);
        require!(!order.extension_requested, EscrowError::ExtensionAlreadyRequested);
        
        // Validate extension deadline range
        let time_until_deadline = new_deadline - current_time;
        
        require!(
            time_until_deadline >= MIN_DEADLINE,
            EscrowError::DeadlineTooShort
        );
        require!(
            time_until_deadline <= MAX_DEADLINE,
            EscrowError::DeadlineTooLong
        );
        
        order.extension_requested = true;
        order.extension_deadline = new_deadline;
        order.state = OrderState::PendingExtensionApproval;
        
        // Add history entry
        order.add_history_entry(
            OrderState::PendingExtensionApproval,
            "Deadline extension requested by exporter - waiting for approval".to_string(),
            current_time,
        );
        
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
        let new_state = if order.bill_of_lading_hash != [0u8; 32] {
            OrderState::InTransit
        } else {
            OrderState::PendingShipment
        };
        order.state = new_state.clone();
        
        // Add history entry
        order.add_history_entry(
            new_state,
            "Deadline extension approved by importer".to_string(),
            current_time,
        );
        
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
        let new_state = if order.bill_of_lading_hash != [0u8; 32] {
            OrderState::InTransit
        } else {
            OrderState::PendingShipment
        };
        order.state = new_state.clone();
        
        // Add history entry
        let now = Clock::get()?.unix_timestamp;
        order.add_history_entry(
            new_state,
            "Deadline extension rejected by importer".to_string(),
            now,
        );
        
        Ok(())
    }

    // Bulk operations and order management functions
    pub fn update_order_metadata(ctx: Context<UpdateOrderMetadata>, metadata: OrderMetadata, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        // Only importer or exporter can update metadata
        let signer = ctx.accounts.signer.key;
        require!(signer == &order.importer || signer == &order.exporter, EscrowError::Unauthorized);
        
        let current_state = order.state.clone();
        order.update_metadata(metadata, current_time);
        
        // Add history entry
        order.add_history_entry(
            current_state,
            "Order metadata updated".to_string(),
            current_time,
        );
        
        Ok(())
    }

    pub fn bulk_check_deadlines(_ctx: Context<BulkCheckDeadlines>, current_time: i64) -> Result<()> {
        // This function will be called by the CLI to check multiple orders
        // The actual refund logic is handled in check_deadline_and_refund for individual orders
        // This is just a placeholder for bulk operations
        msg!("Bulk deadline check initiated at: {}", current_time);
        Ok(())
    }

    pub fn dispute_order(ctx: Context<DisputeOrder>, reason: String, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        // Only importer or exporter can dispute
        let signer = ctx.accounts.signer.key;
        require!(signer == &order.importer || signer == &order.exporter, EscrowError::Unauthorized);
        require!(order.state != OrderState::Completed && order.state != OrderState::Refunded, EscrowError::InvalidState);
        
        order.state = OrderState::Disputed;
        
        // Add history entry
        order.add_history_entry(
            OrderState::Disputed,
            format!("Order disputed: {}", if reason.len() > 80 { &reason[..80] } else { &reason }),
            current_time,
        );
        
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, resolution: String, current_time: i64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        // Only verifier can resolve disputes
        require!(order.verifier == *ctx.accounts.verifier.key, EscrowError::Unauthorized);
        require!(order.state == OrderState::Disputed, EscrowError::InvalidState);
        
        // For now, we'll just mark as completed (verifier decided in favor of exporter)
        // In a real implementation, you might want more sophisticated dispute resolution
        order.state = OrderState::Completed;
        
        // Add history entry
        order.add_history_entry(
            OrderState::Completed,
            format!("Dispute resolved: {}", if resolution.len() > 80 { &resolution[..80] } else { &resolution }),
            current_time,
        );
        
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

#[derive(Accounts)]
pub struct UpdateOrderMetadata<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct BulkCheckDeadlines<'info> {
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
pub struct DisputeOrder<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut)]
    pub order: Account<'info, Order>,
    pub verifier: Signer<'info>,
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
    pub history: Vec<OrderHistoryEntry>, // Order state history
    pub metadata: OrderMetadata, // Search/filter metadata
    pub last_updated: i64, // Last modification timestamp
}

impl Order {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1 + 8 + 8 + 8 + 1 + 1 + 8 + 32 + 4 + (8 + 1 + 100) * 10 + 4 + 50 + 200 + 4 + (20 * 5) + 30 + 8;
    
    // Helper function to add history entry
    pub fn add_history_entry(&mut self, state: OrderState, description: String, timestamp: i64) {
        let entry = OrderHistoryEntry {
            timestamp,
            state: state.clone(),
            description: if description.len() > 100 {
                description[..100].to_string()
            } else {
                description
            },
        };
        
        // Keep only last 10 history entries to save space
        if self.history.len() >= 10 {
            self.history.remove(0);
        }
        self.history.push(entry);
        self.last_updated = timestamp;
    }
    
    // Helper function to update metadata
    pub fn update_metadata(&mut self, metadata: OrderMetadata, timestamp: i64) {
        self.metadata = metadata;
        self.last_updated = timestamp;
    }
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
