import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint } from '@solana/spl-token';

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  verified: boolean;
}

// Common SPL tokens on Solana
export const POPULAR_TOKENS: TokenInfo[] = [
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    verified: true
  },
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
    verified: true
  },
  {
    mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
    symbol: 'mSOL',
    name: 'Marinade staked SOL',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
    verified: true
  },
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
    verified: true
  },
  {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png',
    verified: true
  }
];

// Add SOL as a "token" for unified handling
export const SOL_TOKEN: TokenInfo = {
  mint: 'So11111111111111111111111111111111111111112', // Wrapped SOL mint
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  verified: true
};

export const ALL_TOKENS = [SOL_TOKEN, ...POPULAR_TOKENS];

// Token utility functions
export class TokenUtils {
  constructor(private connection: Connection) {}

  async getTokenBalance(
    walletAddress: PublicKey, 
    tokenMint: PublicKey
  ): Promise<number> {
    try {
      // Handle SOL separately
      if (tokenMint.toString() === SOL_TOKEN.mint) {
        const balance = await this.connection.getBalance(walletAddress);
        return balance / 1e9; // Convert lamports to SOL
      }

      // Handle SPL tokens
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMint,
        walletAddress
      );

      try {
        const tokenAccount = await this.connection.getTokenAccountBalance(
          associatedTokenAddress
        );
        return parseFloat(tokenAccount.value.uiAmount?.toString() || '0');
      } catch (tokenError) {
        // Token account doesn't exist, return 0 balance
        console.log(`Token account not found for ${tokenMint.toString()}: ${tokenError}`);
        return 0;
      }
    } catch (error) {
      console.log('Token balance fetch error:', error);
      return 0;
    }
  }

  async getTokenInfo(tokenMint: PublicKey): Promise<TokenInfo | null> {
    try {
      // Check if it's a known token
      const knownToken = ALL_TOKENS.find(token => token.mint === tokenMint.toString());
      if (knownToken) return knownToken;

      // Fetch token info from chain
      const mintInfo = await getMint(this.connection, tokenMint);
      
      return {
        mint: tokenMint.toString(),
        symbol: 'UNKNOWN',
        name: `Token ${tokenMint.toString().slice(0, 8)}...`,
        decimals: mintInfo.decimals,
        verified: false
      };
    } catch (error) {
      console.error('Error fetching token info:', error);
      return null;
    }
  }

  formatTokenAmount(amount: number, decimals: number): string {
    if (amount === 0) return '0';
    
    // For small amounts, show more precision
    if (amount < 0.01) {
      return amount.toFixed(Math.min(decimals, 8));
    }
    
    // For larger amounts, show reasonable precision
    return amount.toFixed(Math.min(4, decimals));
  }

  async validateTokenMint(tokenMint: string): Promise<boolean> {
    try {
      const publicKey = new PublicKey(tokenMint);
      await getMint(this.connection, publicKey);
      return true;
    } catch {
      return false;
    }
  }
}

// Price fetching utilities (mock implementation - in production, use real price APIs)
export class TokenPriceService {
  private static priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private static CACHE_DURATION = 60000; // 1 minute

  static async getTokenPrice(tokenMint: string): Promise<number> {
    const cached = this.priceCache.get(tokenMint);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.price;
    }

    // Mock prices for demo - in production, integrate with CoinGecko, Jupiter, etc.
    const mockPrices: Record<string, number> = {
      [SOL_TOKEN.mint]: 150.00, // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.00, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.00, // USDT
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 155.50, // mSOL
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 0.00002341, // BONK
      'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 0.85, // JUP
    };

    const price = mockPrices[tokenMint] || 0;
    this.priceCache.set(tokenMint, { price, timestamp: now });
    
    return price;
  }

  static async getTokenValueInUSD(amount: number, tokenMint: string): Promise<number> {
    const price = await this.getTokenPrice(tokenMint);
    return amount * price;
  }
}

export { TOKEN_PROGRAM_ID };
