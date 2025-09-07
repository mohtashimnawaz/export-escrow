'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Plus, Package } from 'lucide-react';
import { PageLayout } from './ui/ModernLayout';
import { DashboardStats, RecentActivity, TokenDistribution } from './ui/DashboardComponents';
import { OrderGrid } from '../../components/ui/EnhancedOrderCard';
import { ToastProvider, useToast, LoadingState } from './ui/ToastSystem';
import { CreateOrderModal } from './CreateOrderModal';
import { OrderDetails } from './OrderDetails';
import { TestWalletHelper } from './TestWalletHelper';
import { LivePriceTicker } from './PriceComponents';
import { ErrorBoundary } from './ErrorBoundary';
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
    logo: '', // We'll use fallback design instead
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
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<'all' | 'importer' | 'exporter' | 'verifier'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>(sampleOrders);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { success, error, info } = useToast();

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (connected) {
      success('Wallet Connected', `Connected to ${publicKey?.toString().slice(0, 8)}...`);
    }
  }, [connected, publicKey, success]);

  const handleOrderCreated = (newOrder: Order) => {
    setOrders(prevOrders => [newOrder, ...prevOrders]);
    setSelectedOrder(newOrder);
    setShowCreateModal(false);
    success('Order Created', 'Your new escrow order has been created successfully!');
  };

  const handleOrderAction = (updatedOrder: Order) => {
    setOrders(prevOrders => 
      prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o)
    );
    setSelectedOrder(updatedOrder);
    info('Order Updated', 'Order status has been updated.');
  };

  // Calculate dashboard stats
  const getDashboardStats = () => {
    if (!publicKey) return { totalValue: 0, activeOrders: 0, completedOrders: 0, pendingActions: 0 };
    
    const userOrders = orders.filter(order => 
      order.importer === publicKey.toString() || 
      order.exporter === publicKey.toString() ||
      order.verifier === publicKey.toString()
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

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Solana Escrow System
          </h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            A secure, milestone-based escrow system for international trade. 
            Connect your wallet to access professional escrow management.
          </p>
          <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 !rounded-lg !font-medium" />
          
          <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-gray-500">
            <div className="text-center">
              <div className="font-semibold text-gray-900">Multi-Token</div>
              <div>SOL, USDC, USDT+</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-gray-900">Milestones</div>
              <div>Payment Scheduling</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  if (selectedOrder) {
    return (
      <PageLayout 
        currentPage="dashboard"
        title="Order Details"
        subtitle={`Managing order #${selectedOrder.id}`}
        actions={
          <button
            onClick={() => setSelectedOrder(null)}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700"
          >
            ← Back to Dashboard
          </button>
        }
      >
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Details</h2>
            <p className="text-gray-600">Order ID: {selectedOrder.id}</p>
            <p className="text-gray-600">Title: {selectedOrder.title}</p>
            <button 
              onClick={() => setSelectedOrder(null)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
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
      subtitle="Manage your escrow orders and track performance"
      actions={
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Order
        </button>
      }
    >
      {/* Live Price Ticker */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Live Prices</h3>
          <span className="text-xs text-gray-500">Updated every 30 seconds</span>
        </div>
        <div className="mt-3">
          <ErrorBoundary fallback={
            <div className="text-center py-4 text-gray-500">
              Price data temporarily unavailable
            </div>
          }>
            <LivePriceTicker />
          </ErrorBoundary>
        </div>
      </div>

      {/* Dashboard Stats */}
      <DashboardStats stats={stats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Orders Section */}
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Orders</h2>
            
            {/* Role Tabs */}
            <div className="flex space-x-2 mb-4">
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

            {/* Search Bar */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search orders by title, buyer, seller, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          {(() => {
            try {
              const filteredOrders = enhancedOrders.filter(order => {
                // Role-based filtering
                let matchesRole = true;
                if (activeTab === 'importer') matchesRole = order.buyer === publicKey?.toString();
                else if (activeTab === 'exporter') matchesRole = order.seller === publicKey?.toString();
                else if (activeTab === 'verifier') matchesRole = false; // Add verifier logic here
                
                // Search filtering
                const matchesSearch = searchTerm === '' || 
                  order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  order.buyer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  order.seller.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  order.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  order.description.toLowerCase().includes(searchTerm.toLowerCase());
                
                return matchesRole && matchesSearch;
              });

              return (
                <ErrorBoundary fallback={
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders</h3>
                    <div className="text-center py-8">
                      <p className="text-gray-500">Orders temporarily unavailable</p>
                    </div>
                  </div>
                }>
                  <OrderGrid orders={filteredOrders} />
                </ErrorBoundary>
              );
            } catch (error) {
              console.error('Error rendering OrderGrid:', error);
              return (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders</h3>
                  <div className="text-center py-8">
                    <p className="text-gray-500">Error loading orders. Please refresh the page.</p>
                  </div>
                </div>
              );
            }
          })()}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <RecentActivity activities={activities} />
          <TokenDistribution tokenDistribution={tokenDistribution} />
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onOrderCreated={handleOrderCreated}
        />
      )}
      
      <TestWalletHelper />
    </PageLayout>
  );
}

export function EnhancedEscrowDashboard() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}
