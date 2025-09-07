import React from 'react';
import { 
  TrendingUpIcon, 
  CurrencyDollarIcon, 
  ShoppingBagIcon, 
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

interface DashboardStatsProps {
  stats: {
    totalValue: number;
    activeOrders: number;
    completedOrders: number;
    pendingActions: number;
  };
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Value Locked */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">Total Value Locked</p>
            <p className="text-3xl font-bold">${stats.totalValue.toLocaleString()}</p>
            <p className="text-blue-100 text-sm mt-1">+12.3% from last month</p>
          </div>
          <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
            <CurrencyDollarIcon className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Active Orders */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium">Active Orders</p>
            <p className="text-3xl font-bold">{stats.activeOrders}</p>
            <p className="text-green-100 text-sm mt-1">+5 new this week</p>
          </div>
          <div className="bg-green-400 bg-opacity-30 rounded-lg p-3">
            <ShoppingBagIcon className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Completed Orders */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm font-medium">Completed Orders</p>
            <p className="text-3xl font-bold">{stats.completedOrders}</p>
            <p className="text-purple-100 text-sm mt-1">98.5% success rate</p>
          </div>
          <div className="bg-purple-400 bg-opacity-30 rounded-lg p-3">
            <CheckCircleIcon className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Pending Actions */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100 text-sm font-medium">Pending Actions</p>
            <p className="text-3xl font-bold">{stats.pendingActions}</p>
            <p className="text-orange-100 text-sm mt-1">Requires attention</p>
          </div>
          <div className="bg-orange-400 bg-opacity-30 rounded-lg p-3">
            <ExclamationTriangleIcon className="w-8 h-8" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface RecentActivityProps {
  activities: Array<{
    id: string;
    type: 'order_created' | 'payment_sent' | 'milestone_completed' | 'dispute_raised';
    description: string;
    timestamp: string;
    amount?: number;
    token?: string;
  }>;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order_created':
        return <ShoppingBagIcon className="w-5 h-5 text-blue-500" />;
      case 'payment_sent':
        return <CurrencyDollarIcon className="w-5 h-5 text-green-500" />;
      case 'milestone_completed':
        return <CheckCircleIcon className="w-5 h-5 text-purple-500" />;
      case 'dispute_raised':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'order_created':
        return 'bg-blue-50 border-blue-200';
      case 'payment_sent':
        return 'bg-green-50 border-green-200';
      case 'milestone_completed':
        return 'bg-purple-50 border-purple-200';
      case 'dispute_raised':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          View All
        </button>
      </div>
      
      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`p-4 rounded-lg border ${getActivityColor(activity.type)} transition-colors hover:shadow-sm`}
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {activity.description}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500">{activity.timestamp}</p>
                  {activity.amount && activity.token && (
                    <span className="text-sm font-semibold text-gray-900">
                      {activity.amount} {activity.token}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface QuickStatsProps {
  tokenDistribution: Array<{
    symbol: string;
    name: string;
    percentage: number;
    value: number;
    color: string;
  }>;
}

export const TokenDistribution: React.FC<QuickStatsProps> = ({ tokenDistribution }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Token Distribution</h3>
      
      <div className="space-y-4">
        {tokenDistribution.map((token) => (
          <div key={token.symbol} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: token.color }}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{token.symbol}</p>
                <p className="text-xs text-gray-500">{token.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                ${token.value.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">{token.percentage}%</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Progress bars */}
      <div className="mt-6 space-y-2">
        {tokenDistribution.map((token) => (
          <div key={`${token.symbol}-bar`} className="relative">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{token.symbol}</span>
              <span>{token.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ 
                  width: `${token.percentage}%`,
                  backgroundColor: token.color 
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
