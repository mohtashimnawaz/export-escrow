'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Package } from 'lucide-react';
import { PageLayout } from './ui/ModernLayout';
import { DashboardStats, RecentActivity, TokenDistribution } from './ui/DashboardComponents';
import { OrderGrid } from './ui/EnhancedOrderCard';
import { ToastProvider, useToast, LoadingState } from './ui/ToastSystem';
import { sampleOrders, getOrderStatistics } from '@/utils/sampleData';

interface Order {
  id: string;
  title: string;
  amount: number;
  currency: {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  };
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

// Convert order format for enhanced UI
const convertOrderForEnhancedUI = (order: Order) => ({
  id: order.id,
  title: order.title,
  description: order.description,
  amount: order.amount,
  token: {
    symbol: order.currency.symbol,
    name: order.currency.name,
    logo: order.currency.logoURI || `/tokens/${order.currency.symbol.toLowerCase()}.png`,
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

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<'all' | 'importer' | 'exporter' | 'verifier'>('all');
  const [loading, setLoading] = useState(true);
  const [orders] = useState<Order[]>(sampleOrders);
  const { success, info } = useToast();

  // Mock wallet connection for demo
  const mockWallet = {
    connected: true,
    publicKey: {
      toString: () => 'Demo1234567890abcdefghijklmnopqrstuvwxyz'
    }
  };

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setLoading(false);
      success('Demo Mode Active', 'Viewing sample data without wallet connection');
    }, 1000);
    return () => clearTimeout(timer);
  }, [success]);

  // Calculate dashboard stats using mock wallet
  const getDashboardStats = () => {
    const userOrders = orders.filter(order => 
      order.importer === mockWallet.publicKey.toString() || 
      order.exporter === mockWallet.publicKey.toString() ||
      order.verifier === mockWallet.publicKey.toString()
    );

    const totalValue = userOrders.reduce((sum, order) => {
      const usdValue = order.amount * (order.currency.symbol === 'SOL' ? 180 : 
        order.currency.symbol === 'USDC' ? 1 : 
        order.currency.symbol === 'USDT' ? 1 : 0.5);
      return sum + usdValue;
    }, 0);

    const activeOrders = userOrders.filter(order => 
      ['PendingShipment', 'InTransit'].includes(order.state)
    ).length;

    const completedOrders = userOrders.filter(order => 
      ['Completed', 'Delivered'].includes(order.state)
    ).length;

    const pendingActions = userOrders.filter(order => 
      ['PendingDeadlineApproval', 'Disputed'].includes(order.state)
    ).length;

    return { totalValue, activeOrders, completedOrders, pendingActions };
  };

  // Generate recent activity
  const getRecentActivity = () => {
    const activities = [
      {
        id: '1',
        type: 'order_created' as const,
        description: 'New electronics import order created',
        timestamp: '2 hours ago',
        amount: 25500,
        token: 'USDC'
      },
      {
        id: '2',
        type: 'payment_sent' as const,
        description: 'Payment milestone completed for textile export',
        timestamp: '5 hours ago',
        amount: 15,
        token: 'SOL'
      },
      {
        id: '3',
        type: 'milestone_completed' as const,
        description: 'Delivery confirmed for machinery import',
        timestamp: '1 day ago'
      },
      {
        id: '4',
        type: 'order_created' as const,
        description: 'Food export order initiated',
        timestamp: '2 days ago',
        amount: 151200000,
        token: 'BONK'
      }
    ];
    return activities.slice(0, 6);
  };

  // Generate token distribution
  const getTokenDistribution = () => {
    const tokenStats = orders.reduce((acc, order) => {
      const symbol = order.currency.symbol;
      if (!acc[symbol]) {
        acc[symbol] = { amount: 0, count: 0 };
      }
      acc[symbol].amount += order.amount;
      acc[symbol].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    const distribution = Object.entries(tokenStats).map(([symbol, stats], index) => {
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
      const usdValue = stats.amount * (symbol === 'SOL' ? 180 : 
        symbol === 'USDC' ? 1 : 
        symbol === 'USDT' ? 1 : 0.5);
      
      return {
        symbol,
        name: symbol === 'SOL' ? 'Solana' : 
              symbol === 'USDC' ? 'USD Coin' :
              symbol === 'USDT' ? 'Tether USD' :
              symbol === 'BONK' ? 'Bonk' : symbol,
        value: usdValue,
        percentage: 0, // Will calculate after
        color: colors[index % colors.length]
      };
    });

    const totalValue = distribution.reduce((sum, token) => sum + token.value, 0);
    return distribution.map(token => ({
      ...token,
      percentage: Math.round((token.value / totalValue) * 100)
    }));
  };

  if (loading) {
    return (
      <PageLayout currentPage="dashboard">
        <div className="space-y-8">
          <LoadingState type="skeleton" className="h-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <LoadingState key={i} type="skeleton" className="h-24" />
            ))}
          </div>
          <LoadingState type="skeleton" className="h-96" />
        </div>
      </PageLayout>
    );
  }

  const stats = getDashboardStats();
  const activities = getRecentActivity();
  const tokenDistribution = getTokenDistribution();
  const enhancedOrders = orders.map(convertOrderForEnhancedUI);

  return (
    <PageLayout 
      currentPage="dashboard"
      title="Dashboard"
      subtitle="Demo mode - Viewing sample escrow orders and analytics"
      actions={
        <div className="flex space-x-3">
          <button
            onClick={() => info('Demo Mode', 'Create order functionality available in full version')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Order
          </button>
          <div className="inline-flex items-center px-3 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded-lg">
            Demo Mode
          </div>
        </div>
      }
    >
      {/* Dashboard Stats */}
      <DashboardStats stats={stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Orders Section */}
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sample Orders</h2>
            <div className="flex space-x-2 mb-6">
              {[
                { id: 'all', name: 'All Orders' },
                { id: 'importer', name: 'As Buyer' },
                { id: 'exporter', name: 'As Seller' },
                { id: 'verifier', name: 'As Arbiter' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>
          
          <OrderGrid 
            orders={enhancedOrders.filter(order => {
              if (activeTab === 'all') return true;
              if (activeTab === 'importer') return order.buyer === mockWallet.publicKey.toString();
              if (activeTab === 'exporter') return order.seller === mockWallet.publicKey.toString();
              return false;
            })}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <RecentActivity activities={activities} />
          <TokenDistribution tokenDistribution={tokenDistribution} />
        </div>
      </div>

      {/* Demo Notice */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <Package className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Demo Mode Active</h3>
            <p className="mt-1 text-sm text-blue-700">
              You're viewing sample data showcasing the enhanced UI. 
              Connect a Solana wallet to access full functionality including:
              SPL token integration, partial payments, milestone management, and real transactions.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export function DemoEscrowDashboard() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
