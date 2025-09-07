'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '../../components/ui/ModernLayout';
import { ToastProvider, useToast, LoadingButton } from '../../components/ui/ToastSystem';
import { TokenIcon } from '../../components/ui/TokenIcon';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const tokens = [
  { symbol: 'SOL', name: 'Solana', decimals: 9, mint: 'So11111111111111111111111111111111111111112' },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { symbol: 'USDT', name: 'Tether USD', decimals: 6, mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  { symbol: 'mSOL', name: 'Marinade Staked SOL', decimals: 9, mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So' },
  { symbol: 'BONK', name: 'Bonk', decimals: 5, mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JUP', name: 'Jupiter', decimals: 6, mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' }
];

const categories = [
  'Electronics',
  'Textiles',
  'Machinery',
  'Food & Agriculture',
  'Chemicals',
  'Automotive',
  'Healthcare',
  'Other'
];

function CreateOrderContent() {
  const router = useRouter();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    token: tokens[0],
    category: categories[0],
    deadline: '',
    exporterAddress: '',
    verifierAddress: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate order creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      success('Order Created Successfully!', 'Your escrow order has been created and is now pending approval.');
      
      // Redirect back to dashboard after success
      setTimeout(() => {
        router.push('/');
      }, 1500);
      
    } catch (err) {
      error('Failed to Create Order', 'Please check your inputs and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFormValid = formData.title && formData.description && formData.amount && 
                     formData.deadline && formData.exporterAddress;

  return (
    <PageLayout 
      currentPage="create"
      title="Create New Order"
      subtitle="Set up a new escrow order with milestone-based payments"
      actions={
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Dashboard
        </button>
      }
    >
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-8 space-y-6">
          {/* Order Details */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Details</h3>
              
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="e.g., Electronics Import Order"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed description of the goods/services being traded..."
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    placeholder="0.00"
                    step="0.000001"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token
                  </label>
                  <div className="relative">
                    <select
                      value={formData.token.symbol}
                      onChange={(e) => {
                        const selectedToken = tokens.find(t => t.symbol === e.target.value);
                        if (selectedToken) {
                          handleInputChange('token', selectedToken);
                        }
                      }}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                    >
                      {tokens.map(token => (
                        <option key={token.symbol} value={token.symbol}>
                          {token.symbol} - {token.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <TokenIcon 
                        symbol={formData.token.symbol}
                        name={formData.token.name}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* USD Value Display */}
              {formData.amount && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Estimated Value: ~${(parseFloat(formData.amount) * (
                      formData.token.symbol === 'SOL' ? 180 :
                      formData.token.symbol === 'USDC' ? 1 :
                      formData.token.symbol === 'USDT' ? 1 : 0.5
                    )).toLocaleString()} USD
                  </p>
                </div>
              )}
            </div>

            {/* Participants */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Participants</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exporter/Seller Address *
                  </label>
                  <input
                    type="text"
                    value={formData.exporterAddress}
                    onChange={(e) => handleInputChange('exporterAddress', e.target.value)}
                    placeholder="Solana wallet address of the seller"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verifier/Arbiter Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.verifierAddress}
                    onChange={(e) => handleInputChange('verifierAddress', e.target.value)}
                    placeholder="Solana wallet address of the arbiter"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline *
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => handleInputChange('deadline', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <LoadingButton
              loading={loading}
              disabled={!isFormValid}
              variant="primary"
              className="px-6 py-3"
            >
              Create Order
            </LoadingButton>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}

export default function CreateOrderPage() {
  return (
    <ToastProvider>
      <CreateOrderContent />
    </ToastProvider>
  );
}
