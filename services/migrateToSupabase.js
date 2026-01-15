// =====================================================
// Script de Migração: localStorage -> Supabase
// =====================================================
// Este script migra dados históricos do localStorage
// para o Supabase (SBD).
// =====================================================

import { supabaseDB } from './supabaseDB.js';
import { db } from './db.js';
import { resolveStoreId } from './supabaseSync.js';

/**
 * Migra cupons do localStorage para Supabase
 */
export const migrateCoupons = async () => {
  try {
    const localCoupons = db.coupons.list();
    console.log(`[migrateCoupons] Encontrados ${localCoupons.length} cupons no localStorage`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const coupon of localCoupons) {
      try {
        // Verificar se já existe no SBD
        const existing = await supabaseDB.coupons.findByCode(coupon.code);
        if (existing) {
          console.log(`[migrateCoupons] Cupom ${coupon.code} já existe no SBD, pulando...`);
          continue;
        }
        
        // Criar no SBD
        await supabaseDB.coupons.create(coupon, { name: 'Sistema', cpf: '00000000000', role: 'admin' });
        migrated++;
        console.log(`[migrateCoupons] ✅ Cupom migrado: ${coupon.code}`);
      } catch (error) {
        errors++;
        console.error(`[migrateCoupons] ❌ Erro ao migrar cupom ${coupon.code}:`, error);
      }
    }
    
    console.log(`[migrateCoupons] Migração concluída: ${migrated} migrados, ${errors} erros`);
    return { migrated, errors, total: localCoupons.length };
  } catch (error) {
    console.error('[migrateCoupons] Erro geral na migração:', error);
    return { migrated: 0, errors: 0, total: 0 };
  }
};

/**
 * Migra despesas do localStorage para Supabase
 */
export const migrateExpenses = async () => {
  try {
    const localExpenses = db.expenses.list();
    console.log(`[migrateExpenses] Encontradas ${localExpenses.length} despesas no localStorage`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const expense of localExpenses) {
      try {
        // Criar no SBD (não há verificação de duplicatas por enquanto)
        await supabaseDB.expenses.create(expense, { name: expense.created_by || 'Sistema', cpf: '00000000000', role: 'admin' });
        migrated++;
        console.log(`[migrateExpenses] ✅ Despesa migrada: ${expense.description}`);
      } catch (error) {
        errors++;
        console.error(`[migrateExpenses] ❌ Erro ao migrar despesa ${expense.id}:`, error);
      }
    }
    
    console.log(`[migrateExpenses] Migração concluída: ${migrated} migradas, ${errors} erros`);
    return { migrated, errors, total: localExpenses.length };
  } catch (error) {
    console.error('[migrateExpenses] Erro geral na migração:', error);
    return { migrated: 0, errors: 0, total: 0 };
  }
};

/**
 * Migra fechamentos de caixa do localStorage para Supabase
 */
export const migrateClosures = async () => {
  try {
    const localClosures = db.closures.list();
    console.log(`[migrateClosures] Encontrados ${localClosures.length} fechamentos no localStorage`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const closure of localClosures) {
      try {
        // Verificar se já existe no SBD (por data)
        const existing = await supabaseDB.closures.getByDate(closure.date);
        if (existing) {
          console.log(`[migrateClosures] Fechamento de ${closure.date} já existe no SBD, pulando...`);
          continue;
        }
        
        // Criar no SBD
        await supabaseDB.closures.create(closure, { name: closure.created_by || 'Sistema', cpf: '00000000000', role: 'admin' });
        migrated++;
        console.log(`[migrateClosures] ✅ Fechamento migrado: ${closure.date}`);
      } catch (error) {
        errors++;
        console.error(`[migrateClosures] ❌ Erro ao migrar fechamento ${closure.id}:`, error);
      }
    }
    
    console.log(`[migrateClosures] Migração concluída: ${migrated} migrados, ${errors} erros`);
    return { migrated, errors, total: localClosures.length };
  } catch (error) {
    console.error('[migrateClosures] Erro geral na migração:', error);
    return { migrated: 0, errors: 0, total: 0 };
  }
};

/**
 * Migra todas as vendas pendentes do localStorage para Supabase
 */
export const migratePendingSales = async () => {
  try {
    const storeId = resolveStoreId();
    const pendingKey = `pendingSales_${storeId}`;
    const pendingSales = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    
    console.log(`[migratePendingSales] Encontradas ${pendingSales.length} vendas pendentes`);
    
    let migrated = 0;
    let errors = 0;
    const remaining = [];
    
    for (const pending of pendingSales) {
      try {
        // Tentar criar venda atomicamente no SBD
        const result = await supabaseDB.sales.callCreateSaleAtomic(
          pending.sale,
          pending.external_id
        );
        
        if (result.status === 'ok' || result.status === 'already_exists') {
          migrated++;
          console.log(`[migratePendingSales] ✅ Venda migrada: ${pending.external_id}`);
        } else {
          // Manter na fila se falhar
          remaining.push(pending);
          errors++;
          console.log(`[migratePendingSales] ⚠️ Venda não migrada: ${pending.external_id} - ${result.message}`);
        }
      } catch (error) {
        remaining.push(pending);
        errors++;
        console.error(`[migratePendingSales] ❌ Erro ao migrar venda ${pending.external_id}:`, error);
      }
    }
    
    // Atualizar fila de pendentes
    localStorage.setItem(pendingKey, JSON.stringify(remaining));
    
    console.log(`[migratePendingSales] Migração concluída: ${migrated} migradas, ${errors} erros, ${remaining.length} ainda pendentes`);
    return { migrated, errors, remaining: remaining.length, total: pendingSales.length };
  } catch (error) {
    console.error('[migratePendingSales] Erro geral na migração:', error);
    return { migrated: 0, errors: 0, remaining: 0, total: 0 };
  }
};

/**
 * Migra todos os dados do localStorage para Supabase
 */
export const migrateAll = async () => {
  console.log('=== INICIANDO MIGRAÇÃO COMPLETA ===');
  
  const results = {
    coupons: await migrateCoupons(),
    expenses: await migrateExpenses(),
    closures: await migrateClosures(),
    pendingSales: await migratePendingSales(),
  };
  
  console.log('=== MIGRAÇÃO COMPLETA CONCLUÍDA ===');
  console.log('Resultados:', results);
  
  return results;
};

// Exportar função para uso no console do navegador
if (typeof window !== 'undefined') {
  window.migrateToSupabase = {
    coupons: migrateCoupons,
    expenses: migrateExpenses,
    closures: migrateClosures,
    pendingSales: migratePendingSales,
    all: migrateAll,
  };
  
  console.log('✅ Funções de migração disponíveis em window.migrateToSupabase');
  console.log('   Exemplo: await window.migrateToSupabase.all()');
}

