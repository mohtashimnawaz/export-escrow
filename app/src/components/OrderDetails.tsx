'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
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
  DollarSign,
  Calendar,
  MessageCircle,
  FileText,
  Edit
} from 'lucide-react';
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
  const [modalData, setModalData] = useState<any>({});

  const getProgram = () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    
    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'confirmed' }
    );
    
    return new Program(escrowIdl as any, provider);
  };

  const getCurrentUserRole = () => {
    if (!publicKey) return null;
    const userKey = publicKey.toString();
    if (userKey === order.importer) return 'importer';
    if (userKey === order.exporter) return 'exporter';
    if (userKey === order.verifier) return 'verifier';
    return null;
  };

  const executeTransaction = async (instruction: string, params: any = {}) => {
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
          const billOfLadingHash = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256));
          tx = await program.methods
            .shipGoods(billOfLadingHash)
            .accounts({
              order: orderPubkey,
              exporter: publicKey,
            })
            .rpc();
          break;

        case 'confirmDelivery':
          const [escrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('escrow_pda'), orderPubkey.toBuffer()],
            program.programId
          );
          
          tx = await program.methods
            .confirmDelivery()
            .accounts({
              order: orderPubkey,
              signer: publicKey,
              escrowPda,
              exporter: new PublicKey(order.exporter),
              systemProgram: program.provider.publicKey,
            })
            .rpc();
          break;

        case 'disputeOrder':
          tx = await program.methods
            .disputeOrder(params.reason, new BN(Math.floor(Date.now() / 1000)))
            .accounts({
              order: orderPubkey,
              signer: publicKey,
            })
            .rpc();
          break;

        case 'resolveDispute':
          tx = await program.methods
            .resolveDispute(params.resolution, new BN(Math.floor(Date.now() / 1000)))
            .accounts({
              order: orderPubkey,
              verifier: publicKey,
            })
            .rpc();
          break;

        case 'requestExtension':
          const newDeadline = new BN(Math.floor(Date.now() / 1000) + params.extensionDays * 24 * 60 * 60);
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
          </h3>

          {showModal === 'disputeOrder' && (
            <textarea
              placeholder="Reason for dispute..."
              value={modalData.reason || ''}
              onChange={(e) => setModalData({ ...modalData, reason: e.target.value })}
              className="w-full p-3 border rounded-md"
              rows={4}
            />
          )}

          {showModal === 'resolveDispute' && (
            <textarea
              placeholder="Resolution details..."
              value={modalData.resolution || ''}
              onChange={(e) => setModalData({ ...modalData, resolution: e.target.value })}
              className="w-full p-3 border rounded-md"
              rows={4}
            />
          )}

          {showModal === 'requestExtension' && (
            <div>
              <label className="block text-sm font-medium mb-2">Extension Days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={modalData.extensionDays || ''}
                onChange={(e) => setModalData({ ...modalData, extensionDays: parseInt(e.target.value) })}
                className="w-full p-3 border rounded-md"
              />
            </div>
          )}

          {showModal === 'shipGoods' && (
            <p className="text-gray-600 mb-4">
              Confirm that you have shipped the goods. A bill of lading hash will be generated automatically.
            </p>
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm'}
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
                        if (['disputeOrder', 'resolveDispute', 'requestExtension', 'shipGoods'].includes(action.id)) {
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
