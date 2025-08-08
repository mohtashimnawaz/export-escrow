import { Order } from '@/types/escrow';

export const sampleOrders: Order[] = [
  {
    id: 'FQsYmkQrWqxb8FnGpmVJBJd1YyuMpZHFe4xqGBWD9xrb',
    title: 'Electronics Components Import',
    amount: 25.5,
    state: 'InTransit',
    importer: 'Hzy81inT9z7YaKBkDxG58DYwGksoJNPQEr6REcFGHXkN',
    exporter: 'Dbz2Y1yPtaJ6LiLtLujXoFokrnfGWoJYNREpdAcmrX7T',
    verifier: 'HQo4Gy3XWnn4ZZYP6HEf5WnL3b8EEmL6mVP1ywekgQXK',
    createdAt: Date.now() / 1000 - 86400 * 3, // 3 days ago
    deadline: Date.now() / 1000 + 86400 * 14, // 14 days from now
    description: 'Import of electronic components including microcontrollers, sensors, and LED displays for manufacturing.',
    category: 'electronics',
    tags: ['urgent', 'high-value', 'fragile']
  },
  {
    id: 'BQsYmkQrWqxb8FnGpmVJBJd1YyuMpZHFe4xqGBWD9abc',
    title: 'Textile Goods Export',
    amount: 15.0,
    state: 'PendingShipment',
    importer: 'HQo4Gy3XWnn4ZZYP6HEf5WnL3b8EEmL6mVP1ywekgQXK',
    exporter: 'Hzy81inT9z7YaKBkDxG58DYwGksoJNPQEr6REcFGHXkN',
    verifier: 'Dbz2Y1yPtaJ6LiLtLujXoFokrnfGWoJYNREpdAcmrX7T',
    createdAt: Date.now() / 1000 - 86400 * 5, // 5 days ago
    deadline: Date.now() / 1000 + 86400 * 21, // 21 days from now
    description: 'Export of premium cotton textiles and garments to European markets.',
    category: 'textiles',
    tags: ['bulk', 'cotton', 'premium']
  },
  {
    id: 'CQsYmkQrWqxb8FnGpmVJBJd1YyuMpZHFe4xqGBWD9def',
    title: 'Machinery Parts Import',
    amount: 45.0,
    state: 'PendingExtensionApproval',
    importer: 'Hzy81inT9z7YaKBkDxG58DYwGksoJNPQEr6REcFGHXkN', // Test importer can approve/reject
    exporter: 'Dbz2Y1yPtaJ6LiLtLujXoFokrnfGWoJYNREpdAcmrX7T', // Test exporter requested extension
    verifier: 'HQo4Gy3XWnn4ZZYP6HEf5WnL3b8EEmL6mVP1ywekgQXK',
    createdAt: Date.now() / 1000 - 86400 * 1, // 1 day ago
    deadline: Date.now() / 1000 + 86400 * 30, // 30 days from now
    description: 'Import of specialized machinery parts for industrial equipment maintenance.',
    category: 'machinery',
    tags: ['industrial', 'specialized', 'heavy']
  },
  {
    id: 'DQsYmkQrWqxb8FnGpmVJBJd1YyuMpZHFe4xqGBWD9ghi',
    title: 'Food Products Export',
    amount: 12.8,
    state: 'Completed',
    importer: 'HcXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    exporter: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    verifier: '4fYNw3dojWmQ3dTHTHNGrMGqaNi7k2mXpbXbPULBNsXb',
    createdAt: Date.now() / 1000 - 86400 * 15, // 15 days ago
    deadline: Date.now() / 1000 - 86400 * 2, // Completed 2 days ago
    description: 'Export of organic food products including dried fruits and nuts.',
    category: 'food',
    tags: ['organic', 'perishable', 'certified']
  },
  {
    id: 'EQsYmkQrWqxb8FnGpmVJBJd1YyuMpZHFe4xqGBWD9jkl',
    title: 'Chemical Imports',
    amount: 35.2,
    state: 'Disputed',
    importer: 'Dbz2Y1yPtaJ6LiLtLujXoFokrnfGWoJYNREpdAcmrX7T', // Test importer who filed dispute
    exporter: 'Hzy81inT9z7YaKBkDxG58DYwGksoJNPQEr6REcFGHXkN', // Test exporter being disputed
    verifier: 'HQo4Gy3XWnn4ZZYP6HEf5WnL3b8EEmL6mVP1ywekgQXK', // Test verifier can resolve
    createdAt: Date.now() / 1000 - 86400 * 8, // 8 days ago
    deadline: Date.now() / 1000 + 86400 * 7, // 7 days from now
    description: 'Import of industrial chemicals for pharmaceutical manufacturing. Dispute filed due to damaged packaging and contaminated products.',
    category: 'chemicals',
    tags: ['hazardous', 'controlled', 'pharmaceutical', 'disputed']
  }
];

// Helper function to get orders for a specific user role
export function getOrdersForRole(orders: Order[], userAddress: string, role: 'importer' | 'exporter' | 'verifier') {
  return orders.filter(order => {
    switch (role) {
      case 'importer':
        return order.importer === userAddress;
      case 'exporter':
        return order.exporter === userAddress;
      case 'verifier':
        return order.verifier === userAddress;
      default:
        return false;
    }
  });
}

// Helper function to get statistics for dashboard
export function getOrderStatistics(orders: Order[], userAddress: string) {
  const userOrders = orders.filter(order => 
    order.importer === userAddress || 
    order.exporter === userAddress || 
    order.verifier === userAddress
  );

  const totalValue = userOrders.reduce((sum, order) => sum + order.amount, 0);
  const completedOrders = userOrders.filter(order => order.state === 'Completed').length;
  const activeOrders = userOrders.filter(order => 
    !['Completed', 'Refunded'].includes(order.state)
  ).length;

  return {
    totalOrders: userOrders.length,
    totalValue,
    completedOrders,
    activeOrders,
    completionRate: userOrders.length > 0 ? (completedOrders / userOrders.length) * 100 : 0
  };
}
