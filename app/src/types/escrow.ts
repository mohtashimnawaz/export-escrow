import { ComponentType } from 'react';

export interface Order {
  id: string;
  title: string;
  amount: number;
  currency: {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  };
  state: string;
  importer: string;
  exporter: string;
  verifier: string;
  createdAt: number;
  deadline: number;
  description: string;
  category: string;
  tags: string[];
}

export type OrderState = 
  | 'PendingDeadlineApproval'
  | 'PendingShipment'
  | 'InTransit'
  | 'Delivered'
  | 'Completed'
  | 'Refunded'
  | 'Disputed'
  | 'PendingExtensionApproval';

export type UserRole = 'importer' | 'exporter' | 'verifier';

export interface EscrowAction {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: 'green' | 'blue' | 'yellow' | 'red' | 'purple';
}
