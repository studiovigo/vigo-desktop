import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabaseClient';
import { Card } from './SimpleUI';

// Helper: Format currency in BRL
const formatBRL = (value) => {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `R$ ${(Number(value || 0)).toFixed(2)}`;
  }
};

// Helper: Get month name in Portuguese
const getMonthName = (date) => {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months[date.getMonth()];
};

// Helper: Generate last 6 months structure
const generateLast6Months = () => {
  const result = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: `${getMonthName(date)}/${date.getFullYear().toString().slice(2)}`,
      value: 0
    });
  }
  
  return result;
};

// Custom Tooltip for the chart
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-medium text-slate-700">{payload[0].payload.label}</p>
        <p className="text-lg font-bold text-blue-600">{formatBRL(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function RevenueChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range (last 6 months)
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
      
      // Fetch data from Supabase
      const { data, error: fetchError } = await supabase
        .from('cash_closures')
        .select('created_at, total_sales')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('[RevenueChart] Error fetching data:', fetchError);
        throw fetchError;
      }

      // Initialize structure with all 6 months at 0
      const monthsMap = generateLast6Months();

      // Aggregate data by month
      if (data && data.length > 0) {
        data.forEach(closure => {
          const closureDate = new Date(closure.created_at);
          const year = closureDate.getFullYear();
          const month = closureDate.getMonth();
          
          // Find corresponding month in our structure
          const monthEntry = monthsMap.find(m => m.year === year && m.month === month);
          if (monthEntry) {
            monthEntry.value += Number(closure.total_sales || 0);
          }
        });
      }

      setChartData(monthsMap);
      setLoading(false);
    } catch (err) {
      console.error('[RevenueChart] Failed to fetch revenue data:', err);
      setError(err.message || 'Erro ao carregar dados');
      setLoading(false);
      // Even on error, show empty chart
      setChartData(generateLast6Months());
    }
  };

  if (loading) {
    return (
      <Card className="p-6 rounded-xl min-h-[300px]">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
          <div className="h-64 bg-slate-100 rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 rounded-xl min-h-[300px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg text-slate-800">Faturamento (Últimos 6 Meses)</h3>
        {error && (
          <span className="text-xs text-red-500">⚠ {error}</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 12 }}
            axisLine={{ stroke: '#cbd5e1' }}
            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
          <Bar
            dataKey="value"
            fill="#3b82f6"
            radius={[8, 8, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary below chart */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-sm font-bold text-slate-700">
              {formatBRL(chartData.reduce((sum, m) => sum + m.value, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Média Mensal</p>
            <p className="text-sm font-bold text-slate-700">
              {formatBRL(chartData.reduce((sum, m) => sum + m.value, 0) / 6)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Mês Atual</p>
            <p className="text-sm font-bold text-blue-600">
              {formatBRL(chartData[5]?.value || 0)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
