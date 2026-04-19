const API_BASE = "/api";

export interface DashboardStats {
  money_laundering: {
    wallet_count: number;
    alert_count: number;
    icon: string;
    color: string;
  };
  manipulation: {
    wallet_count: number;
    alert_count: number;
    icon: string;
    color: string;
  };
  scam: {
    wallet_count: number;
    alert_count: number;
    icon: string;
    color: string;
  };
  overview: {
    total_wallets: number;
    total_alerts: number;
    critical_alerts: number;
    alerts_today: number;
    total_blocked: number;
  };
}

export interface Wallet {
  id: string;
  address: string;
  label: string | null;
  entity_type: string;
  account_status: string;
  risk_score: number;
  risk_category: string | null;
  total_transactions: number;
  first_seen_at: string;
  last_activity_at: string;
  flagged_at: string | null;
  notes: string | null;
  ai_insight?: string;
}

export interface WalletConnection {
  address: string;
  direction: "incoming" | "outgoing";
  tx_count: number;
  total_value_eth: number;
  label: string | null;
  entity_type: string;
  risk_score: number;
  account_status: string;
}

export interface WalletConnectionsResponse {
  wallet: {
    address: string;
    label: string | null;
    risk_score: number;
    entity_type: string;
  };
  connections: WalletConnection[];
  total_connections: number;
}

export interface Alert {
  alert_id: string;
  wallet_address: string;
  alert_type: string;
  severity: string;
  message: string;
  risk_score: number;
  context: Record<string, unknown>;
  detected_at: string;
  acknowledged: boolean;
}

export interface BlockedTransfer {
  id: string;
  sender_address: string;
  receiver_address: string;
  amount_eth: number;
  risk_score: number;
  block_reason: string;
  user_warning_count: number;
  blocked_at: string;
}

export interface WalletBalance {
  address: string;
  balance_wei: string;
  balance_eth: number;
  risk_score: number;
  total_transactions: number;
}

export interface Transaction {
  tx_hash: string;
  from_address: string;
  to_address: string;
  value_wei: string;
  block_number: number;
  timestamp: string;
  gas_price: string;
  gas_used: number;
  status: number;
  is_flagged: boolean;
  flag_reason: string | null;
}

export interface TransferResponse {
  status: "success" | "warning" | "blocked";
  requires_confirmation?: boolean;
  receiver_risk?: number;
  current_warnings?: number;
  max_warnings?: number;
  message: string;
  warning_text?: string;
  tx_hash?: string;
}

export interface FlowStats {
  date: string;
  inflow: number;
  outflow: number;
}

export interface AssistantChatResponse {
  answer: string;
  context: {
    role: string;
    overview: {
      total_wallets: number;
      total_alerts: number;
      critical_alerts: number;
      alerts_today: number;
      total_blocked: number;
    };
    top_risky_wallets: Array<{
      address: string;
      label: string | null;
      risk_score: number;
      account_status: string;
    }>;
    wallet_focus?: {
      address: string;
      exists: boolean;
      risk_score: number;
      account_status: string | null;
      label: string | null;
      transaction_count: number;
      alert_count: number;
    } | null;
  };
  sources: string[];
  knowledge_sources: Array<{
    source: string;
    heading: string;
    score: number;
  }>;
  model_enabled: boolean;
}

// API Functions
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/statistics/dashboard`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

export async function fetchWallets(params?: {
  risk_category?: string;
  account_status?: string;
  min_risk_score?: number;
  limit?: number;
}): Promise<Wallet[]> {
  const searchParams = new URLSearchParams();
  if (params?.risk_category) searchParams.set("risk_category", params.risk_category);
  if (params?.account_status) searchParams.set("account_status", params.account_status);
  if (params?.min_risk_score) searchParams.set("min_risk_score", params.min_risk_score.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());

  const res = await fetch(`${API_BASE}/wallets?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch wallets");
  const data = await res.json();
  return data.wallets || [];
}

export interface WalletStats {
  address: string;
  eth_sent: number;
  eth_received: number;
  eth_balance: number;
  sent_count: number;
  received_count: number;
  total_transactions: number;
  wallet_info: {
    label: string | null;
    entity_type: string;
    risk_score: number;
    account_status: string | null;
  } | null;
}

export interface WalletTransaction {
  tx_hash: string;
  direction: "sent" | "received";
  counterparty: string;
  counterparty_label: string | null;
  counterparty_risk: number;
  value_eth: number;
  block_number: number;
  timestamp: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
}

export async function fetchWalletStats(address: string): Promise<WalletStats> {
  const res = await fetch(`${API_BASE}/wallets/${address}/stats`);
  if (!res.ok) throw new Error("Failed to fetch wallet stats");
  return res.json();
}

