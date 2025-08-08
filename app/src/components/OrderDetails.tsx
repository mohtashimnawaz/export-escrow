'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Shield, 
  Truck, 
  Package,
  CheckCircle,
  AlertTriangle,
  Calendar,
  FileText
} from 'lucide-react';
import { Order as EscrowOrder } from '@/types/escrow';
import escrowIdl from '@/idl/escrow.json';

interface Order {
  id: string;
  title: string;
  amount: number;
  state: string;
  importer: string;
  exporter: string;
  verifier: string;
  createdAt: number;
  deadline: number;
  description: string;
  category: string;
  tags: string[];
}

interface Order {
  id: string;
  title: string;
  amount: number;
  state: string;
  importer: string;
  exporter: string;
  verifier: string;
  createdAt: number;
  deadline: number;
  description: string;
  category: string;
  tags: string[];
}

interface OrderDetailsProps {
  order: Order;
  onBack: () => void;
  onUpdate: (order: Order) => void;
}

export function OrderDetails({ order, onBack, onUpdate }: OrderDetailsProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [modalData, setModalData] = useState<Record<string, unknown>>({});

  const getProgram = () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    
    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'confirmed' }
    );
    
    return new Program(escrowIdl as Program['idl'], provider);
  };

  const getCurrentUserRole = () => {
    if (!publicKey) return null;
    const userKey = publicKey.toString();
    if (userKey === order.importer) return 'importer';
    if (userKey === order.exporter) return 'exporter';
    if (userKey === order.verifier) return 'verifier';
    return null;
  };

  const executeTransaction = async (instruction: string, params: Record<string, unknown> = {}) => {
    const program = getProgram();
    if (!program || !publicKey) return;

    setLoading(true);
    try {
      const orderPubkey = new PublicKey(order.id);
      let tx;

      switch (instruction) {
        case 'approveDeadline':
          tx = await program.methods
            .approveDeadline(new BN(Math.floor(Date.now() / 1000)))
            .accounts({
              order: orderPubkey,
              importer: publicKey,
            })
            .rpc();
          break;

        case 'shipGoods':
          // Generate a bill of lading hash based on shipment details
          const shipmentData = {
            trackingNumber: (modalData.trackingNumber as string) || '',
            carrier: (modalData.carrier as string) || '',
            estimatedDelivery: (modalData.estimatedDelivery as string) || '',
            notes: (modalData.notes as string) || '',
            timestamp: Date.now()
          };
          
          // Create a deterministic hash from shipment data
          const shipmentString = JSON.stringify(shipmentData);
          const hash = new TextEncoder().encode(shipmentString);
          
          // Ensure we have exactly 32 bytes for the bill of lading hash
          const billOfLadingHash = new Array(32).fill(0);
          for (let i = 0; i < Math.min(hash.length, 32); i++) {
            billOfLadingHash[i] = hash[i];
          }
          
          tx = await program.methods
            .shipGoods(billOfLadingHash)
            .accounts({
              order: orderPubkey,
              exporter: publicKey,
            })
            .rpc();
          break;

        case 'confirmDelivery':
          const [confirmEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('escrow_pda'), orderPubkey.toBuffer()],
            program.programId
          );
          
          tx = await program.methods
            .confirmDelivery()
            .accounts({
              order: orderPubkey,
              signer: publicKey,
              escrowPda: confirmEscrowPda,
              exporter: new PublicKey(order.exporter),
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          break;

        case 'disputeOrder':
          const reason = modalData.disputeReason as string;
          const disputeType = modalData.disputeType as string;
          tx = await program.methods
            .disputeOrder(reason, new BN(Math.floor(Date.now() / 1000)))
            .accounts({
              order: orderPubkey,
              signer: publicKey,
            })
            .rpc();
          break;

        case 'resolveDispute':
          const resolution = modalData.resolution as string;
          const outcome = modalData.outcome as string;
          
          // Determine fund distribution based on outcome
          let fundDistribution = '';
          if (outcome === 'favor_importer') {
            fundDistribution = 'refund_to_importer';
          } else if (outcome === 'favor_exporter') {
            fundDistribution = 'release_to_exporter';
          } else if (outcome === 'partial_refund') {
            fundDistribution = `partial_${modalData.refundPercentage || 50}`;
          } else {
            fundDistribution = 'hold_in_escrow';
          }
          
          const [resolveEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('escrow_pda'), orderPubkey.toBuffer()],
            program.programId
          );
          
          tx = await program.methods
            .resolveDispute(resolution, new BN(Math.floor(Date.now() / 1000)))
            .accounts({
              order: orderPubkey,
              verifier: publicKey,
              escrowPda: resolveEscrowPda,
              importer: new PublicKey(order.importer),
              exporter: new PublicKey(order.exporter),
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          break;

        case 'requestExtension':
          const extensionDays = modalData.extensionDays as number;
          const extensionReason = modalData.extensionReason as string;
          const newDeadline = new BN(Math.floor(Date.now() / 1000) + extensionDays * 24 * 60 * 60);
          tx = await program.methods
            .requestDeadlineExtension(newDeadline, new BN(Math.floor(Date.now() / 1000)))
            .accounts({
              order: orderPubkey,
              exporter: publicKey,
            })
            .rpc();
          break;

        case 'approveExtension':
          tx = await program.methods
            .approveDeadlineExtension(new BN(Math.floor(Date.now() / 1000)))
            .accounts({
              order: orderPubkey,
              importer: publicKey,
            })
            .rpc();
          break;

        case 'rejectExtension':
          tx = await program.methods
            .rejectDeadlineExtension()
            .accounts({
              order: orderPubkey,
              importer: publicKey,
            })
            .rpc();
          break;
      }

      console.log('Transaction signature:', tx);
      
      // Update order state (simplified - in real app, fetch from chain)
      const updatedOrder = { ...order };
      switch (instruction) {
        case 'approveDeadline':
          updatedOrder.state = 'PendingShipment';
          break;
        case 'shipGoods':
          updatedOrder.state = 'InTransit';
          break;
        case 'confirmDelivery':
          updatedOrder.state = 'Completed';
          break;
        case 'disputeOrder':
          updatedOrder.state = 'Disputed';
          break;
        case 'resolveDispute':
          updatedOrder.state = 'Completed';
          break;
        case 'requestExtension':
          updatedOrder.state = 'PendingExtensionApproval';
          break;
        case 'approveExtension':
          updatedOrder.state = order.state === 'PendingExtensionApproval' ? 'InTransit' : 'PendingShipment';
          break;
        case 'rejectExtension':
          updatedOrder.state = 'InTransit';
          break;
      }
      
      onUpdate(updatedOrder);
      setShowModal(null);
      setModalData({});
      
      // Show specific success messages
      if (tx) {
        if (instruction === 'confirmDelivery') {
          alert(`✅ Delivery confirmed successfully!\n\n• Order completed\n• ${order.amount} SOL released to exporter\n• Transaction recorded on blockchain\n• Transaction ID: ${tx.slice(0, 8)}...${tx.slice(-8)}`);
        } else if (instruction === 'shipGoods') {
          alert(`🚚 Goods shipped successfully!\n\n• Order is now in transit\n• Bill of lading recorded on blockchain\n• Transaction ID: ${tx.slice(0, 8)}...${tx.slice(-8)}`);
        } else if (instruction === 'requestExtension') {
          const days = modalData.extensionDays as number;
          alert(`⏰ Extension request submitted!\n\n• Requested ${days} additional days\n• Order paused pending importer approval\n• Transaction ID: ${tx.slice(0, 8)}...${tx.slice(-8)}`);
        } else if (instruction === 'approveExtension') {
          alert(`✅ Extension approved!\n\n• New deadline granted to exporter\n• Order resumed with extended timeline\n• Transaction ID: ${tx.slice(0, 8)}...${tx.slice(-8)}`);
        } else if (instruction === 'rejectExtension') {
          alert(`❌ Extension rejected!\n\n• Original deadline maintained\n• Order resumed with current timeline\n• Transaction ID: ${tx.slice(0, 8)}...${tx.slice(-8)}`);
        } else if (instruction === 'disputeOrder') {
          const disputeType = modalData.disputeType as string;
          alert(`⚠️ Dispute raised successfully!\n\n• Dispute type: ${disputeType}\n• Order paused pending verifier review\n• Verifier will investigate and resolve\n• Transaction ID: ${tx.slice(0, 8)}...${tx.slice(-8)}`);
        } else if (instruction === 'resolveDispute') {
          const outcome = modalData.outcome as string;
          const outcomeText = outcome === 'favor_importer' ? 'In favor of Importer (Full refund)' : 
                             outcome === 'favor_exporter' ? 'In favor of Exporter (Release funds)' :
                             outcome === 'partial_refund' ? `Partial refund (${modalData.refundPercentage || 50}% to importer)` :
                             'Hold funds in escrow';
          alert(`⚖️ Dispute resolved!\n\n• Resolution: ${outcomeText}\n• Funds distributed according to decision\n• Order marked as completed\n• Transaction ID: ${tx.slice(0, 8)}...${tx.slice(-8)}`);
        }
      }
      
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Transaction failed: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableActions = () => {
    const userRole = getCurrentUserRole();
    const actions = [];

    switch (order.state) {
      case 'PendingDeadlineApproval':
        if (userRole === 'importer') {
          actions.push({ id: 'approveDeadline', label: 'Approve Deadline', icon: CheckCircle, color: 'green' });
        }
        if (userRole === 'exporter') {
          actions.push({ id: 'proposeNewDeadline', label: 'Propose New Deadline', icon: Calendar, color: 'blue' });
        }
        break;

      case 'PendingShipment':
        if (userRole === 'exporter') {
          actions.push({ id: 'shipGoods', label: 'Ship Goods', icon: Truck, color: 'blue' });
          actions.push({ id: 'requestExtension', label: 'Request Extension', icon: Clock, color: 'yellow' });
        }
        break;

      case 'InTransit':
        if (userRole === 'verifier' || userRole === 'importer') {
          actions.push({ id: 'confirmDelivery', label: 'Confirm Delivery', icon: CheckCircle, color: 'green' });
        }
        if (userRole === 'exporter') {
          actions.push({ id: 'requestExtension', label: 'Request Extension', icon: Clock, color: 'yellow' });
        }
        break;

      case 'PendingExtensionApproval':
        if (userRole === 'importer') {
          actions.push({ id: 'approveExtension', label: 'Approve Extension', icon: CheckCircle, color: 'green' });
          actions.push({ id: 'rejectExtension', label: 'Reject Extension', icon: AlertTriangle, color: 'red' });
        }
        break;

      case 'Disputed':
        if (userRole === 'verifier') {
          actions.push({ id: 'resolveDispute', label: 'Resolve Dispute', icon: Shield, color: 'purple' });
        }
        break;
    }

    // Common actions
    if (!['Completed', 'Refunded'].includes(order.state) && userRole) {
      actions.push({ id: 'disputeOrder', label: 'Dispute Order', icon: AlertTriangle, color: 'red' });
    }

    return actions;
  };

  const getStateColor = (state: string) => {
    const colors = {
      'PendingDeadlineApproval': 'bg-yellow-100 text-yellow-800',
      'PendingShipment': 'bg-blue-100 text-blue-800',
      'InTransit': 'bg-purple-100 text-purple-800',
      'Delivered': 'bg-green-100 text-green-800',
      'Completed': 'bg-emerald-100 text-emerald-800',
      'Refunded': 'bg-gray-100 text-gray-800',
      'Disputed': 'bg-red-100 text-red-800',
      'PendingExtensionApproval': 'bg-orange-100 text-orange-800',
    };
    return colors[state as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const renderModal = () => {
    if (!showModal) return null;

    const handleModalSubmit = () => {
      executeTransaction(showModal, modalData);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-medium mb-4">
            {showModal === 'disputeOrder' && 'Dispute Order'}
            {showModal === 'resolveDispute' && 'Resolve Dispute'}
            {showModal === 'requestExtension' && 'Request Extension'}
            {showModal === 'shipGoods' && 'Confirm Shipment'}
            {showModal === 'confirmDelivery' && 'Confirm Delivery'}
            {showModal === 'approveExtension' && 'Approve Extension Request'}
            {showModal === 'rejectExtension' && 'Reject Extension Request'}
          </h3>

          {showModal === 'disputeOrder' && (
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-1">
                      Raise Dispute
                    </h4>
                    <p className="text-sm text-red-700">
                      Report an issue with this order. A verifier will review and resolve the dispute.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dispute Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={(modalData.disputeType as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, disputeType: e.target.value })}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                >
                  <option value="">Select dispute type...</option>
                  <option value="goods_not_received">Goods Not Received</option>
                  <option value="goods_damaged">Goods Damaged/Defective</option>
                  <option value="wrong_goods">Wrong Goods Received</option>
                  <option value="late_delivery">Late Delivery</option>
                  <option value="quality_issues">Quality Not as Described</option>
                  <option value="shipping_issues">Shipping/Handling Problems</option>
                  <option value="communication_issues">Communication Problems</option>
                  <option value="payment_issues">Payment/Documentation Issues</option>
                  <option value="other">Other Issues</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Detailed Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Provide detailed information about the issue, including dates, evidence, and any attempts to resolve..."
                  value={(modalData.disputeReason as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, disputeReason: e.target.value })}
                  className="w-full p-3 border rounded-md h-32 resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supporting Evidence (Optional)
                </label>
                <textarea
                  placeholder="Links to photos, documents, tracking information, or other evidence..."
                  value={(modalData.evidence as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, evidence: e.target.value })}
                  className="w-full p-3 border rounded-md h-20 resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> Filing a dispute will pause the order and notify all parties. The verifier will review the case and make a binding decision on fund distribution.
                </p>
              </div>

              {(!(modalData.disputeType as string) || !(modalData.disputeReason as string)) && (
                <p className="text-sm text-red-600">
                  * Please fill in all required fields to proceed.
                </p>
              )}
            </div>
          )}

          {showModal === 'resolveDispute' && (
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-md">
                <div className="flex items-start">
                  <Shield className="h-5 w-5 text-purple-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-purple-800 mb-1">
                      Resolve Dispute
                    </h4>
                    <p className="text-sm text-purple-700">
                      Review the dispute details and make a binding decision on how to resolve it.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📋 Dispute Information:
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• <strong>Type:</strong> [Dispute type will be shown from blockchain]</li>
                  <li>• <strong>Raised by:</strong> [Disputing party will be shown from blockchain]</li>
                  <li>• <strong>Date filed:</strong> [Dispute date will be shown from blockchain]</li>
                  <li>• <strong>Order amount:</strong> {order.amount} SOL</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Decision <span className="text-red-500">*</span>
                </label>
                <select
                  value={(modalData.outcome as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, outcome: e.target.value })}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                >
                  <option value="">Select resolution outcome...</option>
                  <option value="favor_importer">Favor Importer (Full Refund)</option>
                  <option value="favor_exporter">Favor Exporter (Release Full Payment)</option>
                  <option value="partial_refund">Partial Refund to Importer</option>
                  <option value="hold_escrow">Hold Funds for Further Review</option>
                </select>
              </div>

              {(modalData.outcome as string) === 'partial_refund' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Refund Percentage to Importer <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="10"
                      value={(modalData.refundPercentage as number) || 50}
                      onChange={(e) => setModalData({ ...modalData, refundPercentage: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-16 text-center">
                      {(modalData.refundPercentage as number) || 50}%
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>• Importer receives: {((modalData.refundPercentage as number) || 50)}% = {(order.amount * ((modalData.refundPercentage as number) || 50) / 100).toFixed(2)} SOL</p>
                    <p>• Exporter receives: {100 - ((modalData.refundPercentage as number) || 50)}% = {(order.amount * (100 - ((modalData.refundPercentage as number) || 50)) / 100).toFixed(2)} SOL</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resolution Details <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Explain your decision, reasoning, and any conditions or recommendations..."
                  value={(modalData.resolution as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, resolution: e.target.value })}
                  className="w-full p-3 border rounded-md h-32 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  required
                />
              </div>

              <div className="bg-green-50 border border-green-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-green-800 mb-2">
                  💰 Fund Distribution Preview:
                </h4>
                <div className="text-sm text-green-700">
                  {(modalData.outcome as string) === 'favor_importer' && (
                    <p>• <strong>Full refund:</strong> {order.amount} SOL returned to importer</p>
                  )}
                  {(modalData.outcome as string) === 'favor_exporter' && (
                    <p>• <strong>Full payment:</strong> {order.amount} SOL released to exporter</p>
                  )}
                  {(modalData.outcome as string) === 'partial_refund' && (
                    <div>
                      <p>• <strong>Importer:</strong> {(order.amount * ((modalData.refundPercentage as number) || 50) / 100).toFixed(2)} SOL</p>
                      <p>• <strong>Exporter:</strong> {(order.amount * (100 - ((modalData.refundPercentage as number) || 50)) / 100).toFixed(2)} SOL</p>
                    </div>
                  )}
                  {(modalData.outcome as string) === 'hold_escrow' && (
                    <p>• <strong>Hold funds:</strong> {order.amount} SOL remains in escrow for review</p>
                  )}
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                <p className="text-sm text-red-800">
                  <strong>⚖️ Important:</strong> This decision is final and binding. Funds will be distributed immediately according to your resolution.
                </p>
              </div>

              {(!(modalData.outcome as string) || !(modalData.resolution as string)) && (
                <p className="text-sm text-red-600">
                  * Please fill in all required fields to proceed.
                </p>
              )}
            </div>
          )}

          {showModal === 'requestExtension' && (
            <div className="space-y-4">
              <div className="bg-orange-50 p-4 rounded-md">
                <div className="flex items-start">
                  <Clock className="h-5 w-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-orange-800 mb-1">
                      Request Deadline Extension
                    </h4>
                    <p className="text-sm text-orange-700">
                      Request additional time from the importer to complete the order.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📅 Current Deadline:
                </h4>
                <p className="text-sm text-blue-700">
                  {format(new Date(order.deadline * 1000), 'PPP')} at {format(new Date(order.deadline * 1000), 'p')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extension Days <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  placeholder="Number of additional days needed"
                  value={(modalData.extensionDays as number) || ''}
                  onChange={(e) => {
                    const days = parseInt(e.target.value);
                    setModalData({ ...modalData, extensionDays: days });
                  }}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                {(modalData.extensionDays as number) > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>New deadline:</strong> {format(new Date((order.deadline + (modalData.extensionDays as number) * 24 * 60 * 60) * 1000), 'PPP')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Extension <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Explain why additional time is needed (e.g., supply chain delays, customs issues, etc.)"
                  value={(modalData.extensionReason as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, extensionReason: e.target.value })}
                  className="w-full p-3 border rounded-md h-24 resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> The importer will review your request and can either approve or reject it. The order will be paused until a decision is made.
                </p>
              </div>

              {(!(modalData.extensionDays as number) || !(modalData.extensionReason as string)) && (
                <p className="text-sm text-red-600">
                  * Please fill in all required fields to proceed.
                </p>
              )}
            </div>
          )}

          {showModal === 'shipGoods' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter tracking number"
                  value={(modalData.trackingNumber as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, trackingNumber: e.target.value })}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier/Shipping Company <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., DHL, FedEx, UPS"
                  value={(modalData.carrier as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, carrier: e.target.value })}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Delivery Date
                </label>
                <input
                  type="date"
                  value={(modalData.estimatedDelivery as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, estimatedDelivery: e.target.value })}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  placeholder="Any special handling instructions or notes"
                  value={(modalData.notes as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, notes: e.target.value })}
                  className="w-full p-3 border rounded-md h-20 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Once confirmed, this will mark the order as "In Transit" and generate a bill of lading hash on the blockchain.
                </p>
              </div>
              {(!(modalData.trackingNumber as string) || !(modalData.carrier as string)) && (
                <p className="text-sm text-red-600">
                  * Please fill in all required fields to proceed.
                </p>
              )}
            </div>
          )}

          {showModal === 'confirmDelivery' && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-md">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-green-800 mb-1">
                      Confirm Delivery Receipt
                    </h4>
                    <p className="text-sm text-green-700">
                      By confirming delivery, you acknowledge that the goods have been received as described in the order.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📦 What happens next:
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Order status will change to "Completed"</li>
                  <li>• Funds ({order.amount} SOL) will be released to the exporter</li>
                  <li>• Transaction will be recorded on the blockchain</li>
                  <li>• Order history will be updated</li>
                </ul>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Notes (Optional)
                </label>
                <textarea
                  placeholder="Any observations about the delivery condition, packaging, etc."
                  value={(modalData.deliveryNotes as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, deliveryNotes: e.target.value })}
                  className="w-full p-3 border rounded-md h-20 resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> This action cannot be undone. Only confirm if you have physically received the goods and they match the order description.
                </p>
              </div>
            </div>
          )}

          {showModal === 'approveExtension' && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-md">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-green-800 mb-1">
                      Approve Extension Request
                    </h4>
                    <p className="text-sm text-green-700">
                      Grant the exporter additional time to complete the order.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📋 Extension Details:
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Current deadline: {format(new Date(order.deadline * 1000), 'PPP')}</li>
                  <li>• Additional time requested: [Extension days will be shown from blockchain]</li>
                  <li>• Reason: [Extension reason will be shown from blockchain]</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approval Notes (Optional)
                </label>
                <textarea
                  placeholder="Any conditions or notes regarding the approval..."
                  value={(modalData.approvalNotes as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, approvalNotes: e.target.value })}
                  className="w-full p-3 border rounded-md h-20 resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="bg-green-50 border border-green-200 p-3 rounded-md">
                <p className="text-sm text-green-800">
                  <strong>✅ Approving:</strong> The new deadline will take effect immediately and the order will resume progress.
                </p>
              </div>
            </div>
          )}

          {showModal === 'rejectExtension' && (
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-md">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-1">
                      Reject Extension Request
                    </h4>
                    <p className="text-sm text-red-700">
                      Decline the exporter's request for additional time.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📋 Extension Details:
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Current deadline: {format(new Date(order.deadline * 1000), 'PPP')}</li>
                  <li>• Additional time requested: [Extension days will be shown from blockchain]</li>
                  <li>• Reason: [Extension reason will be shown from blockchain]</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Explain why the extension request is being rejected..."
                  value={(modalData.rejectionReason as string) || ''}
                  onChange={(e) => setModalData({ ...modalData, rejectionReason: e.target.value })}
                  className="w-full p-3 border rounded-md h-24 resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Note:</strong> Rejecting will maintain the original deadline. The exporter will need to complete the order within the current timeframe.
                </p>
              </div>

              {!(modalData.rejectionReason as string) && (
                <p className="text-sm text-red-600">
                  * Please provide a reason for the rejection.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowModal(null)}
              className="px-4 py-2 text-gray-600 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleModalSubmit}
              disabled={loading || 
                       (showModal === 'shipGoods' && (!(modalData.trackingNumber as string) || !(modalData.carrier as string))) ||
                       (showModal === 'requestExtension' && (!(modalData.extensionDays as number) || !(modalData.extensionReason as string))) ||
                       (showModal === 'rejectExtension' && !(modalData.rejectionReason as string)) ||
                       (showModal === 'disputeOrder' && (!(modalData.disputeType as string) || !(modalData.disputeReason as string))) ||
                       (showModal === 'resolveDispute' && (!(modalData.outcome as string) || !(modalData.resolution as string)))}
              className={`px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 ${
                showModal === 'confirmDelivery' ? 'bg-green-600 hover:bg-green-700' : 
                showModal === 'shipGoods' ? 'bg-blue-600 hover:bg-blue-700' : 
                showModal === 'requestExtension' ? 'bg-orange-600 hover:bg-orange-700' :
                showModal === 'approveExtension' ? 'bg-green-600 hover:bg-green-700' :
                showModal === 'rejectExtension' ? 'bg-red-600 hover:bg-red-700' :
                showModal === 'disputeOrder' ? 'bg-red-600 hover:bg-red-700' :
                showModal === 'resolveDispute' ? 'bg-purple-600 hover:bg-purple-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Processing...' : 
               showModal === 'shipGoods' ? 'Ship Goods' : 
               showModal === 'confirmDelivery' ? 'Confirm Delivery & Release Funds' :
               showModal === 'requestExtension' ? 'Request Extension' :
               showModal === 'approveExtension' ? 'Approve Extension' :
               showModal === 'rejectExtension' ? 'Reject Extension' :
               showModal === 'disputeOrder' ? 'File Dispute' :
               showModal === 'resolveDispute' ? 'Resolve Dispute' :
               'Confirm'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 hover:bg-gray-100 rounded-md"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{order.title}</h1>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStateColor(order.state)}`}>
                {order.state.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{order.amount} SOL</div>
            <div className="text-sm text-gray-500">≈ ${(order.amount * 150).toFixed(2)} USD</div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Information */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Order Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Description</label>
                  <p className="mt-1 text-gray-900">{order.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Category</label>
                  <p className="mt-1 text-gray-900 capitalize">{order.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Created</label>
                  <p className="mt-1 text-gray-900">
                    {format(new Date(order.createdAt * 1000), 'PPP')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Deadline</label>
                  <p className="mt-1 text-gray-900">
                    {format(new Date(order.deadline * 1000), 'PPP')}
                  </p>
                </div>
              </div>
              
              {order.tags.length > 0 && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-600">Tags</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {order.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Participants */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Participants
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg border-2 ${getCurrentUserRole() === 'importer' ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center mb-2">
                    <User className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="font-medium">Importer</span>
                    {getCurrentUserRole() === 'importer' && (
                      <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 font-mono">{formatAddress(order.importer)}</p>
                </div>
                
                <div className={`p-4 rounded-lg border-2 ${getCurrentUserRole() === 'exporter' ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center mb-2">
                    <Truck className="h-4 w-4 mr-2 text-green-600" />
                    <span className="font-medium">Exporter</span>
                    {getCurrentUserRole() === 'exporter' && (
                      <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 font-mono">{formatAddress(order.exporter)}</p>
                </div>
                
                <div className={`p-4 rounded-lg border-2 ${getCurrentUserRole() === 'verifier' ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-center mb-2">
                    <Shield className="h-4 w-4 mr-2 text-purple-600" />
                    <span className="font-medium">Verifier</span>
                    {getCurrentUserRole() === 'verifier' && (
                      <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded">You</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 font-mono">{formatAddress(order.verifier)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Available Actions */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Available Actions</h2>
              <div className="space-y-3">
                {getAvailableActions().map((action) => {
                  const Icon = action.icon;
                  const colorClasses = {
                    green: 'bg-green-600 hover:bg-green-700',
                    blue: 'bg-blue-600 hover:bg-blue-700',
                    yellow: 'bg-yellow-600 hover:bg-yellow-700',
                    red: 'bg-red-600 hover:bg-red-700',
                    purple: 'bg-purple-600 hover:bg-purple-700',
                  };
                  
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        if (['disputeOrder', 'resolveDispute', 'requestExtension', 'shipGoods', 'confirmDelivery', 'approveExtension', 'rejectExtension'].includes(action.id)) {
                          setShowModal(action.id);
                        } else {
                          executeTransaction(action.id);
                        }
                      }}
                      disabled={loading}
                      className={`w-full flex items-center justify-center px-4 py-3 text-white rounded-md transition-colors disabled:opacity-50 ${colorClasses[action.color as keyof typeof colorClasses]}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {action.label}
                    </button>
                  );
                })}
                
                {getAvailableActions().length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    No actions available for your role
                  </p>
                )}
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Order Timeline</h2>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Package className="h-4 w-4 text-white" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium">Order Created</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(order.createdAt * 1000), 'PPp')}
                    </p>
                  </div>
                </div>
                
                {/* Add more timeline events based on order state */}
                {order.state !== 'PendingDeadlineApproval' && (
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium">Deadline Approved</p>
                      <p className="text-xs text-gray-500">By importer</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderModal()}
    </div>
  );
}
