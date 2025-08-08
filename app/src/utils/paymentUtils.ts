import { Connection, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export interface PaymentMilestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  percentage: number;
  status: 'pending' | 'submitted' | 'approved' | 'paid' | 'disputed' | 'cancelled';
  approvals: ApprovalRequest[];
  conditions: string[];
  dueDate?: Date;
  paidAt?: number;
  transactionId?: string;
}

export interface ApprovalRequest {
  role: 'buyer' | 'seller' | 'arbiter';
  approved: boolean;
  note?: string;
  timestamp: Date;
}

export interface PaymentSchedule {
  id: string;
  orderId: string;
  totalAmount: number;
  currency: string;
  milestones: PaymentMilestone[];
  createdAt: number;
  updatedAt: number;
}

export interface RefundRequest {
  id: string;
  scheduleId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  milestoneIds: string[];
  requestedAt: number;
  processedAt?: number;
  transactionId?: string;
}

export class PaymentManager {
  constructor(private connection: Connection) {}

  createPaymentSchedule(
    orderId: string,
    totalAmount: number,
    currency: any,
    milestones: Omit<PaymentMilestone, 'id' | 'status' | 'approvals'>[]
  ): PaymentSchedule {
    return {
      id: `schedule_${orderId}_${Date.now()}`,
      orderId,
      totalAmount,
      currency: currency.symbol,
      milestones: milestones.map((milestone, index) => ({
        ...milestone,
        id: `milestone_${index + 1}`,
        status: 'pending' as const,
        approvals: [],
      })),
      createdAt: Date.now() / 1000,
      updatedAt: Date.now() / 1000,
    };
  }

  validateMilestones(milestones: PaymentMilestone[]): boolean {
    const totalPercentage = milestones.reduce((sum, m) => sum + m.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error(`Total percentage must equal 100%, got ${totalPercentage}%`);
    }
    return true;
  }

  calculateMilestoneAmounts(totalAmount: number, milestones: PaymentMilestone[]): PaymentMilestone[] {
    return milestones.map(milestone => ({
      ...milestone,
      amount: (totalAmount * milestone.percentage) / 100
    }));
  }

  addMilestoneApproval(
    schedule: PaymentSchedule,
    milestoneId: string,
    approverRole: 'buyer' | 'seller' | 'arbiter',
    note?: string
  ): PaymentSchedule {
    const milestone = schedule.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found');
    }

    milestone.approvals.push({
      role: approverRole,
      approved: true,
      note,
      timestamp: new Date()
    });

    const buyerApproval = milestone.approvals.find(a => a.role === 'buyer' && a.approved);
    if (buyerApproval && milestone.status === 'submitted') {
      milestone.status = 'approved';
    }

