'use client';

import React, { useState } from 'react';
import { Copy, Eye, EyeOff, Info } from 'lucide-react';

export function TestWalletHelper() {
  const [isVisible, setIsVisible] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const testAccounts = [
    {
      role: 'Importer',
      address: 'Hzy81inT9z7YaKBkDxG58DYwGksoJNPQEr6REcFGHXkN',
      seedPhrase: 'nature ripple unknown profit weekend gift forward helmet obvious video pear surge',
      color: 'blue',
      actions: 'Approve deadlines, Confirm delivery'
    },
    {
      role: 'Exporter', 
      address: 'Dbz2Y1yPtaJ6LiLtLujXoFokrnfGWoJYNREpdAcmrX7T',
      seedPhrase: 'title nuclear gallery clock noble coyote basket today debris shadow smart pattern',
      color: 'green',
      actions: 'Ship goods, Request extensions'
    },
    {
      role: 'Verifier',
      address: 'HQo4Gy3XWnn4ZZYP6HEf5WnL3b8EEmL6mVP1ywekgQXK', 
      seedPhrase: 'welcome warrior three pilot choose breeze stool filter duck approve conduct found',
      color: 'purple',
      actions: 'Confirm delivery, Resolve disputes'
    }
  ];

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(`${type}`);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-full shadow-lg transition-colors z-50"
        title="Show test wallet info"
      >
        <Info className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-96 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">🧪 Test Wallets</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <EyeOff className="h-4 w-4" />
        </button>
      </div>

      <div className="text-xs text-gray-600 mb-3">
        Import these seed phrases into Phantom wallet to test different roles:
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {testAccounts.map((account) => (
          <div key={account.role} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium text-${account.color}-600`}>
                {account.role}
              </span>
              <span className="text-xs text-gray-500">{account.actions}</span>
            </div>
            
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Address:</span>
                  <button
                    onClick={() => copyToClipboard(account.address, `${account.role}-address`)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copiedAddress === `${account.role}-address` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-xs font-mono bg-gray-50 p-1 rounded text-gray-700 break-all">
                  {account.address}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Seed Phrase:</span>
                  <button
                    onClick={() => copyToClipboard(account.seedPhrase, `${account.role}-seed`)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copiedAddress === `${account.role}-seed` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="text-xs font-mono bg-gray-50 p-1 rounded text-gray-700">
                  {account.seedPhrase}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-500">
        💡 Each account has 100 SOL for testing. Refresh page after switching wallets.
      </div>
    </div>
  );
}
