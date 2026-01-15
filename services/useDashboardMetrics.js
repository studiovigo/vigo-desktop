import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

// Helpers
const formatBRL = (value) => {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    const n = Number(value || 0);
    return `R$ ${n.toFixed(2)}`;
  }
};

const coerceNum = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);

// Calculate first day and start of next month
const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end: next };
};

/**
 * Busca métricas do mês atual a partir da tabela cash_closures.
 * Soma: total_sales, total_costs, total_expenses
 * Calcula: profit = revenue - costs - expenses
 */
export const fetchClosureMetrics = async ({ start, end } = {}) => {
  // Default to current month window
  const range = getCurrentMonthRange();
  const startDate = (start instanceof Date ? start : range.start);
  const endDate = (end instanceof Date ? end : range.end);
  
  // Convert to date strings for comparison (YYYY-MM-DD)
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('cash_closures')
      .select('id,total_sales,total_costs,total_expenses,date,created_at')
      .gte('date', startStr)
      .lt('date', endStr);

    if (error) throw error;

    const closures = Array.isArray(data) ? data : [];
    console.log('Fechamentos encontrados:', closures);

    let revenue = 0;   // sum total_sales
    let costs = 0;     // sum total_costs
    let expenses = 0;  // sum total_expenses

    for (const c of closures) {
      revenue += coerceNum(c.total_sales);
      costs += coerceNum(c.total_costs);
      expenses += coerceNum(c.total_expenses);
    }

    // Profit = Revenue - Costs - Expenses
    const profit = revenue - costs - expenses;

    // Build result
    const formatted = {
      revenue: formatBRL(revenue),
      costs: formatBRL(costs),
      expenses: formatBRL(expenses),
      profit: formatBRL(profit),
    };

    return {
      formatted,
      raw: { revenue, costs, expenses, profit },
      closures,
    };
  } catch (error) {
    console.error('Erro ao buscar métricas de fechamentos:', error);
    throw error;
  }
};

/**
 * React hook: busca fechamentos do mês atual e computa métricas para os cards.
 * Retorna valores formatados (BRL) e também os numéricos crus.
 */
export function useClosureMetrics(options = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(() => ({
    formatted: {
      revenue: formatBRL(0),
      costs: formatBRL(0),
      expenses: formatBRL(0),
      profit: formatBRL(0),
    },
    raw: { revenue: 0, costs: 0, expenses: 0, profit: 0 },
    closures: [],
  }));

  const { start, end } = useMemo(() => {
    if (options.start || options.end) return { start: options.start, end: options.end };
    return getCurrentMonthRange();
  }, [options.start, options.end]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchClosureMetrics({ start, end });
      setResult(r);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetchClosureMetrics({ start, end });
        if (!cancelled) setResult(r);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  return { ...result, loading, error, refresh };
}

// Mantém a função anterior para compatibilidade (se necessário)
export const useDashboardMetrics = useClosureMetrics;
