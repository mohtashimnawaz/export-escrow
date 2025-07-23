'use client';

import React from 'react';
import { format } from 'date-fns';
import { ChevronRight, Search } from 'lucide-react';

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

interface OrdersListProps {
  orders: Order[];
  activeTab: 'all' | 'importer' | 'exporter' | 'verifier';
  currentUser: string;
  onSelectOrder: (order: Order) => void;
  getStateColor: (state: string) => string;
  getStateIcon: (state: string) => React.ComponentType<any>;
}

export function OrdersList({ 
  orders, 
  activeTab, 
  currentUser, 
  onSelectOrder, 
  getStateColor, 
  getStateIcon 
}: OrdersListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredOrders = React.useMemo(() => {
    let filtered = orders;

    // Filter by role
    if (activeTab !== 'all') {
      filtered = filtered.filter(order => {
        switch (activeTab) {
          case 'importer':
            return order.importer === currentUser;
          case 'exporter':
            return order.exporter === currentUser;
          case 'verifier':
            return order.verifier === currentUser;
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.title.toLowerCase().includes(query) ||
        order.description.toLowerCase().includes(query) ||
        order.category.toLowerCase().includes(query) ||
        order.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, activeTab, currentUser, searchQuery]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getUserRole = (order: Order) => {
    if (order.importer === currentUser) return 'Importer';
    if (order.exporter === currentUser) return 'Exporter';
    if (order.verifier === currentUser) return 'Verifier';
    return 'Observer';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Search Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="divide-y divide-gray-200">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Search className="mx-auto h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600">
              {searchQuery 
                ? 'Try adjusting your search criteria'
                : 'Create your first order to get started'
              }
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const StateIcon = getStateIcon(order.state);
            const userRole = getUserRole(order);
            
            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {order.title}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(order.state)}`}>
                        <StateIcon className="h-3 w-3 mr-1" />
                        {order.state.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                        {userRole}
                      </span>
                      <span>{order.category}</span>
                      <span>{order.amount} SOL</span>
                      <span>Created {format(new Date(order.createdAt * 1000), 'MMM d, yyyy')}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate mb-2">
                      {order.description}
                    </p>
                    
                    {order.tags.length > 0 && (
                      <div className="flex items-center space-x-2">
                        {order.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                          >
                            {tag}
                          </span>
                        ))}
                        {order.tags.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{order.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-3 grid grid-cols-3 gap-4 text-xs text-gray-500">
                      <div>
                        <span className="font-medium">Importer:</span><br />
                        {formatAddress(order.importer)}
                      </div>
                      <div>
                        <span className="font-medium">Exporter:</span><br />
                        {formatAddress(order.exporter)}
                      </div>
                      <div>
                        <span className="font-medium">Verifier:</span><br />
                        {formatAddress(order.verifier)}
                      </div>
                    </div>
                  </div>
                  
                  <ChevronRight className="h-5 w-5 text-gray-400 ml-4" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
