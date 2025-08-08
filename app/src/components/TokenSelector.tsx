'use client';

import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { ChevronDown, Search, ExternalLink } from 'lucide-react';
import { TokenInfo, TokenUtils, TokenPriceService, ALL_TOKENS } from '@/utils/tokenUtils';

interface TokenSelectorProps {
  selectedToken: TokenInfo | null;
  onTokenSelect: (token: TokenInfo) => void;
  showBalance?: boolean;
  disabled?: boolean;
}

export function TokenSelector({ 
  selectedToken, 
  onTokenSelect, 
  showBalance = false,
  disabled = false 
}: TokenSelectorProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customTokenMint, setCustomTokenMint] = useState('');
  const [tokenBalances, setTokenBalances] = useState<Map<string, number>>(new Map());
  const [tokenPrices, setTokenPrices] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  const tokenUtils = new TokenUtils(connection);

  // Load token balances
  useEffect(() => {
    if (!publicKey || !showBalance || !connection) return;

    const loadBalances = async () => {
      const balances = new Map<string, number>();
      const prices = new Map<string, number>();

      for (const token of ALL_TOKENS) {
        try {
          const balance = await tokenUtils.getTokenBalance(
            publicKey, 
            new PublicKey(token.mint)
          );
          const price = await TokenPriceService.getTokenPrice(token.mint);
          
          balances.set(token.mint, balance);
          prices.set(token.mint, price);
        } catch (error) {
          console.error(`Error loading balance for ${token.symbol}:`, error);
          // Set default values on error
          balances.set(token.mint, 0);
          prices.set(token.mint, 0);
        }
      }

      setTokenBalances(balances);
      setTokenPrices(prices);
    };

    loadBalances();
  }, [publicKey, showBalance, connection, tokenUtils]);

  const filteredTokens = ALL_TOKENS.filter(token =>
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCustomTokenAdd = async () => {
    if (!customTokenMint.trim()) return;

    setLoading(true);
    try {
      const isValid = await tokenUtils.validateTokenMint(customTokenMint);
      if (!isValid) {
        alert('Invalid token mint address');
        return;
      }

      const tokenInfo = await tokenUtils.getTokenInfo(new PublicKey(customTokenMint));
      if (tokenInfo) {
        onTokenSelect(tokenInfo);
        setIsOpen(false);
        setCustomTokenMint('');
      }
    } catch (error) {
      alert('Error adding custom token: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: number, decimals: number) => {
    return tokenUtils.formatTokenAmount(balance, decimals);
  };

  const getTokenValueUSD = (balance: number, mint: string): string => {
    const price = tokenPrices.get(mint) || 0;
    const value = balance * price;
    return value >= 0.01 ? `$${value.toFixed(2)}` : '<$0.01';
  };

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between p-3 border rounded-md bg-white hover:bg-gray-50 transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center">
          {selectedToken ? (
            <>
              {selectedToken.logoURI && (
                <img 
                  src={selectedToken.logoURI} 
                  alt={selectedToken.symbol}
                  className="h-6 w-6 rounded-full mr-3"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="text-left">
                <div className="font-medium">{selectedToken.symbol}</div>
                {showBalance && publicKey && (
                  <div className="text-sm text-gray-500">
                    {formatBalance(tokenBalances.get(selectedToken.mint) || 0, selectedToken.decimals)} {selectedToken.symbol}
                    {tokenPrices.get(selectedToken.mint) && (
                      <span className="ml-2">
                        ({getTokenValueUSD(tokenBalances.get(selectedToken.mint) || 0, selectedToken.mint)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="text-gray-500">Select a token...</span>
          )}
        </div>
        <ChevronDown className="h-5 w-5 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Token List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredTokens.map((token) => {
              const balance = tokenBalances.get(token.mint) || 0;
              const hasBalance = balance > 0;

              return (
                <button
                  key={token.mint}
                  onClick={() => {
                    onTokenSelect(token);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center">
                    {token.logoURI && (
                      <img 
                        src={token.logoURI} 
                        alt={token.symbol}
                        className="h-8 w-8 rounded-full mr-3"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <div className="font-medium flex items-center">
                        {token.symbol}
                        {token.verified && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{token.name}</div>
                    </div>
                  </div>
                  
                  {showBalance && publicKey && (
                    <div className="text-right">
                      <div className={`text-sm font-medium ${hasBalance ? 'text-gray-900' : 'text-gray-400'}`}>
                        {formatBalance(balance, token.decimals)}
                      </div>
                      {tokenPrices.get(token.mint) && hasBalance && (
                        <div className="text-xs text-gray-500">
                          {getTokenValueUSD(balance, token.mint)}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Token Input */}
          <div className="border-t p-3 bg-gray-50">
            <div className="text-sm font-medium text-gray-700 mb-2">Add Custom Token</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter token mint address..."
                value={customTokenMint}
                onChange={(e) => setCustomTokenMint(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleCustomTokenAdd}
                disabled={loading || !customTokenMint.trim()}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '...' : 'Add'}
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Make sure to verify the token mint address before adding
            </div>
          </div>

          {/* Close button */}
          <div className="border-t p-2">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-sm text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
