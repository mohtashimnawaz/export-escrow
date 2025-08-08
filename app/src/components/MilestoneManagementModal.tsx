'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { 
  X, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  DollarSign,
  User,
  Calendar,
  MessageSquare,
  Upload,
  FileText,
  Star,
  Target,
  TrendingUp,
  Zap
} from 'lucide-react';
import { PaymentSchedule, PaymentMilestone, PaymentManager } from '@/utils/paymentUtils';
import { TokenUtils } from '@/utils/tokenUtils';
import { Order } from '@/types/escrow';

interface MilestoneManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  schedule: PaymentSchedule;
  userRole: 'buyer' | 'seller' | 'arbiter';
  onMilestoneUpdate: (milestoneId: string, action: string) => void;
}

export function MilestoneManagementModal({ 
  isOpen, 
  onClose, 
  order, 
  schedule, 
  userRole,
  onMilestoneUpdate 
}: MilestoneManagementModalProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  const tokenUtils = new TokenUtils(connection);
  const paymentManager = new PaymentManager(connection);

  const getStatusColor = (status: PaymentMilestone['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'submitted': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'paid': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'disputed': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: PaymentMilestone['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'submitted': return <Upload className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'paid': return <DollarSign className="h-4 w-4" />;
      case 'disputed': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const canSubmitMilestone = (milestone: PaymentMilestone) => {
    return userRole === 'seller' && milestone.status === 'pending';
  };

  const canApproveMilestone = (milestone: PaymentMilestone) => {
    return userRole === 'buyer' && milestone.status === 'submitted';
  };

  const canProcessPayment = (milestone: PaymentMilestone) => {
    return userRole === 'buyer' && milestone.status === 'approved';
  };

  const handleSubmitMilestone = async (milestoneId: string) => {
    if (!publicKey) return;

    setLoading(true);
    try {
      // In a real implementation, this would upload evidence and submit to blockchain
      console.log('Submitting milestone:', milestoneId, { note: submissionNote, files: evidenceFiles });

      // Simulate milestone submission
      onMilestoneUpdate(milestoneId, 'submit');
      setSubmissionNote('');
      setEvidenceFiles([]);
      setSelectedMilestone(null);

      alert('✅ Milestone submitted for approval!\n\nThe buyer will be notified to review your submission.');

    } catch (error) {
      console.error('Error submitting milestone:', error);
      alert('Failed to submit milestone: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMilestone = async (milestoneId: string) => {
    if (!publicKey) return;

    setLoading(true);
    try {
      const milestone = schedule.milestones.find(m => m.id === milestoneId);
      if (!milestone) throw new Error('Milestone not found');

      console.log('Approving milestone:', milestoneId, { note: approvalNote });

      // Simulate milestone approval
      onMilestoneUpdate(milestoneId, 'approve');
      setApprovalNote('');
      setSelectedMilestone(null);

      alert(`✅ Milestone approved!\n\nAmount: ${tokenUtils.formatTokenAmount(milestone.amount, order.currency.decimals)} ${order.currency.symbol}\nReady for payment processing.`);

    } catch (error) {
      console.error('Error approving milestone:', error);
      alert('Failed to approve milestone: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayment = async (milestoneId: string) => {
    if (!publicKey) return;

    setLoading(true);
    try {
      const milestone = schedule.milestones.find(m => m.id === milestoneId);
      if (!milestone) throw new Error('Milestone not found');

      // In a real implementation, this would process the payment on-chain
      console.log('Processing payment for milestone:', milestoneId);

      // Simulate payment processing
      onMilestoneUpdate(milestoneId, 'pay');

      alert(`💰 Payment processed!\n\nAmount: ${tokenUtils.formatTokenAmount(milestone.amount, order.currency.decimals)} ${order.currency.symbol}\nTransaction completed successfully.`);

    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Failed to process payment: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisputeMilestone = async (milestoneId: string) => {
    if (!publicKey) return;

    const reason = prompt('Please provide a reason for the dispute:');
    if (!reason) return;

    setLoading(true);
    try {
      console.log('Disputing milestone:', milestoneId, { reason });

      // Simulate dispute creation
      onMilestoneUpdate(milestoneId, 'dispute');

      alert('⚠️ Milestone disputed!\n\nAn arbiter will be assigned to review this case.');

    } catch (error) {
      console.error('Error disputing milestone:', error);
      alert('Failed to dispute milestone: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = () => {
    const completed = schedule.milestones.filter(m => m.status === 'paid').length;
    return (completed / schedule.milestones.length) * 100;
  };

  const getTotalPaid = () => {
    return schedule.milestones
      .filter(m => m.status === 'paid')
      .reduce((sum, m) => sum + m.amount, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Target className="h-6 w-6 mr-2" />
              Milestone Management
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Managing as: <span className="font-medium capitalize">{userRole}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Overview */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{schedule.milestones.length}</div>
              <div className="text-sm text-gray-600">Total Milestones</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{Math.round(getProgress())}%</div>
              <div className="text-sm text-gray-600">Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 flex items-center justify-center">
                {order.currency.logoURI && (
                  <img src={order.currency.logoURI} alt={order.currency.symbol} className="h-6 w-6 mr-1" />
                )}
                {tokenUtils.formatTokenAmount(getTotalPaid(), order.currency.decimals)}
              </div>
              <div className="text-sm text-gray-600">Paid Out</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 flex items-center justify-center">
                {order.currency.logoURI && (
                  <img src={order.currency.logoURI} alt={order.currency.symbol} className="h-6 w-6 mr-1" />
                )}
                {tokenUtils.formatTokenAmount(schedule.totalAmount - getTotalPaid(), order.currency.decimals)}
              </div>
              <div className="text-sm text-gray-600">Remaining</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Overall Progress</span>
              <span>{Math.round(getProgress())}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${getProgress()}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Milestones List */}
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Payment Milestones</h3>
          
          {schedule.milestones.map((milestone, index) => (
            <div key={milestone.id} className="border rounded-lg p-4 space-y-3">
              {/* Milestone Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">
                      #{index + 1}
                    </span>
                    <h4 className="font-medium text-gray-900">{milestone.title}</h4>
                    <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(milestone.status)}`}>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(milestone.status)}
                        <span className="capitalize">{milestone.status}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-lg font-bold text-gray-900">
                    {order.currency.logoURI && (
                      <img src={order.currency.logoURI} alt={order.currency.symbol} className="h-5 w-5 mr-1" />
                    )}
                    {tokenUtils.formatTokenAmount(milestone.amount, order.currency.decimals)} {order.currency.symbol}
                  </div>
                  <div className="text-sm text-gray-500">{milestone.percentage}% of total</div>
                </div>
              </div>

              {/* Milestone Details */}
              {milestone.conditions && milestone.conditions.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                  <p className="text-sm font-medium text-blue-800 mb-1">Required Conditions:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {milestone.conditions.map((condition, i) => (
                      <li key={i} className="flex items-center">
                        <CheckCircle className="h-3 w-3 mr-2" />
                        {condition}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Due Date */}
              {milestone.dueDate && (
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-1" />
                  Due: {new Date(milestone.dueDate).toLocaleDateString()}
                </div>
              )}

              {/* Approval History */}
              {milestone.approvals && milestone.approvals.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-800 mb-2">Approval History:</p>
                  <div className="space-y-2">
                    {milestone.approvals.map((approval, i) => (
                      <div key={i} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{approval.role}</span>
                          <span className="text-gray-500">
                            {new Date(approval.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {approval.note && (
                          <p className="text-gray-600 mt-1">{approval.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                {canSubmitMilestone(milestone) && (
                  <button
                    onClick={() => setSelectedMilestone(milestone.id)}
                    className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Submit for Approval
                  </button>
                )}

                {canApproveMilestone(milestone) && (
                  <button
                    onClick={() => setSelectedMilestone(milestone.id)}
                    className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </button>
                )}

                {canProcessPayment(milestone) && (
                  <button
                    onClick={() => handleProcessPayment(milestone.id)}
                    disabled={loading}
                    className="flex items-center px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Process Payment
                  </button>
                )}

                {(milestone.status === 'submitted' || milestone.status === 'approved') && (
                  <button
                    onClick={() => handleDisputeMilestone(milestone.id)}
                    className="flex items-center px-3 py-2 text-sm border border-red-600 text-red-600 rounded-md hover:bg-red-50"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Dispute
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Modal */}
        {selectedMilestone && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-md w-full mx-4">
              {(() => {
                const milestone = schedule.milestones.find(m => m.id === selectedMilestone);
                if (!milestone) return null;

                const isSubmitting = canSubmitMilestone(milestone);
                const isApproving = canApproveMilestone(milestone);

                return (
                  <>
                    <div className="p-6 border-b">
                      <h3 className="text-lg font-medium text-gray-900">
                        {isSubmitting ? 'Submit Milestone' : 'Approve Milestone'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{milestone.title}</p>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {isSubmitting ? 'Submission Note' : 'Approval Note'}
                        </label>
                        <textarea
                          value={isSubmitting ? submissionNote : approvalNote}
                          onChange={(e) => isSubmitting ? setSubmissionNote(e.target.value) : setApprovalNote(e.target.value)}
                          placeholder={isSubmitting ? 'Describe what has been completed...' : 'Review notes and feedback...'}
                          className="w-full p-3 border rounded-md h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      {isSubmitting && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Evidence Files (optional)
                          </label>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))}
                            className="w-full p-2 border rounded-md text-sm"
                            accept="image/*,.pdf,.doc,.docx"
                          />
                          {evidenceFiles.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              {evidenceFiles.length} file(s) selected
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 p-6 border-t">
                      <button
                        onClick={() => {
                          setSelectedMilestone(null);
                          setSubmissionNote('');
                          setApprovalNote('');
                          setEvidenceFiles([]);
                        }}
                        className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => isSubmitting ? handleSubmitMilestone(selectedMilestone) : handleApproveMilestone(selectedMilestone)}
                        disabled={loading}
                        className={`px-6 py-2 text-white rounded-md disabled:opacity-50 ${
                          isSubmitting ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {loading ? 'Processing...' : (isSubmitting ? 'Submit' : 'Approve')}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
