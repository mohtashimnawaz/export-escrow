import React from 'react';

interface TokenIconProps {
  symbol: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TokenIcon: React.FC<TokenIconProps> = ({ 
  symbol, 
  name, 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const getTokenColor = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case 'SOL':
        return 'from-purple-500 to-blue-500';
      case 'USDC':
        return 'from-blue-500 to-blue-600';
      case 'USDT':
        return 'from-green-500 to-green-600';
      case 'MSOL':
        return 'from-purple-600 to-pink-600';
      case 'BONK':
        return 'from-orange-500 to-red-500';
      case 'JUP':
        return 'from-yellow-500 to-orange-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div 
      className={`bg-gradient-to-r ${getTokenColor(symbol)} rounded-full flex items-center justify-center ${sizeClasses[size]} ${className}`}
      title={name}
    >
      <span className="text-white font-bold">
        {symbol.charAt(0)}
      </span>
    </div>
  );
};
