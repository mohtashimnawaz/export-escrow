import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { usePrices } from '@/hooks/usePrices';

interface PriceDisplayProps {
  amount: number;
  token: string;
  showChange?: boolean;
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  token,
  showChange = false,
  className = ''
}) => {
  const { getPrice, getUSDValue, formatPrice, formatUSD, loading } = usePrices();

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
        <div className="h-3 bg-gray-200 rounded w-16"></div>
      </div>
    );
  }

  try {
    const tokenPrice = getPrice(token);
    const usdValue = getUSDValue(amount, token);

    return (
      <div className={className}>
        <div className="font-semibold text-gray-900">
          {amount} {token}
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-1">
          {formatUSD(usdValue)}
          {showChange && tokenPrice > 0 && (
            <span className="text-xs text-gray-400">
              @ {formatPrice(tokenPrice)}
            </span>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error rendering PriceDisplay:', error);
    return (
      <div className={className}>
        <div className="font-semibold text-gray-900">
          {amount} {token}
        </div>
        <div className="text-sm text-gray-500">
          Loading price...
        </div>
      </div>
    );
  }
};

interface LivePriceTickerProps {
  tokens?: string[];
  className?: string;
}

export const LivePriceTicker: React.FC<LivePriceTickerProps> = ({
  tokens = ['SOL', 'USDC', 'USDT', 'BONK'],
  className = ''
}) => {
  const { prices, loading, formatPrice } = usePrices(tokens);

  if (loading) {
    return (
      <div className={`flex space-x-4 ${className}`}>
        {tokens.map(token => (
          <div key={token} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex space-x-6 ${className}`}>
      {tokens.map(token => {
        const price = prices[token];
        if (!price) return null;

        return (
          <div key={token} className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">{token}</span>
            <span className="text-sm text-gray-900">{formatPrice(price.price)}</span>
            {price.change24h !== 0 && (
              <span className={`text-xs flex items-center ${
                price.change24h > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {price.change24h > 0 ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {Math.abs(price.change24h).toFixed(2)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface PriceComparisonProps {
  amount: number;
  fromToken: string;
  toToken: string;
  className?: string;
}

export const PriceComparison: React.FC<PriceComparisonProps> = ({
  amount,
  fromToken,
  toToken,
  className = ''
}) => {
  const { getPrice, formatPrice } = usePrices();

  const fromPrice = getPrice(fromToken);
  const toPrice = getPrice(toToken);
  const convertedAmount = (amount * fromPrice) / toPrice;

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <span className="text-gray-600">
        {amount} {fromToken}
      </span>
      <span className="text-gray-400">≈</span>
      <span className="text-gray-900">
        {convertedAmount.toFixed(4)} {toToken}
      </span>
    </div>
  );
};
