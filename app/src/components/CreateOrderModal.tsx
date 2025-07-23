'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { X, User, Shield } from 'lucide-react';
import { Order } from '@/types/escrow';
import { useNotifications } from './Notifications';
import escrowIdl from '@/idl/escrow.json';

interface CreateOrderModalProps {
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
}

export function CreateOrderModal({ onClose, onOrderCreated }: CreateOrderModalProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
  const { success, error } = useNotifications();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    exporterAddress: '',
    verifierAddress: '',
    amount: '',
    deadlineDays: '7',
    deadlineHours: '0',
  });

  const getProgram = () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    
    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'confirmed' }
    );
    
    return new Program(escrowIdl as Program['idl'], provider);
  };

  const fillSampleData = () => {
    setFormData({
      title: 'Electronics Import Order',
      description: 'Import of electronic components including microcontrollers, sensors, and LED displays for manufacturing.',
      category: 'electronics',
      tags: 'urgent, high-value, fragile',
      exporterAddress: 'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjb',
      verifierAddress: '4fYNw3dojWmQ3dTHTHNGrMGqaNi7k2mXpbXbPULBNsXb',
      amount: '25.5',
      deadlineDays: '14',
      deadlineHours: '0',
    });
  };

  const validateAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey || !signTransaction || !signAllTransactions) {
      error('Wallet Not Connected', 'Please connect your wallet first');
      return;
    }

    // Validate addresses
    if (!validateAddress(formData.exporterAddress)) {
      error('Invalid Address', 'Please enter a valid exporter wallet address');
      return;
    }

    if (!validateAddress(formData.verifierAddress)) {
      error('Invalid Address', 'Please enter a valid verifier wallet address');
      return;
    }

    const program = getProgram();
    if (!program) {
      error('Program Error', 'Failed to initialize escrow program');
      return;
    }

    setLoading(true);
    
    try {
      // Generate a new keypair for the order
      const orderKeypair = Keypair.generate();
      
      // Find PDA for escrow
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow_pda'), orderKeypair.publicKey.toBuffer()],
        program.programId
      );

      // Calculate deadline timestamp
      const deadlineMs = Date.now() + 
        (parseInt(formData.deadlineDays) * 24 * 60 * 60 * 1000) + 
        (parseInt(formData.deadlineHours) * 60 * 60 * 1000);
      
      const amount = new BN(parseFloat(formData.amount) * LAMPORTS_PER_SOL);
      const deadline = new BN(Math.floor(deadlineMs / 1000));
      const creation_time = new BN(Math.floor(Date.now() / 1000));
      const metadata = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        category: formData.category,
      };
      
      const tx = await program.methods
        .createOrder(
          new PublicKey(formData.exporterAddress),
          new PublicKey(formData.verifierAddress),
          amount,
          deadline,
          creation_time,
          metadata,
          null
        )
        .accounts({
          order: orderKeypair.publicKey,
          importer: publicKey,
          escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([orderKeypair])
        .rpc();

      console.log('Order created with signature:', tx);

      // Create order object for the frontend
      const newOrder: Order = {
        id: orderKeypair.publicKey.toString(),
        title: formData.title,
        amount: parseFloat(formData.amount),
        state: 'PendingDeadlineApproval',
        importer: publicKey.toString(),
        exporter: formData.exporterAddress,
        verifier: formData.verifierAddress,
        createdAt: creation_time.toNumber(),
        deadline: Math.floor(deadlineMs / 1000),
        description: formData.description,
        category: formData.category,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      success('Order Created', `Order "${formData.title}" has been created successfully!`);
      onOrderCreated(newOrder);
      
    } catch (err) {
      console.error('Error creating order:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      error('Transaction Failed', `Failed to create order: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={fillSampleData}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md"
            >
              Fill Sample Data
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Order Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Electronics Import Order"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                <option value="electronics">Electronics</option>
                <option value="textiles">Textiles</option>
                <option value="machinery">Machinery</option>
                <option value="food">Food & Beverages</option>
                <option value="automotive">Automotive</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the goods being imported..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="urgent, bulk, fragile"
            />
          </div>

          {/* Participants */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Exporter Address *
              </label>
              <input
                type="text"
                required
                value={formData.exporterAddress}
                onChange={(e) => setFormData({...formData, exporterAddress: e.target.value})}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  formData.exporterAddress && !validateAddress(formData.exporterAddress)
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjb"
              />
              {formData.exporterAddress && !validateAddress(formData.exporterAddress) && (
                <p className="mt-1 text-sm text-red-600">Invalid Solana address</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Shield className="inline h-4 w-4 mr-1" />
                Verifier Address *
              </label>
              <input
                type="text"
                required
                value={formData.verifierAddress}
                onChange={(e) => setFormData({...formData, verifierAddress: e.target.value})}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  formData.verifierAddress && !validateAddress(formData.verifierAddress)
                    ? 'border-red-300 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="4fYNw3dojWmQ3dTHTHNGrMGqaNi7k2mXpbXbPULBNsXb"
              />
              {formData.verifierAddress && !validateAddress(formData.verifierAddress) && (
                <p className="mt-1 text-sm text-red-600">Invalid Solana address</p>
              )}
            </div>
          </div>

          {/* Amount and Deadline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (SOL) *
              </label>
              <input
                type="number"
                required
                step="0.001"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline (Days) *
              </label>
              <input
                type="number"
                required
                min="0"
                max="30"
                value={formData.deadlineDays}
                onChange={(e) => setFormData({...formData, deadlineDays: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extra Hours
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={formData.deadlineHours}
                onChange={(e) => setFormData({...formData, deadlineHours: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
