import { useState, useEffect } from 'react';

interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
  lastUpdated: Date;
}

interface PriceData {
  [token: string]: TokenPrice;
}

export function usePrices(tokens: string[] = ['SOL', 'USDC', 'USDT', 'BONK', 'JUP']) {
  const [prices, setPrices] = useState<PriceData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      
      // Jupiter Price API v6
      const response = await fetch('https://price.jup.ag/v6/price?ids=' + tokens.join(','));
      
      if (!response.ok) {
        throw new Error('Failed to fetch prices');
      }
      
      const data = await response.json();
      
      const priceData: PriceData = {};
      
      Object.entries(data.data).forEach(([mint, priceInfo]: [string, any]) => {
        // Map mint addresses to symbols
        const symbolMap: { [key: string]: string } = {
          'So11111111111111111111111111111111111111112': 'SOL',
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
          'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
          'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
          'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP'
        };
        
        const symbol = symbolMap[mint] || mint;
        
        priceData[symbol] = {
          symbol,
          price: priceInfo.price,
          change24h: 0, // Jupiter API doesn't provide 24h change
          lastUpdated: new Date()
        };
      });

      setPrices(priceData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching prices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    
    // Update prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    
    return () => clearInterval(interval);
  }, [tokens.join(',')]);

  const getPrice = (token: string): number => {
    return prices[token]?.price || 0;
  };

  const getUSDValue = (amount: number, token: string): number => {
    const price = getPrice(token);
    return amount * price;
  };

  const formatPrice = (price: number): string => {
    if (price < 0.01) {
      return `$${price.toExponential(2)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatUSD = (amount: number): string => {
    if (amount < 1000) {
      return `$${amount.toFixed(2)}`;
    }
    if (amount < 1000000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${(amount / 1000000).toFixed(1)}M`;
  };

  return {
    prices,
    loading,
    error,
    getPrice,
    getUSDValue,
    formatPrice,
    formatUSD,
    refetch: fetchPrices
  };
}
