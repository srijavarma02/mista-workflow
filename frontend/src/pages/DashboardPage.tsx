import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import {
  Package, AlertTriangle, ClipboardList, ShoppingCart,
  TrendingUp, IndianRupee, Clock, CheckCircle,
} from 'lucide-react';
import api from '../api/client';

interface DashboardData {
  summary: {
    totalItems: number;
    totalInventoryValue: number;
    lowStockItems: number;
    pendingMRFs: number;
    activePOs: number;
    monthlyProcurementCost: number;
    pendingInspections: number;
  };
  consumptionTrend: { month: string; value: number }[];
  topConsumedMaterials: { material_name: string; qty_consumed: number; unit: string }[];
  recentIssues: { issue_number: string; issue_date: string; status: string; issued_to: string; project_name: string }[];
  recentGRNs: { grn_number: string; received_date: string; status: string; vendor_name: string }[];
}

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'badge-yellow', approved: 'badge-blue', issued: 'badge-green',
    accepted: 'badge-green', rejected: 'badge-red', inspected: 'badge-blue',
    submitted: 'badge-yellow',
  };
  return <span className={map[status] || 'badge-gray'}>{status}</span>;
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const d = data?.data;
  if (!d) return null;

  const fmt = (n: number) =>
    n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
    : n >= 100000  ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000    ? `₹${(n / 1000).toFixed(0)}K`
    : `₹${n}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Real-time stores and inventory overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Inventory Value" value={fmt(d.summary.totalInventoryValue)} icon={IndianRupee} color="bg-primary-700" sub={`${d.summary.totalItems} items`} />
        <StatCard label="Low Stock Items" value={String(d.summary.lowStockItems)} icon={AlertTriangle} color={d.summary.lowStockItems > 0 ? 'bg-warning-500' : 'bg-success-500'} sub="Below reorder level" />
        <StatCard label="Pending Approvals" value={String(d.summary.pendingMRFs)} icon={ClipboardList} color="bg-blue-500" sub="Material requests" />
        <StatCard label="Active POs" value={String(d.summary.activePOs)} icon={ShoppingCart} color="bg-purple-600" sub="In progress" />
        <StatCard label="Monthly Procurement" value={fmt(d.summary.monthlyProcurementCost)} icon={TrendingUp} color="bg-emerald-600" sub="Current month" />
        <StatCard label="Pending Inspections" value={String(d.summary.pendingInspections)} icon={Clock} color={d.summary.pendingInspections > 0 ? 'bg-orange-500' : 'bg-success-500'} sub="GRNs awaiting QA/QC" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumption Trend */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Monthly Consumption (₹)</h2>
          {d.consumptionTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={d.consumptionTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>

        {/* Top Consumed */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Top Consumed This Month</h2>
          {d.topConsumedMaterials.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.topConsumedMaterials} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="material_name" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip />
                <Bar dataKey="qty_consumed" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No issue data yet</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Material Issues</h2>
          <div className="space-y-2">
            {d.recentIssues.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No recent issues</p>
            ) : d.recentIssues.map((i) => (
              <div key={i.issue_number} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{i.issue_number}</p>
                  <p className="text-xs text-gray-500">{i.issued_to} · {i.project_name}</p>
                </div>
                {statusBadge(i.status)}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Recent GRNs</h2>
          <div className="space-y-2">
            {d.recentGRNs.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No recent GRNs</p>
            ) : d.recentGRNs.map((g) => (
              <div key={g.grn_number} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{g.grn_number}</p>
                  <p className="text-xs text-gray-500">{g.vendor_name} · {new Date(g.received_date).toLocaleDateString()}</p>
                </div>
                {statusBadge(g.status)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
