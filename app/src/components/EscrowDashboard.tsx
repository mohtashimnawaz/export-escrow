'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  Package, 
  Plus, 
  User, 
  Shield, 
  Truck,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { CreateOrderModal } from './CreateOrderModal';
import { OrdersList } from './OrdersList';
import { OrderDetails } from './OrderDetails';
import { NotificationContainer, useNotifications } from './Notifications';
import { Order as EscrowOrder } from '@/types/escrow';
import { sampleOrders, getOrderStatistics } from '@/utils/sampleData';

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

export function EscrowDashboard() {
  const { connected, publicKey } = useWallet();
  const { notifications, removeNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<'all' | 'importer' | 'exporter' | 'verifier'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>(sampleOrders);

  const tabs = [
    { id: 'all', name: 'All Orders', icon: Package },
    { id: 'importer', name: 'As Importer', icon: User },
    { id: 'exporter', name: 'As Exporter', icon: Truck },
    { id: 'verifier', name: 'As Verifier', icon: Shield },
  ];

  const getStateColor = (state: string) => {
    switch (state) {
      case 'PendingDeadlineApproval':
        return 'bg-yellow-100 text-yellow-800';
      case 'PendingShipment':
        return 'bg-blue-100 text-blue-800';
      case 'InTransit':
        return 'bg-purple-100 text-purple-800';
      case 'Delivered':
        return 'bg-green-100 text-green-800';
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800';
      case 'Refunded':
        return 'bg-gray-100 text-gray-800';
      case 'Disputed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'PendingDeadlineApproval':
        return Clock;
      case 'PendingShipment':
        return Package;
      case 'InTransit':
        return Truck;
      case 'Delivered':
        return CheckCircle;
      case 'Completed':
        return CheckCircle;
      case 'Refunded':
        return AlertTriangle;
      case 'Disputed':
        return AlertTriangle;
      default:
        return Package;
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <Package className="mx-auto h-16 w-16 text-blue-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Solana Escrow System
          </h1>
          <p className="text-gray-600 mb-6">
            A secure escrow system for international trade. Connect your wallet to get started.
          </p>
          <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Escrow System</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </button>
              <WalletMultiButton className="!bg-gray-600 hover:!bg-gray-700" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-6">
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'all' | 'importer' | 'exporter' | 'verifier')}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 mr-3" />
                      {tab.name}
                    </button>
                  );
                })}
              </nav>

              {/* Stats */}
              <div className="mt-8 border-t pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Your Statistics</h3>
                <div className="space-y-3">
                  {publicKey && (() => {
                    const stats = getOrderStatistics(orders, publicKey.toString());
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Orders</span>
                          <span className="font-medium">{stats.totalOrders}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total Value</span>
                          <span className="font-medium">{stats.totalValue.toFixed(1)} SOL</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Active</span>
                          <span className="font-medium text-blue-600">{stats.activeOrders}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Completed</span>
                          <span className="font-medium text-green-600">{stats.completedOrders}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Success Rate</span>
                          <span className="font-medium">{stats.completionRate.toFixed(1)}%</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {selectedOrder ? (
              <OrderDetails 
                order={selectedOrder} 
                onBack={() => setSelectedOrder(null)}
                onUpdate={(updatedOrder: Order) => {
                  setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
                  setSelectedOrder(updatedOrder);
                }}
              />
            ) : (
              <OrdersList 
                orders={orders}
                activeTab={activeTab}
                currentUser={publicKey?.toString() || ''}
                onSelectOrder={setSelectedOrder}
                getStateColor={getStateColor}
                getStateIcon={getStateIcon}
              />
            )}
          </div>
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onOrderCreated={(newOrder: Order) => {
            setOrders([...orders, newOrder]);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Notifications */}
      <NotificationContainer
        notifications={notifications}
        onClose={removeNotification}
      />
    </div>
  );
}
