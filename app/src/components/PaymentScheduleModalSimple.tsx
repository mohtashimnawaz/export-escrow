'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { 
  X, 
  DollarSign, 
  Target,
  Plus,
  Minus,
  AlertTriangle
} from 'lucide-react';
import { TokenUtils } from '@/utils/tokenUtils';

interface PaymentMilestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  percentage: number;
  status: 'pending' | 'submitted' | 'approved' | 'paid' | 'disputed' | 'cancelled';
  conditions: string[];
  dueDate?: Date;
}

interface PaymentSchedule {
  id: string;
  orderId: string;
  totalAmount: number;
  currency: string;
  milestones: PaymentMilestone[];
  createdAt: number;
  updatedAt: number;
}

interface PaymentScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onScheduleCreated: (schedule: PaymentSchedule) => void;
}

// Predefined milestone templates
const MILESTONE_TEMPLATES = {
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

export function PaymentScheduleModal({ 
  isOpen, 
  onClose, 
  order, 
  onScheduleCreated 
}: PaymentScheduleModalProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('THREE_PHASE');
  const [customMilestones, setCustomMilestones] = useState<Omit<PaymentMilestone, 'id' | 'status'>[]>([]);
  const [useTemplate, setUseTemplate] = useState(true);

  const tokenUtils = new TokenUtils(connection);
  const templates = Object.entries(MILESTONE_TEMPLATES);

  const addCustomMilestone = () => {
    setCustomMilestones([
      ...customMilestones,
      {
        title: '',
        description: '',
        amount: 0,
        percentage: 0,
        conditions: [],
        dueDate: undefined
      }
    ]);
  };

  const updateCustomMilestone = (index: number, field: string, value: any) => {
    const updated = [...customMilestones];
    updated[index] = { ...updated[index], [field]: value };
    setCustomMilestones(updated);
  };

  const removeCustomMilestone = (index: number) => {
    setCustomMilestones(customMilestones.filter((_, i) => i !== index));
  };

  const getTotalPercentage = () => {
    const milestones = useTemplate 
      ? MILESTONE_TEMPLATES[selectedTemplate as keyof typeof MILESTONE_TEMPLATES]
      : customMilestones;
    return milestones.reduce((sum: number, m: any) => sum + m.percentage, 0);
  };

  const handleCreateSchedule = async () => {
    if (!publicKey) return;

    const totalPercentage = getTotalPercentage();
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`Total percentage must equal 100%, currently ${totalPercentage.toFixed(1)}%`);
      return;
    }

    setLoading(true);
    try {
      const milestones = useTemplate 
        ? MILESTONE_TEMPLATES[selectedTemplate as keyof typeof MILESTONE_TEMPLATES]
        : customMilestones;

      // Calculate milestone amounts
      const milestonesWithAmounts = milestones.map((milestone: any) => ({
        ...milestone,
        amount: (order.amount * milestone.percentage) / 100
      }));

      const schedule: PaymentSchedule = {
        id: `schedule_${order.id}_${Date.now()}`,
        orderId: order.id,
        totalAmount: order.amount,
        currency: order.currency.symbol,
        milestones: milestonesWithAmounts.map((milestone: any, index: number) => ({
          ...milestone,
          id: `milestone_${index + 1}`,
          status: 'pending' as const,
        })),
        createdAt: Date.now() / 1000,
        updatedAt: Date.now() / 1000,
      };

      console.log('Payment schedule created:', schedule);
      onScheduleCreated(schedule);
      onClose();

      const templateName = useTemplate ? selectedTemplate.replace('_', ' ') : 'Custom';
      alert(`✅ Payment schedule created!\n\n• Template: ${templateName}\n• Milestones: ${milestones.length}\n• Total Amount: ${tokenUtils.formatTokenAmount(order.amount, order.currency.decimals)} ${order.currency.symbol}`);

    } catch (error) {
      console.error('Error creating payment schedule:', error);
      alert('Failed to create payment schedule: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentMilestones = useTemplate 
    ? MILESTONE_TEMPLATES[selectedTemplate as keyof typeof MILESTONE_TEMPLATES]
    : customMilestones;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <DollarSign className="h-6 w-6 mr-2" />
            Create Payment Schedule
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Order Summary */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
            <h3 className="text-lg font-medium text-blue-900 mb-2">Order Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-800">Title:</span>
                <p className="text-blue-700">{order.title}</p>
              </div>
              <div>
                <span className="font-medium text-blue-800">Total Amount:</span>
                <p className="text-blue-700 flex items-center">
                  {order.currency.logoURI && (
                    <img src={order.currency.logoURI} alt={order.currency.symbol} className="h-4 w-4 mr-1" />
                  )}
                  {tokenUtils.formatTokenAmount(order.amount, order.currency.decimals)} {order.currency.symbol}
                </p>
              </div>
              <div>
                <span className="font-medium text-blue-800">State:</span>
                <p className="text-blue-700">{order.state.replace(/([A-Z])/g, ' $1').trim()}</p>
              </div>
            </div>
          </div>

          {/* Template Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Payment Structure</h3>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useTemplate}
                  onChange={() => setUseTemplate(true)}
                  className="mr-2"
                />
                Use Template
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useTemplate}
                  onChange={() => setUseTemplate(false)}
                  className="mr-2"
                />
                Custom Schedule
              </label>
            </div>

            {useTemplate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {templates.map(([key, template]) => (
                    <option key={key} value={key}>
                      {key.replace('_', ' ')} ({template.length} milestones)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Milestone Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Payment Milestones</h3>
              {!useTemplate && (
                <button
                  onClick={addCustomMilestone}
                  className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Milestone
                </button>
              )}
            </div>

            <div className="space-y-3">
              {currentMilestones.map((milestone: any, index: number) => {
                const amount = (order.amount * milestone.percentage) / 100;
                
                return (
                  <div key={index} className="border rounded-md p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {useTemplate ? (
                          <>
                            <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Milestone title"
                              value={milestone.title}
                              onChange={(e) => updateCustomMilestone(index, 'title', e.target.value)}
                              className="w-full p-2 border rounded-md text-sm"
                            />
                            <textarea
                              placeholder="Milestone description"
                              value={milestone.description}
                              onChange={(e) => updateCustomMilestone(index, 'description', e.target.value)}
                              className="w-full p-2 border rounded-md text-sm h-16 resize-none"
                            />
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4 mt-2">
                          <div className="flex items-center">
                            <Target className="h-4 w-4 text-green-600 mr-1" />
                            <span className="text-sm font-medium text-green-600">
                              {milestone.percentage}%
                            </span>
                          </div>
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 text-blue-600 mr-1" />
                            <span className="text-sm font-medium text-blue-600">
                              {tokenUtils.formatTokenAmount(amount, order.currency.decimals)} {order.currency.symbol}
                            </span>
                          </div>
                        </div>

                        {milestone.conditions && milestone.conditions.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-500">
                              Conditions: {milestone.conditions.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>

                      {!useTemplate && (
                        <div className="flex items-center space-x-2 ml-4">
                          <input
                            type="number"
                            placeholder="%"
                            value={milestone.percentage || ''}
                            onChange={(e) => updateCustomMilestone(index, 'percentage', parseFloat(e.target.value) || 0)}
                            className="w-16 p-1 border rounded text-sm text-center"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                          <button
                            onClick={() => removeCustomMilestone(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Percentage Check */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <span className="font-medium text-gray-700">Total Percentage:</span>
              <span className={`font-bold ${Math.abs(getTotalPercentage() - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                {getTotalPercentage().toFixed(1)}%
              </span>
            </div>

            {Math.abs(getTotalPercentage() - 100) > 0.01 && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm text-red-800">
                    Total percentage must equal 100%. Currently {getTotalPercentage().toFixed(1)}%.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Benefits Info */}
          <div className="bg-green-50 border border-green-200 p-4 rounded-md">
            <h4 className="text-sm font-medium text-green-800 mb-2">
              💰 Partial Payment Benefits:
            </h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• <strong>Risk Reduction:</strong> Payments tied to milestone completion</li>
              <li>• <strong>Cash Flow:</strong> Steady payments throughout the order lifecycle</li>
              <li>• <strong>Quality Control:</strong> Approval gates ensure standards are met</li>
              <li>• <strong>Transparency:</strong> Clear expectations and progress tracking</li>
              <li>• <strong>Flexibility:</strong> Ability to handle partial refunds if needed</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateSchedule}
            disabled={loading || Math.abs(getTotalPercentage() - 100) > 0.01 || currentMilestones.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Payment Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
