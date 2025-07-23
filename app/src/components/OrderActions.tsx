'use client';

import React from 'react';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Order } from '@/types/escrow';
import { useNotifications } from './Notifications';
import escrowIdl from '@/idl/escrow.json';

interface OrderActionsProps {
  order: Order;
  onAction: (updatedOrder: Order) => void;
}

export function OrderActions({ order, onAction }: OrderActionsProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { success, error } = useNotifications();
  const [loading, setLoading] = React.useState(false);

  const getProgram = () => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;
    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, signAllTransactions },
      { commitment: 'confirmed' }
    );
    return new Program(escrowIdl as Program['idl'], provider);
  };

  const handleApproveDeadline = async () => {
    const program = getProgram();
    if (!program || !publicKey) {
      error('Wallet Error', 'Please connect your wallet');
      return;
    }

    setLoading(true);
    try {
      const now = new BN(Math.floor(Date.now() / 1000));
      await program.methods
        .approveDeadline(now)
        .accounts({
          order: order.id,
          importer: publicKey,
        })
        .rpc();

      const updatedOrder = { ...order, state: 'PendingShipment' };
      success('Deadline Approved', 'The order is now pending shipment.');
      onAction(updatedOrder);
    } catch (err) {
      console.error('Error approving deadline:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      error('Approval Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) return null;

  const isImporter = order.importer === publicKey.toString();
  const canApprove = isImporter && order.state === 'PendingDeadlineApproval';

  return (
    <div className="mt-4 pt-4 border-t border-gray-200/80 flex items-center justify-end space-x-3">
      {canApprove && (
        <button
          onClick={handleApproveDeadline}
          disabled={loading}
          className="px-3 py-1 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Approving...' : 'Approve Deadline'}
        </button>
      )}
    </div>
  );
}