    schedule.updatedAt = Date.now() / 1000;
    return schedule;
  }

  submitMilestone(schedule: PaymentSchedule, milestoneId: string, note?: string): PaymentSchedule {
    const milestone = schedule.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found');
    }

    if (milestone.status !== 'pending') {
      throw new Error('Milestone is not in pending state');
    }

    milestone.status = 'submitted';
    if (note) {
      milestone.approvals.push({
        role: 'seller',
        approved: false,
        note,
        timestamp: new Date()
      });
    }

    schedule.updatedAt = Date.now() / 1000;
    return schedule;
  }

  processMilestonePayment(
    schedule: PaymentSchedule,
    milestoneId: string,
    transactionId: string
  ): PaymentSchedule {
    const milestone = schedule.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found');
    }

    if (milestone.status !== 'approved') {
      throw new Error('Milestone must be approved before payment');
    }

    milestone.status = 'paid';
    milestone.paidAt = Date.now() / 1000;
    milestone.transactionId = transactionId;

    schedule.updatedAt = Date.now() / 1000;
    return schedule;
  }

  createRefundRequest(
    schedule: PaymentSchedule,
    reason: string,
    amount?: number
  ): RefundRequest {
    const paidMilestones = schedule.milestones.filter(m => m.status === 'paid');
    const totalPaid = paidMilestones.reduce((sum, m) => sum + m.amount, 0);
    
    return {
      id: `refund_${schedule.id}_${Date.now()}`,
      scheduleId: schedule.id,
      amount: amount || totalPaid,
      reason,
      status: 'pending',
      milestoneIds: paidMilestones.map(m => m.id),
      requestedAt: Date.now() / 1000,
    };
  }

  processRefund(
    refundRequest: RefundRequest,
    transactionId: string
  ): RefundRequest {
    if (refundRequest.status !== 'pending') {
      throw new Error('Refund request is not in pending state');
    }

    refundRequest.status = 'approved';
    refundRequest.processedAt = Date.now() / 1000;
    refundRequest.transactionId = transactionId;

    return refundRequest;
  }

  getMilestoneProgress(schedule: PaymentSchedule): {
    total: number;
    completed: number;
    percentage: number;
    amountPaid: number;
    amountRemaining: number;
  } {
    const completed = schedule.milestones.filter(m => m.status === 'paid').length;
    const amountPaid = schedule.milestones
      .filter(m => m.status === 'paid')
      .reduce((sum, m) => sum + m.amount, 0);

    return {
      total: schedule.milestones.length,
      completed,
      percentage: (completed / schedule.milestones.length) * 100,
      amountPaid,
      amountRemaining: schedule.totalAmount - amountPaid,
    };
  }

  getOverdueMilestones(schedule: PaymentSchedule): PaymentMilestone[] {
    const currentDate = Date.now() / 1000;
    return schedule.milestones.filter(milestone => {
      if (milestone.dueDate && currentDate > milestone.dueDate.getTime() / 1000) {
        return milestone.status === 'pending' || milestone.status === 'submitted';
      }
      return false;
    });
  }

  canApproveMilestone(milestone: PaymentMilestone, userRole: string): boolean {
    return userRole === 'buyer' && milestone.status === 'submitted';
  }

  canProcessPayment(milestone: PaymentMilestone, userRole: string): boolean {
    return userRole === 'buyer' && milestone.status === 'approved';
  }
}

// Predefined milestone templates
export const MILESTONE_TEMPLATES = {
  THREE_PHASE: [
    {
      title: "Project Initiation",
      description: "Initial setup, planning, and material procurement",
      percentage: 30,
      conditions: ["Project plan approved", "Materials ordered", "Timeline confirmed"],
    },
    {
      title: "Development/Production",
      description: "Main work phase - development or manufacturing",
      percentage: 50,
      conditions: ["Work commenced", "Progress review completed", "Quality check passed"],
    },
    {
      title: "Completion & Delivery",
      description: "Final delivery, testing, and project completion",
      percentage: 20,
      conditions: ["Final delivery made", "Testing completed", "Documentation provided"],
    }
  ],

  MANUFACTURING: [
    {
      title: "Design & Planning",
      description: "Product design finalization and production planning",
      percentage: 20,
      conditions: ["Design approved", "Production plan created", "Materials sourced"],
    },
    {
      title: "Prototype Development",
      description: "Initial prototype creation and testing",
      percentage: 25,
      conditions: ["Prototype completed", "Initial testing passed", "Feedback incorporated"],
    },
    {
      title: "Production Phase",
      description: "Main production run",
      percentage: 35,
      conditions: ["Production started", "Quality control passed", "Milestones met"],
    },
    {
      title: "Final Delivery",
      description: "Final product delivery and acceptance",
      percentage: 20,
      conditions: ["Products delivered", "Quality acceptance", "Documentation complete"],
    }
  ],

  HIGH_VALUE: [
    {
      title: "Contract Execution",
      description: "Contract signing and initial setup",
      percentage: 10,
      conditions: ["Contract signed", "Initial requirements confirmed"],
    },
    {
      title: "Phase 1 - Foundation",
      description: "Initial groundwork and foundational elements",
      percentage: 20,
      conditions: ["Foundation work completed", "Initial deliverables met"],
    },
    {
      title: "Phase 2 - Development",
      description: "Core development and implementation",
      percentage: 25,
      conditions: ["Development milestones achieved", "Quality reviews passed"],
    },
    {
      title: "Phase 3 - Integration",
      description: "System integration and testing",
      percentage: 25,
      conditions: ["Integration completed", "Testing successful"],
    },
    {
      title: "Final Delivery",
      description: "Final delivery and project completion",
      percentage: 20,
      conditions: ["Final delivery made", "Acceptance criteria met", "Documentation complete"],
    }
  ]
};
