/**
 * Mock QuickBooks Online Service Layer
 * 
 * Simulates QBO API responses for development.
 * When real QBO integration is ready, swap these functions
 * with actual API calls via edge functions.
 */

// Simulated delay to mimic API latency
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface QBOConnectionStatus {
  connected: boolean;
  companyName: string | null;
  lastSyncAt: string | null;
  realmId: string | null;
}

export interface QBORetainerBalance {
  customerId: string;
  customerName: string;
  balance: number;
  lastUpdated: string;
}

export interface QBOInvoiceDraft {
  qboInvoiceId: string;
  docNumber: string;
  syncedAt: string;
}

export interface QBOPaymentStatus {
  qboInvoiceId: string;
  status: "unpaid" | "partial" | "paid";
  amountPaid: number;
  paymentDate: string | null;
}

// Mock retainer balances keyed by client name (for demo purposes)
const MOCK_RETAINERS: Record<string, number> = {
  "Matthew Victor": 10000,
  "Rudin Management": 0,
  "Silverstein Properties": 25000,
  "Related Companies": 50000,
  "Brookfield Properties": 15000,
  "Tishman Speyer": 0,
  "SL Green": 8000,
  "Vornado Realty": 0,
  "Mack Real Estate": 12000,
  "Extell Development": 35000,
};

/**
 * Check mock QBO connection status
 */
export async function getQBOConnectionStatus(): Promise<QBOConnectionStatus> {
  await delay(300);
  // Return mock connected state
  return {
    connected: true,
    companyName: "Green Light Expediting LLC",
    lastSyncAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
    realmId: "9341452146789",
  };
}

/**
 * Get retainer balance for a client from QBO
 */
export async function getRetainerBalance(
  clientName: string
): Promise<QBORetainerBalance> {
  await delay(500);
  const balance = MOCK_RETAINERS[clientName] ?? Math.random() > 0.4
    ? Math.floor(Math.random() * 20000) + 1000
    : 0;

  return {
    customerId: `QBO-${Math.floor(Math.random() * 9999)}`,
    customerName: clientName,
    balance,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create a draft invoice in QBO
 */
export async function createQBODraft(invoice: {
  invoiceNumber: string;
  clientName: string;
  lineItems: { description: string; amount: number }[];
  totalDue: number;
}): Promise<QBOInvoiceDraft> {
  await delay(800);
  return {
    qboInvoiceId: `QBO-INV-${Math.floor(Math.random() * 99999)}`,
    docNumber: invoice.invoiceNumber,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Check payment status of an invoice in QBO
 */
export async function syncPaymentStatus(
  qboInvoiceId: string
): Promise<QBOPaymentStatus> {
  await delay(400);
  // Randomize payment status for demo
  const rand = Math.random();
  if (rand > 0.7) {
    return {
      qboInvoiceId,
      status: "paid",
      amountPaid: Math.floor(Math.random() * 10000) + 500,
      paymentDate: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString(),
    };
  } else if (rand > 0.4) {
    return {
      qboInvoiceId,
      status: "partial",
      amountPaid: Math.floor(Math.random() * 3000) + 200,
      paymentDate: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000).toISOString(),
    };
  }
  return {
    qboInvoiceId,
    status: "unpaid",
    amountPaid: 0,
    paymentDate: null,
  };
}

/**
 * Sync all customers from QBO (mock)
 */
export async function syncCustomers(): Promise<{ synced: number; errors: number }> {
  await delay(1500);
  return { synced: 47, errors: 0 };
}

/**
 * Disconnect QBO (mock)
 */
export async function disconnectQBO(): Promise<void> {
  await delay(300);
}
