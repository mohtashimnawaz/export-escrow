'use client';

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { X, User, Shield, Package } from 'lucide-react';
import escrowIdl from '@/idl/escrow.json';

interface CreateOrderModalProps {
  onClose: () => void;
  onOrderCreated: (order: any) => void;
}

export function CreateOrderModal({ onClose, onOrderCreated }: CreateOrderModalProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !signTransaction || !signAllTransactions) return;

    setLoading(true);
    try {
      // Create provider
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction, signAllTransactions },
        { commitment: 'confirmed' }
      );

      // Create program instance
      const program = new Program(escrowIdl as any, provider);

      // Generate order keypair
      const orderKeypair = Keypair.generate();

      // Calculate escrow PDA
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow_pda'), orderKeypair.publicKey.toBuffer()],
        program.programId
      );

      // Prepare metadata
      const metadata = {
        title: formData.title,
        description: formData.description,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        category: formData.category,
      };

      // Calculate timestamps
      const creationTime = Math.floor(Date.now() / 1000);
      const deadlineSeconds = parseInt(formData.deadlineDays) * 24 * 60 * 60 + 
                             parseInt(formData.deadlineHours) * 60 * 60;
      const proposedDeadline = creationTime + deadlineSeconds;

      // Convert amount to lamports
      const amount = new BN(parseFloat(formData.amount) * LAMPORTS_PER_SOL);

      // Create transaction
      const tx = await program.methods
        .createOrder(
          new PublicKey(formData.exporterAddress),
          new PublicKey(formData.verifierAddress),
          amount,
          new BN(proposedDeadline),
          new BN(creationTime),
          metadata,
          null // No SPL token mint (using SOL)
        )
        .accounts({
          order: orderKeypair.publicKey,
          importer: publicKey,
          escrowPda,
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([orderKeypair])
        .rpc();

      console.log('Transaction signature:', tx);

      // Create order object for UI
      const newOrder = {
        id: orderKeypair.publicKey.toString(),
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: metadata.tags,
        amount: parseFloat(formData.amount),
        state: 'PendingDeadlineApproval',
        importer: publicKey.toString(),
        exporter: formData.exporterAddress,
        verifier: formData.verifierAddress,
        createdAt: creationTime,
        deadline: proposedDeadline,
      };

      onOrderCreated(newOrder);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Solana public key"
              />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Solana public key"
              />
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
