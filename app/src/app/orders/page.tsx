'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '../../components/ui/ModernLayout';
import { OrderGrid } from '../../components/ui/EnhancedOrderCard';
import { ToastProvider } from '../../components/ui/ToastSystem';
import { PlusIcon } from '@heroicons/react/24/outline';
import { sampleOrders } from '@/utils/sampleData';

// Convert sample orders to enhanced format
const convertOrderForEnhancedUI = (order: any) => ({
  id: order.id,
  title: order.title,
  description: order.description,
  amount: order.amount,
  token: {
    symbol: order.currency.symbol,
    name: order.currency.name,
    logo: '',
    decimals: order.currency.decimals
  },
  status: convertState(order.state),
  buyer: order.importer,
  seller: order.exporter,
  createdAt: new Date(order.createdAt).toISOString(),
  deadline: new Date(order.deadline).toISOString(),
  category: order.category,
  paymentSchedule: {
    totalMilestones: 3,
    completedMilestones: Math.floor(Math.random() * 3),
    nextMilestoneAmount: order.amount * 0.3
  },
  usdValue: Math.floor(order.amount * (order.currency.symbol === 'SOL' ? 180 : 
    order.currency.symbol === 'USDC' ? 1 : 
    order.currency.symbol === 'USDT' ? 1 : 0.5))
});

const convertState = (state: string): 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled' => {
  switch (state) {
    case 'PendingDeadlineApproval':
      return 'pending';
    case 'PendingShipment':
    case 'InTransit':
      return 'active';
    case 'Delivered':
    case 'Completed':
      return 'completed';
    case 'Disputed':
      return 'disputed';
    case 'Refunded':
      return 'cancelled';
    default:
      return 'pending';
  }
};

function OrdersContent() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'active' | 'completed' | 'disputed'>('all');
  const [orders] = useState(sampleOrders.map(convertOrderForEnhancedUI));

  const filteredOrders = orders.filter(order => {
    if (activeFilter === 'all') return true;
    return order.status === activeFilter;
  });

  const filters = [
    { id: 'all', name: 'All Orders', count: orders.length },
    { id: 'pending', name: 'Pending', count: orders.filter(o => o.status === 'pending').length },
    { id: 'active', name: 'Active', count: orders.filter(o => o.status === 'active').length },
    { id: 'completed', name: 'Completed', count: orders.filter(o => o.status === 'completed').length },
    { id: 'disputed', name: 'Disputed', count: orders.filter(o => o.status === 'disputed').length },
  ];

  return (
    <PageLayout 
      currentPage="orders"
      title="All Orders"
      subtitle="Manage and track all your escrow orders"
      actions={
        <button
          onClick={() => router.push('/create')}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Order
        </button>
      }
    >
      <div className="space-y-6">
        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap gap-2">
            {filters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id as any)}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {filter.name}
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeFilter === filter.id
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        {filteredOrders.length > 0 ? (
          <OrderGrid orders={filteredOrders} />
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No {activeFilter !== 'all' ? activeFilter : ''} orders found
            </h3>
            <p className="text-gray-600 mb-6">
              {activeFilter === 'all' 
                ? "You haven't created any orders yet. Start by creating your first escrow order."
                : `No ${activeFilter} orders at the moment.`
              }
            </p>
            <button
              onClick={() => router.push('/create')}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              Create Your First Order
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function OrdersPage() {
  return (
    <ToastProvider>
      <OrdersContent />
    </ToastProvider>
  );
}