export async function fetchWalletTransactionHistory(
  address: string,
  limit = 50
): Promise<WalletTransaction[]> {
  const res = await fetch(`${API_BASE}/wallets/${address}/transactions?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch wallet transactions");
  const data = await res.json();
  return data.transactions || [];
}

export async function updateWalletStatus(
  address: string,
  status: string,
  notes?: string
): Promise<Wallet> {
  const res = await fetch(`${API_BASE}/wallets/${address}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) throw new Error("Failed to update wallet status");
  return res.json();
}

export async function fetchWalletConnections(address: string): Promise<WalletConnectionsResponse> {
  const res = await fetch(`${API_BASE}/wallets/${address}/connections`);
  if (!res.ok) throw new Error("Failed to fetch wallet connections");
  return res.json();
}

export async function fetchRecentAlerts(limit = 50): Promise<{ alerts: Alert[]; statistics: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/alerts/recent?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch recent alerts");
  const data = await res.json();
  return { alerts: data.alerts || [], statistics: data.statistics || {} };
}

export async function fetchLatestAlerts(): Promise<Alert[]> {
  const res = await fetch(`${API_BASE}/alerts/latest`);
  if (!res.ok) throw new Error("Failed to fetch latest alerts");
  const data = await res.json();
  return data.alerts || [];
}

export async function fetchBlockedTransfers(): Promise<BlockedTransfer[]> {
  const res = await fetch(`${API_BASE}/blocked-transfers`);
  if (!res.ok) throw new Error("Failed to fetch blocked transfers");
  const data = await res.json();
  return data.blocked_transfers || [];
}

export async function fetchFlowStats(): Promise<FlowStats[]> {
  try {
    const res = await fetch(`${API_BASE}/statistics/flow?days=7`);
    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const flowData = data.flow_data || data;
    if (!Array.isArray(flowData)) {
      return [];
    }

    return flowData.map((item: { date: string; inflow_eth?: number; outflow_eth?: number; inflow?: number; outflow?: number }) => ({
      date: item.date,
      inflow: item.inflow_eth ?? item.inflow ?? 0,
      outflow: item.outflow_eth ?? item.outflow ?? 0,
    }));
  } catch {
    return [];
  }
}

export interface UserHistory {
  blocked_transfers: BlockedTransfer[];
  successful_transactions: Transaction[];
  warnings: UserWarning[];
}

export interface UserWarning {
  id: string;
  wallet_address: string;
  target_address: string;
  warning_type: string;
  risk_score: number;
  user_action: string;
  warning_number: number;
  created_at: string;
}

export async function fetchUserHistory(walletAddress: string): Promise<UserHistory> {
  const res = await fetch(`${API_BASE}/user/${walletAddress}/history`);
  if (!res.ok) throw new Error("Failed to fetch user history");
  return res.json();
}

export async function fetchWalletBalance(address: string): Promise<WalletBalance> {
  const res = await fetch(`${API_BASE}/wallet/${address}/balance`);
  if (!res.ok) throw new Error("Failed to fetch wallet balance");
  return res.json();
}

export async function fetchWalletTransactions(
  address: string,
  limit = 20
): Promise<Transaction[]> {
  const res = await fetch(`${API_BASE}/wallet/${address}/transactions?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch wallet transactions");
  const data = await res.json();
  return data.transactions || [];
}

export async function sendProtectedTransfer(
  fromAddress: string,
  toAddress: string,
  amountEth: number,
  confirmRisk = false
): Promise<TransferResponse> {
  const res = await fetch(`${API_BASE}/transfer/protected`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from_wallet_id: fromAddress,
      to_wallet_id: toAddress,
      to_address: toAddress,
      amount_eth: amountEth,
      confirm_risk: confirmRisk,
    }),
  });
  if (!res.ok) throw new Error("Failed to send transfer");
  return res.json();
}

export async function analyzeAddress(address: string): Promise<{
  address: string;
  risk_score: number;
  risk_level: string;
  details: Record<string, any>;
  ai_insight: string;
  detection_count: number;
}> {
  const res = await fetch(`${API_BASE}/analyze/${address}`);
  if (!res.ok) throw new Error("Failed to analyze address");
  return res.json();
}

export async function askDashboardAssistant(
  message: string,
  role: string,
  walletAddress?: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AssistantChatResponse> {
  const res = await fetch(`${API_BASE}/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      role,
      wallet_address: walletAddress || null,
      conversation_history: conversationHistory || [],
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to get assistant response");
  }

  return res.json();
}
