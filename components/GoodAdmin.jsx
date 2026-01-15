import React, { useState, useEffect } from 'react';
import { Card, Button, Input } from './SimpleUI';
import { CheckCircle, XCircle, Users, Eye, Search, LogOut } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { approveSignup } from '../services/approveSignup';
import { format } from 'date-fns';

export default function GoodAdmin({ user }) {
  const [tab, setTab] = useState('approvals');
  const [pendingSignups, setPendingSignups] = useState([]);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSignup, setSelectedSignup] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Função de logout
  const handleLogout = async () => {
    if (!confirm('Tem certeza que deseja sair?')) {
      return;
    }

    try {
      // Fazer logout do Supabase
      await supabase.auth.signOut();
      
      // Limpar localStorage
      localStorage.removeItem('mozyc_pdv_current_user');
      localStorage.removeItem('mozyc_pdv_saved_credentials');
      
      // Redirecionar para login usando window.location.hash (HashRouter)
      window.location.hash = '#/login';
      // Forçar reload para limpar estado da aplicação
      setTimeout(() => {
        window.location.reload();
      }, 100);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, limpar e redirecionar
      localStorage.removeItem('mozyc_pdv_current_user');
      localStorage.removeItem('mozyc_pdv_saved_credentials');
      window.location.hash = '#/login';
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  // Carregar solicitações pendentes (apenas pending e rejected, não approved)
  const loadPendingSignups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_signups')
        .select('*')
        .in('status', ['pending', 'rejected']) // Apenas pendentes e rejeitados
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar solicitações:', error);
        alert('Erro ao carregar solicitações pendentes.');
        return;
      }

      setPendingSignups(data || []);
    } catch (err) {
      console.error('Erro inesperado:', err);
      alert('Erro ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar usuários aprovados
  const loadApprovedUsers = async () => {
    setLoading(true);
    try {
      // Buscar TODOS os usuários (ativos e inativos) - não filtrar por active
      // Isso permite ver e gerenciar todos os usuários aprovados
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Erro ao carregar usuários:', usersError);
        alert('Erro ao carregar usuários.');
        return;
      }

      // Adicionar informação de plano aos usuários (simplificado - sempre mostra "Sem plano")
      const usersWithPlans = (usersData || []).map(user => ({
        ...user,
        plan: 'Sem plano',
        planName: null
      }));

      setApprovedUsers(usersWithPlans);
    } catch (err) {
      console.error('Erro inesperado:', err);
      alert('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'approvals') {
      loadPendingSignups();
      // Carregar usuários também para verificar status nas solicitações aprovadas
      loadApprovedUsers();
    } else if (tab === 'users') {
      loadApprovedUsers();
    }
  }, [tab]);

  // Aprovar cadastro
  const handleApprove = async (signup) => {
    if (!confirm(`Aprovar cadastro de ${signup.admin_name} (${signup.store_name})?`)) {
      return;
    }

    setLoading(true);
    try {
      console.log('[handleApprove] Iniciando aprovação:', {
        signupId: signup.id,
        email: signup.email,
        adminName: signup.admin_name
      });

      const result = await approveSignup(signup.id, {
        email: signup.email,
        password_hash: signup.password_hash,
        admin_name: signup.admin_name,
        store_name: signup.store_name,
        cpf_cnpj: signup.cpf_cnpj,
        phone: signup.phone
      }, user.id);

      console.log('[handleApprove] Resultado da aprovação:', result);

      if (result.success) {
        // O registro já foi removido de pending_signups pelo approveSignup
        // Aguardar um pouco para garantir que o Supabase processou
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await loadPendingSignups();
        // Sempre recarregar lista de usuários para mostrar o novo usuário aprovado
        await loadApprovedUsers();
        
        // Verificar se o usuário foi criado
        const { data: verifyUser } = await supabase
          .from('users')
          .select('id, email, active')
          .eq('email', signup.email)
          .maybeSingle();
        
        if (verifyUser) {
          console.log('[handleApprove] Usuário verificado após aprovação:', verifyUser);
        } else {
          console.warn('[handleApprove] ATENÇÃO: Usuário não encontrado após aprovação!');
        }
        
        alert(result.message || 'Cadastro aprovado com sucesso!');
        // Opcional: mudar para aba de usuários para ver o novo usuário
        // setTab('users');
      } else {
        console.error('[handleApprove] Erro na aprovação:', result);
        alert(result.message || 'Erro ao aprovar cadastro.');
      }
    } catch (err) {
      console.error('[handleApprove] Erro ao aprovar:', err);
      alert(`Erro ao aprovar cadastro: ${err.message || 'Erro desconhecido'}. Verifique o console para mais detalhes.`);
    } finally {
      setLoading(false);
    }
  };

  // Rejeitar cadastro
  const handleReject = async (signup) => {
    const reason = prompt(`Rejeitar cadastro de ${signup.admin_name}?\n\nMotivo (opcional):`);
    if (reason === null) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pending_signups')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || null
        })
        .eq('id', signup.id);

      if (error) {
        console.error('Erro ao rejeitar:', error);
        alert('Erro ao rejeitar cadastro.');
        return;
      }

      await loadPendingSignups();
      alert('Cadastro rejeitado.');
    } catch (err) {
      console.error('Erro inesperado:', err);
      alert('Erro ao rejeitar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  // Desativar/Reativar solicitação aprovada (e o usuário correspondente)
  const handleToggleSignupStatus = async (signup, isCurrentlyActive) => {
    const action = isCurrentlyActive ? 'desativar' : 'reativar';
    
    if (!confirm(`Tem certeza que deseja ${action} a solicitação de ${signup.admin_name}? ${!isCurrentlyActive ? 'O usuário voltará a ter acesso ao sistema.' : 'O usuário perderá acesso ao sistema.'}`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`[handleToggleSignupStatus] Tentando ${action} solicitação:`, {
        signupId: signup.id,
        email: signup.email,
        isCurrentlyActive,
        newStatus: !isCurrentlyActive
      });

      // Encontrar o usuário correspondente na tabela users
      const { data: userData, error: findError } = await supabase
        .from('users')
        .select('id, active, email')
        .eq('email', signup.email)
        .maybeSingle();

      if (findError) {
        console.error('[handleToggleSignupStatus] Erro ao buscar usuário:', findError);
        alert(`Erro ao buscar usuário: ${findError.message}`);
        return;
      }

      if (userData?.id) {
        console.log(`[handleToggleSignupStatus] Usuário encontrado:`, userData);
        
        // Atualizar status do usuário na tabela users
        const { data: updateData, error: userError } = await supabase
          .from('users')
          .update({ active: !isCurrentlyActive })
          .eq('id', userData.id)
          .select();

        if (userError) {
          console.error('[handleToggleSignupStatus] Erro ao atualizar status do usuário:', userError);
          console.error('[handleToggleSignupStatus] Detalhes do erro:', {
            code: userError.code,
            message: userError.message,
            details: userError.details,
            hint: userError.hint
          });
          alert(`Erro ao atualizar status do usuário: ${userError.message || 'Erro desconhecido'}. Verifique o console para mais detalhes.`);
          return;
        }

        console.log(`[handleToggleSignupStatus] Usuário atualizado:`, updateData);

        // Verificar se a atualização foi aplicada
        const { data: verifyData, error: verifyError } = await supabase
          .from('users')
          .select('id, active, email')
          .eq('id', userData.id)
          .single();

        if (verifyError) {
          console.error('[handleToggleSignupStatus] Erro ao verificar atualização:', verifyError);
        } else {
          console.log('[handleToggleSignupStatus] Status verificado:', verifyData);
          if (verifyData.active !== !isCurrentlyActive) {
            console.warn(`[handleToggleSignupStatus] ATENÇÃO: Status não foi atualizado corretamente! Esperado: ${!isCurrentlyActive}, Atual: ${verifyData.active}`);
            alert(`Atenção: A atualização pode não ter sido aplicada. Status esperado: ${!isCurrentlyActive ? 'ativo' : 'inativo'}, Status atual: ${verifyData.active ? 'ativo' : 'inativo'}`);
          }
        }
      } else {
        console.warn('[handleToggleSignupStatus] Usuário não encontrado na tabela users:', signup.email);
        alert('Usuário correspondente não encontrado na tabela users.');
        return;
      }
      
      await loadPendingSignups();
      await loadApprovedUsers();
      alert(`Solicitação ${isCurrentlyActive ? 'desativada' : 'reativada'} com sucesso. O usuário ${isCurrentlyActive ? 'não poderá mais' : 'agora pode'} fazer login no sistema.`);
    } catch (err) {
      console.error('[handleToggleSignupStatus] Erro inesperado:', err);
      alert(`Erro ao ${action} solicitação: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Reativar solicitação rejeitada (voltar para pending)
  const handleReactivateRejected = async (signup) => {
    if (!confirm(`Reativar solicitação de ${signup.admin_name}? Ela voltará para o status "Pendente" e poderá ser aprovada novamente.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('pending_signups')
        .update({
          status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null
        })
        .eq('id', signup.id);

      if (error) {
        console.error('Erro ao reativar solicitação:', error);
        alert('Erro ao reativar solicitação.');
        return;
      }

      await loadPendingSignups();
      alert('Solicitação reativada. Ela voltou para o status "Pendente" e pode ser aprovada novamente.');
    } catch (err) {
      console.error('Erro inesperado:', err);
      alert('Erro ao reativar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  // Ativar/Desativar usuário (toggle)
  const handleToggleUserStatus = async (userId, currentStatus) => {
    // Tratar null/undefined como true (ativo por padrão)
    const isCurrentlyActive = currentStatus === true || currentStatus === null || currentStatus === undefined;
    const newStatus = !isCurrentlyActive;
    const action = newStatus ? 'ativar' : 'desativar';
    
    if (!confirm(`Tem certeza que deseja ${action} este usuário? ${!newStatus ? 'O usuário não terá mais acesso ao sistema.' : ''}`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`[handleToggleUserStatus] Tentando ${action} usuário:`, {
        userId,
        currentStatus,
        isCurrentlyActive,
        newStatus
      });

      const { data, error } = await supabase
        .from('users')
        .update({ active: newStatus })
        .eq('id', userId)
        .select();

      if (error) {
        console.error(`[handleToggleUserStatus] Erro ao ${action} usuário:`, error);
        console.error(`[handleToggleUserStatus] Detalhes do erro:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        alert(`Erro ao ${action} usuário: ${error.message || 'Erro desconhecido'}. Verifique o console para mais detalhes.`);
        return;
      }

      console.log(`[handleToggleUserStatus] Usuário ${action} com sucesso:`, data);

      // Verificar se a atualização foi aplicada
      const { data: verifyData, error: verifyError } = await supabase
        .from('users')
        .select('id, active, email')
        .eq('id', userId)
        .single();

      if (verifyError) {
        console.error(`[handleToggleUserStatus] Erro ao verificar atualização:`, verifyError);
      } else {
        console.log(`[handleToggleUserStatus] Status verificado:`, verifyData);
        if (verifyData.active !== newStatus) {
          console.warn(`[handleToggleUserStatus] ATENÇÃO: Status não foi atualizado corretamente! Esperado: ${newStatus}, Atual: ${verifyData.active}`);
          alert(`Atenção: A atualização pode não ter sido aplicada. Status esperado: ${newStatus ? 'ativo' : 'inativo'}, Status atual: ${verifyData.active ? 'ativo' : 'inativo'}`);
        }
      }

      await loadApprovedUsers();
      alert(`Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso. ${!newStatus ? 'O usuário não poderá mais fazer login no sistema.' : 'O usuário agora pode fazer login no sistema.'}`);
    } catch (err) {
      console.error('[handleToggleUserStatus] Erro inesperado:', err);
      alert(`Erro ao ${action} usuário: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Abrir modal de detalhes
  const openDetailsModal = (signup) => {
    setSelectedSignup(signup);
    setShowDetailsModal(true);
  };

  // Filtrar solicitações (já filtradas para não incluir approved)
  const filteredSignups = pendingSignups.filter(signup => {
    // Garantir que approved não apareça na aba de Aprovações
    if (signup.status === 'approved') {
      return false;
    }
    
    const matchesSearch = 
      signup.admin_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signup.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signup.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      signup.cpf_cnpj?.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || signup.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Filtrar usuários
  const filteredUsers = approvedUsers.filter(usr => {
    const matchesSearch = 
      usr.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usr.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usr.role?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">GoodAdmin</h1>
            <p className="text-slate-600">Gerenciamento de Cadastros e Usuários</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-[#d9b53f] hover:bg-red-500 text-white rounded-lg transition-colors duration-200"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button
            variant={tab === 'approvals' ? 'primary' : 'outline'}
            onClick={() => setTab('approvals')}
            className="rounded-full"
          >
            <CheckCircle size={18} className="mr-2" />
            Aprovações {pendingSignups.filter(s => s.status === 'pending').length > 0 && 
              `(${pendingSignups.filter(s => s.status === 'pending').length})`}
          </Button>
          <Button
            variant={tab === 'users' ? 'primary' : 'outline'}
            onClick={() => setTab('users')}
            className="rounded-full"
          >
            <Users size={18} className="mr-2" />
            Usuários Aprovados
          </Button>
        </div>

        {/* Tab: Aprovações */}
        {tab === 'approvals' && (
          <div className="space-y-4">
            {/* Filtros e Busca */}
            <Card className="p-4 rounded-xl">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <Input
                    placeholder="Buscar por nome, loja, email ou CPF/CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border rounded-lg px-3 py-2"
                  >
                    <option value="all">Todos os status</option>
                    <option value="pending">Pendentes</option>
                    <option value="rejected">Rejeitados</option>
                    {/* Aprovados não aparecem aqui, vão para Usuários Aprovados */}
                  </select>
                </div>
              </div>
            </Card>

            {/* Lista de Solicitações */}
            {loading ? (
              <Card className="p-8 text-center rounded-xl">
                <p>Carregando...</p>
              </Card>
            ) : filteredSignups.length === 0 ? (
              <Card className="p-8 text-center rounded-xl">
                <p className="text-slate-600">Nenhuma solicitação encontrada.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredSignups.map((signup) => (
                  <Card key={signup.id} className="p-4 rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{signup.admin_name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            signup.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            signup.status === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {signup.status === 'pending' ? 'Pendente' :
                             signup.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                          </span>
                        </div>
                        <p className="text-slate-600 mb-1"><strong>Loja:</strong> {signup.store_name}</p>
                        <p className="text-slate-600 mb-1"><strong>Email:</strong> {signup.email}</p>
                        <p className="text-slate-600 mb-1"><strong>CPF/CNPJ:</strong> {signup.cpf_cnpj}</p>
                        {signup.phone && (
                          <p className="text-slate-600 mb-1"><strong>Telefone:</strong> {signup.phone}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-2">
                          Criado em: {format(new Date(signup.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                        {signup.rejection_reason && (
                          <p className="text-sm text-red-600 mt-2">
                            <strong>Motivo da rejeição:</strong> {signup.rejection_reason}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant="outline"
                          onClick={() => openDetailsModal(signup)}
                          className="rounded-full text-sm"
                        >
                          <Eye size={16} className="mr-1" />
                          Ver Detalhes
                        </Button>
                        {signup.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              onClick={() => handleApprove(signup)}
                              disabled={loading}
                              className="rounded-full text-sm"
                            >
                              <CheckCircle size={16} className="mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleReject(signup)}
                              disabled={loading}
                              className="rounded-full text-sm text-red-600 border-red-300"
                            >
                              <XCircle size={16} className="mr-1" />
                              Rejeitar
                            </Button>
                          </>
                        )}
                        {signup.status === 'approved' && (
                          <>
                            {/* Verificar se o usuário correspondente está ativo ou inativo */}
                            {(() => {
                              const correspondingUser = approvedUsers.find(u => u.email === signup.email);
                              const isUserActive = correspondingUser?.active !== false;
                              
                              return (
                                <Button
                                  variant={isUserActive ? "outline" : "primary"}
                                  onClick={() => handleToggleSignupStatus(signup, isUserActive)}
                                  disabled={loading}
                                  className={`rounded-full text-sm ${
                                    isUserActive 
                                      ? 'text-red-600 border-red-300' 
                                      : 'text-green-600 border-green-300'
                                  }`}
                                >
                                  {isUserActive ? (
                                    <>
                                      <XCircle size={16} className="mr-1" />
                                      Desativar Solicitação
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle size={16} className="mr-1" />
                                      Reativar Solicitação
                                    </>
                                  )}
                                </Button>
                              );
                            })()}
                          </>
                        )}
                        {signup.status === 'rejected' && (
                          <Button
                            variant="primary"
                            onClick={() => handleReactivateRejected(signup)}
                            disabled={loading}
                            className="rounded-full text-sm"
                          >
                            <CheckCircle size={16} className="mr-1" />
                            Reativar para Aprovação
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Usuários Aprovados */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Busca */}
            <Card className="p-4 rounded-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <Input
                  placeholder="Buscar por nome, email ou role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
            </Card>

            {/* Lista de Usuários */}
            {loading ? (
              <Card className="p-8 text-center rounded-xl">
                <p>Carregando...</p>
              </Card>
            ) : filteredUsers.length === 0 ? (
              <Card className="p-8 text-center rounded-xl">
                <p className="text-slate-600">Nenhum usuário encontrado.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredUsers.map((usr) => (
                  <Card key={usr.id} className="p-4 rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg">{usr.name || 'Sem nome'}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            (usr.active === true || usr.active === null || usr.active === undefined) 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {(usr.active === true || usr.active === null || usr.active === undefined) ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            {usr.role === 'admin' ? 'Administrador' :
                             usr.role === 'gerente' ? 'Gerente' :
                             usr.role === 'caixa' ? 'Caixa' :
                             usr.role === 'goodadmin' ? 'Good Admin' : usr.role}
                          </span>
                        </div>
                        <p className="text-slate-600 mb-1"><strong>Email:</strong> {usr.email || 'Não informado'}</p>
                        {usr.cpf && (
                          <p className="text-slate-600 mb-1"><strong>CPF:</strong> {usr.cpf}</p>
                        )}
                        {usr.phone && (
                          <p className="text-slate-600 mb-1"><strong>Telefone:</strong> {usr.phone}</p>
                        )}
                        {usr.store_id && (
                          <p className="text-slate-600 mb-1"><strong>Store ID:</strong> {usr.store_id}</p>
                        )}
                        {/* Exibir plano do usuário */}
                        <div className="mt-2">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                            Plano: {usr.planName || usr.plan || 'Sem plano'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Criado em: {usr.created_at ? format(new Date(usr.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant={(usr.active === true || usr.active === null || usr.active === undefined) ? "outline" : "primary"}
                          onClick={() => handleToggleUserStatus(usr.id, usr.active === true)}
                          disabled={loading}
                          className={`rounded-full text-sm ${
                            (usr.active === true || usr.active === null || usr.active === undefined)
                              ? 'text-red-600 border-red-300' 
                              : 'text-green-600 border-green-300'
                          }`}
                        >
                          {(usr.active === true || usr.active === null || usr.active === undefined) ? (
                            <>
                              <XCircle size={16} className="mr-1" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <CheckCircle size={16} className="mr-1" />
                              Ativar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal de Detalhes */}
        {showDetailsModal && selectedSignup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Detalhes do Cadastro</h2>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSelectedSignup(null);
                    }}
                    className="rounded-full"
                  >
                    Fechar
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Administrador</label>
                    <p className="text-slate-900">{selectedSignup.admin_name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nome da Loja</label>
                    <p className="text-slate-900">{selectedSignup.store_name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                    <p className="text-slate-900">{selectedSignup.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">CPF/CNPJ</label>
                    <p className="text-slate-900">{selectedSignup.cpf_cnpj}</p>
                  </div>

                  {selectedSignup.phone && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Telefone</label>
                      <p className="text-slate-900">{selectedSignup.phone}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedSignup.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedSignup.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {selectedSignup.status === 'pending' ? 'Pendente' :
                       selectedSignup.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Data de Criação</label>
                    <p className="text-slate-900">
                      {format(new Date(selectedSignup.created_at), 'dd/MM/yyyy HH:mm:ss')}
                    </p>
                  </div>

                  {selectedSignup.reviewed_at && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Data de Revisão</label>
                      <p className="text-slate-900">
                        {format(new Date(selectedSignup.reviewed_at), 'dd/MM/yyyy HH:mm:ss')}
                      </p>
                    </div>
                  )}

                  {selectedSignup.rejection_reason && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo da Rejeição</label>
                      <p className="text-slate-900 bg-red-50 p-3 rounded-lg">{selectedSignup.rejection_reason}</p>
                    </div>
                  )}

                  {selectedSignup.status === 'pending' && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        variant="primary"
                        onClick={() => {
                          handleApprove(selectedSignup);
                          setShowDetailsModal(false);
                        }}
                        disabled={loading}
                        className="rounded-full flex-1"
                      >
                        <CheckCircle size={18} className="mr-2" />
                        Aprovar Cadastro
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleReject(selectedSignup);
                          setShowDetailsModal(false);
                        }}
                        disabled={loading}
                        className="rounded-full flex-1 text-red-600 border-red-300"
                      >
                        <XCircle size={18} className="mr-2" />
                        Rejeitar Cadastro
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

