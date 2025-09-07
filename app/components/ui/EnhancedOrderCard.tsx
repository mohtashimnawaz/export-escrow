import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  CurrencyDollarIcon,
  UserIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

interface EnhancedOrderCardProps {
  order: {
    id: string;
    title: string;
    description: string;
    amount: number;
    token: {
      symbol: string;
      name: string;
      logo: string;
      decimals: number;
    };
    status: 'pending' | 'active' | 'completed' | 'disputed' | 'cancelled';
    buyer: string;
    seller: string;
    createdAt: string;
    deadline?: string;
    category: string;
    paymentSchedule?: {
      totalMilestones: number;
      completedMilestones: number;
      nextMilestoneAmount: number;
    };
    usdValue?: number;
  };
}

export const EnhancedOrderCard: React.FC<EnhancedOrderCardProps> = ({ order }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: <ClockIcon className="w-4 h-4" />,
          label: 'Pending'
        };
      case 'active':
        return {
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <CurrencyDollarIcon className="w-4 h-4" />,
          label: 'Active'
        };
      case 'completed':
        return {
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <CheckCircleIcon className="w-4 h-4" />,
          label: 'Completed'
        };
      case 'disputed':
        return {
          color: 'bg-red-100 text-red-800 border-red-200',
          icon: <ExclamationTriangleIcon className="w-4 h-4" />,
          label: 'Disputed'
        };
      case 'cancelled':
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <ExclamationTriangleIcon className="w-4 h-4" />,
          label: 'Cancelled'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: <ClockIcon className="w-4 h-4" />,
          label: 'Unknown'
        };
    }
  };

  const statusConfig = getStatusConfig(order.status);

  const getMilestoneProgress = () => {
    if (!order.paymentSchedule) return null;
    const { totalMilestones, completedMilestones } = order.paymentSchedule;
    const percentage = (completedMilestones / totalMilestones) * 100;
    return { percentage, completed: completedMilestones, total: totalMilestones };
  };

  const progress = getMilestoneProgress();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group">
      {/* Header with Status */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </span>
              <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                {order.category}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
              {order.title}
            </h3>
            <p className="text-gray-600 text-sm line-clamp-2 mb-4">
              {order.description}
            </p>
          </div>
        </div>

        {/* Amount Display */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Image
                src={order.token.logo}
                alt={order.token.name}
                width={32}
                height={32}
                className="rounded-full"
              />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {order.amount.toLocaleString()} {order.token.symbol}
              </p>
              {order.usdValue && (
                <p className="text-sm text-gray-500">
                  ≈ ${order.usdValue.toLocaleString()} USD
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Milestone Progress */}
        {progress && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Milestone Progress</span>
              <span>{progress.completed}/{progress.total} completed</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            {order.paymentSchedule && order.paymentSchedule.nextMilestoneAmount > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                Next milestone: {order.paymentSchedule.nextMilestoneAmount} {order.token.symbol}
              </p>
            )}
          </div>
        )}

        {/* Participants */}
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex items-center space-x-1">
            <UserIcon className="w-4 h-4" />
            <span>Buyer: {truncateAddress(order.buyer)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <UserIcon className="w-4 h-4" />
            <span>Seller: {truncateAddress(order.seller)}</span>
          </div>
        </div>

        {/* Date Info */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <CalendarIcon className="w-4 h-4" />
            <span>Created: {formatDate(order.createdAt)}</span>
          </div>
          {order.deadline && (
            <div className="flex items-center space-x-1">
              <ClockIcon className="w-4 h-4" />
              <span>Due: {formatDate(order.deadline)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {order.status === 'active' && (
              <button className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <CurrencyDollarIcon className="w-4 h-4 mr-1" />
                Manage Payment
              </button>
            )}
            {order.status === 'pending' && (
              <button className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                Accept Order
              </button>
            )}
          </div>
          
          <Link
            href={`/orders/${order.id}`}
            className="inline-flex items-center px-3 py-1.5 text-gray-700 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <EyeIcon className="w-4 h-4 mr-1" />
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

interface OrderGridProps {
  orders: Array<EnhancedOrderCardProps['order']>;
  loading?: boolean;
}

export const OrderGrid: React.FC<OrderGridProps> = ({ orders, loading = false }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-16 bg-gray-200 rounded w-full mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {orders.map((order) => (
        <EnhancedOrderCard key={order.id} order={order} />
      ))}
    </div>
  );
};

// CSS for line-clamp (add to your global CSS)
const styles = `
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
`;
