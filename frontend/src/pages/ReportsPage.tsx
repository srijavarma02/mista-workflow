import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, BarChart3, ShoppingCart, TrendingUp } from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: utilization } = useQuery({
    queryKey: ['report-utilization'],
    queryFn: () => api.get('/reports/utilization').then(r => r.data),
  });

  const download = async (url: string, filename: string) => {
    try {
      const res = await api.get(url, {
        responseType: 'blob',
        params: url.includes('consumption') ? { start: startDate, end: endDate } : undefined,
      });
      const href = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(href);
      toast.success(`${filename} downloaded`);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-gray-500 text-sm">Generate and download reports in PDF or Excel format</p>
      </div>

      {/* Date Range */}
      <div className="card flex gap-4 items-end flex-wrap">
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="label">End Date</label>
          <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inventory Reports */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="font-semibold">Inventory Report</h3>
              <p className="text-xs text-gray-500">Complete stock status with values</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-xs" onClick={() => download('/reports/inventory/pdf', 'inventory_report.pdf')}>
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button className="btn-secondary text-xs" onClick={() => download('/reports/inventory/excel', 'inventory_report.xlsx')}>
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
          </div>
        </div>

        {/* Consumption Report */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <h3 className="font-semibold">Consumption Report</h3>
              <p className="text-xs text-gray-500">Material usage for date range</p>
            </div>
          </div>
          <button className="btn-success text-xs" onClick={() => download('/reports/consumption/excel', `consumption_${startDate}_${endDate}.xlsx`)}>
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>

        {/* Procurement Report */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <h3 className="font-semibold">Procurement Report</h3>
              <p className="text-xs text-gray-500">Purchase orders and vendor summary</p>
            </div>
          </div>
          <button className="btn-secondary text-xs" onClick={() => download('/reports/procurement', 'procurement_report.json')}>
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
        </div>

        {/* Utilization Report */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-700" />
            </div>
            <div>
              <h3 className="font-semibold">Utilization Report</h3>
              <p className="text-xs text-gray-500">Received / Issued / Returned / Balance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Utilization Table */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Material Utilization Summary</h2>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Item Code</th><th>Material</th><th>Category</th><th>Unit</th>
                <th>Total Received</th><th>Total Issued</th><th>Total Returned</th><th>Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {(utilization?.data || []).map((row: {
                item_code: string; material_name: string; category: string; unit: string;
                total_received: number; total_issued: number; total_returned: number; current_stock: number;
              }) => (
                <tr key={row.item_code}>
                  <td className="font-mono text-xs">{row.item_code}</td>
                  <td className="font-medium">{row.material_name}</td>
                  <td>{row.category}</td>
                  <td>{row.unit}</td>
                  <td className="text-green-700">{parseFloat(row.total_received as unknown as string).toLocaleString()}</td>
                  <td className="text-orange-600">{parseFloat(row.total_issued as unknown as string).toLocaleString()}</td>
                  <td className="text-blue-600">{parseFloat(row.total_returned as unknown as string).toLocaleString()}</td>
                  <td className="font-bold">{parseFloat(row.current_stock as unknown as string).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(utilization?.data?.length) && (
            <div className="text-center py-8 text-gray-400">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
