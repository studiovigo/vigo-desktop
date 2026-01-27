import React, { useState, useEffect, useRef, useMemo, useCallback, Component } from "react";
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { db, PLANS_CONFIG } from "./services/db";
import { generateInvoice } from "./services/invoice";
import { printBarcodeLabels } from "./services/barcode";
import { exportStockToCSV, exportStockToExcel, importStockFromCSV, importStockFromExcel, createImportTemplate } from "./services/stockExport";
import { printShippingLabel } from "./services/shippingLabel";
import { generateClosurePDF } from "./services/closurePDF";
import { Card, Button, Input } from "./components/SimpleUI";
import { 
  LayoutDashboard, Package, ShoppingCart, FileText, Store, LogOut, 
  Settings, Users, Ticket, History, Plus, Trash2, Camera, 
  Minus, CreditCard, Banknote, QrCode, Printer, ChevronDown, ChevronRight,
  TrendingUp, BarChart, PieChart, DollarSign, Edit2, Calendar,
  Download, Upload, FileSpreadsheet, Globe, Eye, EyeOff, CheckCircle, XCircle
} from "lucide-react";
import { format } from "date-fns";
import { testSupabaseConnection } from "./services/testSupabaseConnection";
import { supabase } from "./services/supabaseClient";
import { supabaseDB } from "./services/supabaseDB";
import { Html5QrcodeScanner } from "html5-qrcode";
import { resolveStoreId, enqueuePendingSale, syncPendingSalesQueue, startPendingSalesWorker, getPendingSalesCount } from "./services/supabaseSync";
import { useClosureMetrics } from "./services/useDashboardMetrics";
import shopifyService, { setShopifyCredentials, loadStoredCredentials, graphql as shopifyGraphql, getProductsREST as shopifyGetProductsREST } from './services/shopify';
// import RevenueChart from "./components/RevenueChart"; // Será ativado após instalar recharts


const formatCurrency = (v) => {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
  } catch (e) {
    return `R$ ${(Number(v) || 0).toFixed(2)}`;
  }
};

// --- COMPONENTES AUXILIARES ---

// Componente de Rodapé
function Footer() {
  return (
    <footer className="w-full py-3 px-4 border-t border-slate-200 bg-white mt-auto">
      <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
        <span>2025 © todos os direitos reservados - by:</span>
        <span className="font-semibold">STUDIO VIGO</span>
        <img 
          src="./s.png" 
          alt="Studio Vigo Logo" 
          className="h-4 w-auto"
        />
      </div>
    </footer>
  );
}


// Componente de Solicitação de Cadastro
function SignupRequest({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    admin_name: "",
    store_name: "",
    cpf_cnpj: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const formatCpfCnpj = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      // CPF
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0,3)}.${numbers.slice(3)}`;
      if (numbers.length <= 9) return `${numbers.slice(0,3)}.${numbers.slice(3,6)}.${numbers.slice(6)}`;
      return `${numbers.slice(0,3)}.${numbers.slice(3,6)}.${numbers.slice(6,9)}-${numbers.slice(9)}`;
    } else {
      // CNPJ
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return `${numbers.slice(0,2)}.${numbers.slice(2)}`;
      if (numbers.length <= 8) return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5)}`;
      if (numbers.length <= 12) return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5,8)}/${numbers.slice(8)}`;
      return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5,8)}/${numbers.slice(8,12)}-${numbers.slice(12)}`;
    }
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validações
    if (!formData.admin_name.trim()) {
      setError("Nome do administrador é obrigatório");
      return;
    }
    if (!formData.store_name.trim()) {
      setError("Nome da loja é obrigatório");
      return;
    }
    if (!formData.cpf_cnpj.trim()) {
      setError("CPF ou CNPJ é obrigatório");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email é obrigatório");
      return;
    }
    if (!formData.password) {
      setError("Senha é obrigatória");
      return;
    }
    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      // Criar hash simples da senha (em produção, usar bcrypt no backend)
      // Por enquanto, vamos armazenar a senha em texto (com RLS restrito)
      // Na aprovação, usaremos essa senha para criar o usuário no Supabase Auth
      
      const { data, error: insertError } = await supabase
        .from('pending_signups')
        .insert([{
          admin_name: formData.admin_name.trim(),
          store_name: formData.store_name.trim(),
          cpf_cnpj: formData.cpf_cnpj.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, ''),
          email: formData.email.trim().toLowerCase(),
          password_hash: formData.password, // Em produção, fazer hash aqui ou no backend
          status: 'pending'
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao criar solicitação:', insertError);
        if (insertError.code === '23505') {
          setError("Já existe uma solicitação pendente com este email");
        } else {
          setError(insertError.message || "Erro ao enviar solicitação. Tente novamente.");
        }
        setLoading(false);
        return;
      }

      alert("Solicitação enviada com sucesso! Aguarde a aprovação do administrador.");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Erro inesperado:', err);
      setError("Erro ao enviar solicitação. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Solicitar Cadastro</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <XCircle size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome do Administrador <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Nome completo"
                value={formData.admin_name}
                onChange={e => setFormData({...formData, admin_name: e.target.value})}
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome da Loja <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Nome da loja"
                value={formData.store_name}
                onChange={e => setFormData({...formData, store_name: e.target.value})}
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CPF ou CNPJ <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={formatCpfCnpj(formData.cpf_cnpj)}
                onChange={e => setFormData({...formData, cpf_cnpj: e.target.value})}
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telefone
              </label>
              <Input
                type="text"
                placeholder="(00) 00000-0000"
                value={formatPhone(formData.phone)}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder="admin@loja.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirmar Senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Digite a senha novamente"
                  value={formData.confirm_password}
                  onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                  required
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 rounded-full"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1 rounded-full"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar Solicitação"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// 1. Tela de Login
function Login({ onLogin }) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loginType, setLoginType] = useState("cpf"); // "cpf" ou "email"
  const [showSignup, setShowSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Estado para mostrar senha apenas enquanto pressionado
  const [rememberMe, setRememberMe] = useState(false); // Estado para salvar informações

  // Carregar credenciais salvas ao montar o componente
  useEffect(() => {
    try {
      const savedCredentials = localStorage.getItem('mozyc_pdv_saved_credentials');
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        if (credentials.identifier && credentials.pass) {
          setIdentifier(credentials.identifier);
          setPass(credentials.pass);
          setRememberMe(true);
          // Detectar tipo de login
          if (credentials.identifier.includes('@')) {
            setLoginType('email');
          } else {
            setLoginType('cpf');
          }
          // Focar no campo de senha se as credenciais foram carregadas
          // (o usuário pode apenas pressionar Enter para fazer login)
          setTimeout(() => {
            const passwordInput = document.querySelector('input[type="password"]');
            if (passwordInput) {
              passwordInput.focus();
            }
          }, 100);
        }
      }
    } catch (e) {
      // Ignorar erros ao carregar credenciais
      console.log('Nenhuma credencial salva encontrada');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    // Função auxiliar para processar login do usuário
    const processUserLogin = async (userData) => {
      console.log('[Login CPF] Usuário encontrado no Supabase:', userData.name);
      console.log('[Login CPF] TODOS os campos retornados:', userData);
      console.log('[Login CPF] Campos disponíveis:', Object.keys(userData));
      
      // Verificar senha - fazer login no Auth do Supabase usando email
      if (userData.email) {
        console.log('[Login CPF] Tentando autenticar com email:', userData.email);
        const { loginWithEmail } = await import('./services/supabaseAuth.js');
        const result = await loginWithEmail(userData.email, pass);
        
        if (result.error) {
          console.error('[Login CPF] Erro na autenticação:', result.error);
          console.error('[Login CPF] Mensagem de erro:', result.error.message);
          setError("CPF ou senha incorretos.");
          return null;
        }
        
        console.log('[Login CPF] Login bem-sucedido via Supabase Auth');
        return result.user;
      } else {
        console.log('[Login CPF] Usuário sem email, verificando senha diretamente');
        // Usuário sem email, verificar senha diretamente
        const storedPassword = userData.password_hash || userData.password;
        
        if (storedPassword === pass) {
          // Normalizar campos para compatibilidade
          userData.password = storedPassword;
          userData.tenantId = userData.tenant_id || userData.store_id;
          console.log('[Login CPF] Login bem-sucedido (senha texto plano)');
          return userData;
        } else {
          console.error('[Login CPF] Senha incorreta. Esperada:', storedPassword, 'Fornecida:', pass);
          setError("CPF ou senha incorretos.");
          return null;
        }
      }
    };
    
    try {
      console.log('Tentando login:', { identifier, loginType, passLength: pass.length });
      
      let user = null;
      
      if (loginType === "email") {
        // Login via Supabase para email
        try {
          const { loginWithEmail } = await import('./services/supabaseAuth.js');
          const result = await loginWithEmail(identifier, pass);
          
          if (result.error) {
            console.error('Erro no login Supabase:', result.error);
            const errorMessage = result.error.message || "Email ou senha incorretos.";
            
            // Verificar se o usuário está desativado
            if (result.error.message?.includes('desativada') || 
                result.error.message?.includes('desativado') || 
                result.error.message?.includes('inativo')) {
              setError("Sua conta está temporariamente desativada. Entre em contato com o suporte.");
            } else if (result.error.message?.includes('Invalid login credentials')) {
              setError("Email ou senha incorretos.");
            } else {
              setError(errorMessage);
            }
            return;
          }
          
          if (!result.user) {
            console.error('Login retornou sem usuário');
            setError("Erro ao fazer login. Usuário não encontrado.");
            return;
          }
          
          user = result.user;
          console.log('Login Supabase bem-sucedido:', user?.email);
        } catch (importError) {
          console.error('Erro ao importar supabaseAuth:', importError);
          // Fallback para localStorage se Supabase não estiver disponível
          console.warn('Usando fallback localStorage para login');
          user = db.users.login(identifier, pass, loginType);
        }
      } else {
        // Login por CPF - buscar APENAS do Supabase (sem fallback localStorage)
        try {
          console.log('[Login CPF] Buscando usuário no Supabase...');
          const normalizedCpf = identifier.replace(/\D/g, '');
          
          // Buscar usuário por CPF no Supabase (incluindo password_hash)
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('cpf', normalizedCpf)
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (userError && userError.code !== 'PGRST116') {
            console.error('[Login CPF] Erro ao buscar usuário:', userError);
            setError("Erro ao buscar usuário. Tente novamente.");
            return;
          }
          
          // Se houver múltiplos usuários com mesmo CPF (PGRST116)
          if (userError && userError.code === 'PGRST116') {
            console.error('[Login CPF] CPF duplicado no banco. Buscando o mais recente...');
            const { data: users } = await supabase
              .from('users')
              .select('*')
              .eq('cpf', normalizedCpf)
              .eq('active', true)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (users && users.length > 0) {
              const userData = users[0];
              console.log('[Login CPF] Usando usuário mais recente:', userData.name);
              user = await processUserLogin(userData);
              if (!user) return;
            } else {
              setError("CPF não encontrado.");
              return;
            }
          } else if (userData) {
            user = await processUserLogin(userData);
            if (!user) return;
          } else {
            console.log('[Login CPF] Usuário não encontrado no Supabase');
            setError("CPF não encontrado.");
            return;
          }
        } catch (error) {
          console.error('[Login CPF] Erro inesperado:', error);
          setError("Erro ao fazer login. Tente novamente.");
          return;
        }
      }
      
      console.log('Resultado do login:', user ? 'Sucesso' : 'Falhou');
      
      if (user) {
        // Garantir que o usuário tem role
        if (!user.role) {
          user.role = 'caixa'; // Default
        }
        // Calcular e atribuir tenantId
        if (user.role === 'admin' && user.email) {
          // ADMIN usa email como tenantId
          user.tenantId = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        } else if (!user.tenantId) {
          // GERENTE/CAIXA herda tenantId do admin que os criou
          // Se não tiver, busca o tenantId do admin no sistema
          const data = db.users.list();
          const admin = data.find(u => u.role === 'admin');
          if (admin && admin.email) {
            user.tenantId = admin.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
          } else {
            user.tenantId = 'default';
          }
        }
        // Salvar usuário no localStorage para acesso ao tenantId
        localStorage.setItem('mozyc_pdv_current_user', JSON.stringify(user));
        
        // Salvar credenciais se "Lembrar-me" estiver marcado
        if (rememberMe) {
          localStorage.setItem('mozyc_pdv_saved_credentials', JSON.stringify({
            identifier: identifier,
            pass: pass,
            loginType: loginType
          }));
        } else {
          // Remover credenciais salvas se não quiser lembrar
          localStorage.removeItem('mozyc_pdv_saved_credentials');
        }
        
        onLogin(user);
      } else {
        setError(loginType === "cpf" ? "CPF ou senha incorretos." : "Email ou senha incorretos.");
      }
    } catch (error) {
      console.error("Erro no login:", error);
      setError(error.message || "Erro ao fazer login. Tente novamente.");
    }
  };

  const handleIdentifierChange = (e) => {
    const value = e.target.value;
    
    // Detectar automaticamente se está digitando um email (contém @ ou letras)
    const containsAt = value.includes("@");
    const containsLetters = /[a-zA-Z]/.test(value);
    
    if (containsAt || containsLetters) {
      // Se contém @ ou letras, é email - permitir todos os caracteres válidos para email
      setLoginType("email");
      setIdentifier(value);
    } else {
      // Se não contém @ nem letras, tratar como CPF - apenas números
      setLoginType("cpf");
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 11) {
        setIdentifier(digits);
      }
    }
  };

  const formatCpf = (digits) => {
    if (!digits) return '';
    const s = digits.replace(/\D/g, '').slice(0, 11);
    if (s.length <= 3) return s;
    if (s.length <= 6) return `${s.slice(0,3)}.${s.slice(3)}`;
    if (s.length <= 9) return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6)}`;
    return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;
  };

  const isEmail = (value) => {
    return value.includes("@") && value.includes(".");
  };

  // Detectar automaticamente se é email ou CPF ao perder o foco
  const handleIdentifierBlur = () => {
    if (identifier && isEmail(identifier)) {
      setLoginType("email");
    } else if (identifier && /^\d+$/.test(identifier.replace(/\D/g, ''))) {
      setLoginType("cpf");
    }
  };


  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Painel Esquerdo - Formulário de Login */}
        <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Entrar</h1>
            <p className="text-sm text-slate-600">
              Acesse sua conta para continuar
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Campo de Identificação (CPF ou Email) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {loginType === "cpf" ? "CPF" : "Email"} <span className="text-red-500">*</span>
              </label>
              <Input 
                placeholder={loginType === "cpf" ? "000.000.000-00" : "admin@pdv.com"} 
                value={loginType === "cpf" ? formatCpf(identifier) : identifier} 
                onChange={handleIdentifierChange}
                onBlur={handleIdentifierBlur}
                maxLength={loginType === "cpf" ? 14 : 100}
                type="text"
                required 
                className={`w-full rounded-lg border-2 ${
                  error && !identifier ? "border-red-500" : "border-slate-200 focus:border-[#d9b53f]"
                } transition-colors`}
              />
              {error && !identifier && (
                <p className="text-red-500 text-sm mt-1">Este campo é obrigatório</p>
              )}
            </div>

            {/* Campo de Senha */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Senha <span className="text-red-500">*</span>
                </label>
                <a href="#" className="text-sm text-[#d9b53f] hover:text-[#bf9035] font-medium">
                  Esqueceu a senha?
                </a>
              </div>
              <div className="relative">
              <Input 
                  type={showPassword ? "text" : "password"} 
                placeholder="Digite sua senha" 
                value={pass} 
                onChange={e => setPass(e.target.value)} 
                required 
                  className={`w-full rounded-lg border-2 pr-10 ${
                  error && !pass ? "border-red-500" : "border-slate-200 focus:border-[#d9b53f]"
                } transition-colors`}
              />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevenir foco no input
                    setShowPassword(true);
                  }}
                  onMouseUp={() => {
                    setShowPassword(false);
                  }}
                  onMouseLeave={() => {
                    setShowPassword(false);
                  }}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error && !pass && (
                <p className="text-red-500 text-sm mt-1">Este campo é obrigatório</p>
              )}
            </div>

            {/* Mensagem de Erro */}
            {error && identifier && pass && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Checkbox Salvar Informações */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-[#d9b53f] bg-gray-100 border-gray-300 rounded focus:ring-[#d9b53f] focus:ring-2"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-slate-700 cursor-pointer">
                Salvar informações (email e senha)
              </label>
            </div>

            {/* Botão de Login com Gradiente */}
            <button
              type="submit"
              className="w-full h-12 bg-[#d9b53f] hover:bg-[#bf9035] text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Entrar
            </button>


            {/* Informações de Acesso */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <p className="text-xs text-slate-600 mb-2">
                <strong className="text-slate-800">Gerente/Caixa:</strong> Use seu CPF
              </p>
              <p className="text-xs text-slate-600 mb-3">
                <strong className="text-slate-800">Administrador:</strong> Use seu Email
              </p>
              <div className="border-t pt-3 mt-3">
                <button
                  type="button"
                  onClick={() => setShowSignup(true)}
                  className="w-full text-sm text-[#d9b53f] hover:text-[#bf9035] font-medium transition-colors"
                >
                  Não tem conta? Solicitar Cadastro
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Solicitação de Cadastro */}
      {showSignup && (
        <SignupRequest
          onClose={() => setShowSignup(false)}
          onSuccess={() => {
            setShowSignup(false);
            alert("Solicitação enviada! Aguarde a aprovação.");
          }}
        />
      )}

      {/* Painel Direito - Conteúdo Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#d9b53f] via-[#bf9035] to-[#a67d2a] relative overflow-hidden">
        {/* Formas decorativas */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-[#d9b53f] rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-72 h-72 bg-[#bf9035] rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse delay-700"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#a67d2a] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
        </div>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <img 
                src="./png/[icone] LB PRETA.png" 
                alt="LB Brand Icon" 
                className="w-10 h-10"
              />
              <span className="text-xl font-bold">LB Brand</span>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Transforme suas vendas
            </h2>
            <p className="text-xl text-white/90 mb-2">
              #LB Brand
            </p>
            <p className="text-white/90 text-lg leading-relaxed">
              Do controle de estoque às vendas, gerencie e automatize tudo em uma plataforma poderosa e visual.
            </p>
          </div>

          <div className="text-sm text-white/80">
            <p>Confiança de <strong className="text-white">500+</strong> estabelecimentos | Gratuito para sempre</p>
          </div>
        </div>
      </div>
      </div>
      
      {/* Rodapé */}
      <Footer />
    </div>
  );
}


// 2. Layout Principal
function Layout({ children, user, onLogout }) {
  const loc = useLocation();
  const navigate = useNavigate();

  console.log('[Layout Debug] user:', user);
  console.log('[Layout Debug] user.role:', user?.role);

  // Menu baseado em permissões
  const getMenuItems = () => {
    const allMenu = [
      { url: "/pos", icon: ShoppingCart, title: "PDV", roles: ["caixa", "gerente", "admin"] },
      { url: "/products", icon: Package, title: "Produtos", roles: ["caixa", "gerente", "admin"] },
      { url: "/reports", icon: FileText, title: "Relatórios", roles: ["caixa", "gerente", "admin"] },
      { url: "/online", icon: Globe, title: "Online", roles: ["caixa", "gerente", "admin"] },
    ];
    
    // Filtrar menu baseado no role do usuário
    const userRole = user?.role || 'caixa'; // Default para caixa se não tiver role
    return allMenu.filter(item => item.roles.includes(userRole));
  };

  const menu = getMenuItems();
  console.log('[Layout Debug] menu items:', menu.length, menu);


  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <header className="bg-white border-b sticky top-0 z-50 px-4 h-16 flex items-center justify-between rounded-b-lg">
        <div className="flex items-center gap-3">
          <img 
            src="./png/[icone] LB PRETA.png" 
            alt="LB Brand Icon" 
            className="w-10 h-10"
          />
          <div>
            <h1 className="font-bold leading-none">LB Brand</h1>
            <p className="text-xs text-slate-500">{user?.name ? user.name.split(' ')[0] : (user?.email?.split('@')[0] || 'Usuário')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <nav className="hidden md:flex gap-1 items-center">
            {menu.map(i => {
              const isActive = loc.pathname === i.url;
              const IconComponent = i.icon;
              return (
                <div key={i.url} className="relative group">
                  <button
                    onClick={() => navigate(i.url)}
                    type="button"
                      className={`
                      flex items-center justify-center
                      w-10 h-10 rounded-full
                      transition-colors duration-200
                      ${isActive 
                        ? 'bg-[#d9b53f] text-white shadow-md hover:bg-[#bf9035]' 
                        : 'bg-slate-100 text-slate-600 hover:bg-[#d9b53f] hover:text-white'
                      }
                    `}
                  >
                    <IconComponent size={20} />
                  </button>
                  {/* Tooltip */}
                  <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                    <div className="bg-slate-900 text-white text-xs font-medium px-2 py-1 rounded whitespace-nowrap shadow-lg">
                      {i.title}
                      <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900"></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="relative group hidden md:block">
            <button
              onClick={onLogout}
              className="
                flex items-center justify-center
                w-10 h-10 rounded-full
                bg-slate-100 text-red-500
                hover:bg-red-50
                transition-colors duration-200
              "
            >
              <LogOut size={20}/>
            </button>
            {/* Tooltip */}
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              <div className="bg-slate-900 text-white text-xs font-medium px-2 py-1 rounded whitespace-nowrap shadow-lg">
                Sair
                <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900"></div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </main>
      
      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-2 z-40 rounded-t-xl">
        {menu.map(i => (
           <button key={i.url} onClick={() => navigate(i.url)} className={`flex flex-col items-center p-2 text-xs rounded-lg ${loc.pathname === i.url ? 'text-[#d9b53f]' : 'text-slate-400'}`}>
             <i.icon size={20} /> {i.title}
           </button>
        ))}
      </nav>
    </div>
  );
}

// Componente de Histórico Agrupado por Data
function HistoryGrouped({ logs }) {
  const [expandedDates, setExpandedDates] = useState(new Set());

  // Agrupar logs por data
  const groupedByDate = logs.reduce((acc, log) => {
    const logDate = new Date(log.timestamp);
    const dateKey = format(logDate, "yyyy-MM-dd");
    const dateLabel = format(logDate, "dd/MM/yyyy");
    // Obter dia da semana em português
    const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayLabel = daysOfWeek[logDate.getDay()];

    if (!acc[dateKey]) {
      acc[dateKey] = {
        date: dateLabel,
        dayOfWeek: dayLabel,
        logs: []
      };
    }
    acc[dateKey].logs.push(log);
    return acc;
  }, {});

  const toggleDate = (dateKey) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
      {sortedDates.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Nenhum histórico disponível</p>
      ) : (
        sortedDates.map(dateKey => {
          const group = groupedByDate[dateKey];
          const isExpanded = expandedDates.has(dateKey);
          
          return (
            <div key={dateKey} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleDate(dateKey)}
                className="w-full p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown size={18} className="text-slate-600" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-600" />
                  )}
                  <span className="font-bold text-slate-700">
                    {group.date} - {group.dayOfWeek}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                    {group.logs.length} evento{group.logs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
              
              {isExpanded && (
                <div className="p-3 space-y-2 bg-white">
                  {group.logs.map(log => (
                    <div key={log.id} className="border-l-2 border-[#d9b53f]/30 pl-3 py-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-slate-700">{log.user_name}</span>
                            <span className="text-xs text-slate-400">
                              {format(new Date(log.timestamp), "HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{log.action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// 3. Página de Configurações (NOVA)
function SettingsPage({ user }) {
  const [tab, setTab] = useState("history");
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [pendingSignups, setPendingSignups] = useState([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  
  // Forms
  const [newUser, setNewUser] = useState({ name: "", cpf: "", password: "", role: "caixa", store_id: "" });
  const [newCoupon, setNewCoupon] = useState({ code: "", discount: "" });
  const [settings, setSettings] = useState({ cnpj: "", shopifyStore: "", shopifyAccessToken: "", shopifyApiVersion: "2024-01" });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");

  // Verificar se é Admin
  const isGoodAdmin = user?.role === 'admin';

  // Função auxiliar para verificar senha do usuário logado (apenas Supabase)
  const verifyUserPassword = async (password) => {
    try {
      if (user?.id) {
        const { data: dbUser, error: dbUserError } = await supabase
          .from('users')
          .select('id, email, password_hash')
          .eq('id', user.id)
          .maybeSingle();

        if (dbUserError) {
          console.error('[verifyUserPassword] Erro ao buscar usuário no Supabase:', dbUserError);
        }

        if (dbUser) {
          if (dbUser.password_hash && dbUser.password_hash === password) {
            return true;
          }

          if (dbUser.email) {
            const { error: authError } = await supabase.auth.signInWithPassword({
              email: dbUser.email,
              password
            });
            return !authError;
          }
        }
      }

      if (user?.email) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password
        });
        return !authError;
      }

      return false;
    } catch (error) {
      console.error('[verifyUserPassword] Erro ao verificar senha:', error);
      return false;
    }
  };


  useEffect(() => {
    refreshData();
    // Carregar configurações locais
    setSettings(prev => ({ ...prev, ...db.settings.get() }));
    // Carregar credenciais Shopify salvas no navegador
    try {
      const creds = loadStoredCredentials();
      setSettings(prev => ({
        ...prev,
        shopifyStore: creds.store || prev.shopifyStore || "",
        shopifyAccessToken: creds.accessToken || prev.shopifyAccessToken || "",
        shopifyApiVersion: creds.apiVersion || prev.shopifyApiVersion || "2024-01"
      }));
    } catch (e) {
      // ignore
    }
    if (isGoodAdmin) {
      loadPendingSignups();
    }
  }, [isGoodAdmin]);

  const loadPendingSignups = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_signups')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar solicitações:', error);
        return;
      }

      setPendingSignups(data || []);
    } catch (err) {
      console.error('Erro inesperado ao carregar solicitações:', err);
    }
  };


  const refreshData = () => {
    setLogs(db.logs.list());
    setUsers(db.users.list());
    // Buscar cupons do SBD primeiro, fallback para localStorage
    const loadCoupons = async () => {
      try {
        const { supabaseDB } = await import('./services/supabaseDB.js');
        const sbdCoupons = await supabaseDB.coupons.list();
        if (sbdCoupons && sbdCoupons.length >= 0) {
          setCoupons(sbdCoupons);
        } else {
    setCoupons(db.coupons.list());
        }
      } catch (error) {
        console.error('[Settings] Erro ao carregar cupons do SBD, usando localStorage:', error);
        setCoupons(db.coupons.list());
      }
    };
    loadCoupons();
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    db.settings.update(settings, user);
    alert("Configurações salvas com sucesso!");
  };

  // Salvar credenciais Shopify no runtime/localStorage
  const handleSaveShopifyCredentials = async () => {
    try {
      setShopifyCredentials({
        store: (settings.shopifyStore || '').trim(),
        accessToken: (settings.shopifyAccessToken || '').trim(),
        apiVersion: (settings.shopifyApiVersion || '2024-01').trim()
      });
      alert('Credenciais da Shopify salvas!');
    } catch (e) {
      alert('Erro ao salvar credenciais: ' + (e?.message || e));
    }
  };

  // Testar conexão (GraphQL shop name)
  const [shopifyTestLoading, setShopifyTestLoading] = useState(false);
  const handleTestShopifyConnection = async () => {
    setShopifyTestLoading(true);
    try {
      const query = `query { shop { name myshopifyDomain } }`;
      const res = await shopifyGraphql(query);
      const name = res?.data?.shop?.name;
      const domain = res?.data?.shop?.myshopifyDomain;
      alert(`Conexão OK! Loja: ${name} (${domain})`);
    } catch (e) {
      console.error('[Shopify] Teste falhou:', e);
      alert('Falha na conexão Shopify. Verifique Store e Access Token.');
    } finally {
      setShopifyTestLoading(false);
    }
  };

  // Listar alguns produtos via REST
  const handleListShopifyProducts = async () => {
    try {
      const json = await shopifyGetProductsREST({ limit: 5 });
      const products = json?.products || [];
      alert(`Produtos recebidos: ${products.length}`);
      console.log('[Shopify] Exemplos de produtos:', products);
    } catch (e) {
      console.error('[Shopify] Produtos falharam:', e);
      alert('Erro ao listar produtos. Verifique permissões read_products.');
    }
  };

  const formatCnpj = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 14) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return `${numbers.slice(0,2)}.${numbers.slice(2)}`;
      if (numbers.length <= 8) return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5)}`;
      if (numbers.length <= 12) return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5,8)}/${numbers.slice(8)}`;
      return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5,8)}/${numbers.slice(8,12)}-${numbers.slice(12)}`;
    }
    return value;
  };


  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      // Validar que apenas ADMIN pode criar usuários
      if (user.role !== 'admin') {
        alert("Apenas administradores podem criar usuários");
        return;
      }
      
      // Validar que não pode criar ADMIN
      if (newUser.role === 'admin') {
        alert("Não é possível criar outro administrador");
        return;
      }
      
      // Validar CPF
      if (!newUser.cpf) {
        alert("CPF é obrigatório");
        return;
      }
      
      const normalizedCpf = newUser.cpf.replace(/\D/g, '');
      
      // Verificar se o CPF já existe no Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, name')
        .eq('cpf', normalizedCpf)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Erro ao verificar CPF:', checkError);
        throw new Error("Erro ao verificar CPF existente");
      }
      
      if (existingUser) {
        alert(`CPF já cadastrado para o usuário: ${existingUser.name}`);
        return;
      }
      
      // Criar usuário no Supabase
      const storeId = user.store_id || user.tenantId;
      
      const { data: createdUser, error } = await supabase
        .from('users')
        .insert([{
          name: newUser.name,
          cpf: normalizedCpf,
          password_hash: newUser.password, // Salvar senha em texto plano (temporário)
          role: newUser.role,
          store_id: storeId,
          tenant_id: storeId,
          active: true,
          email: null
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar usuário no Supabase:', error);
        throw new Error(error.message || "Erro ao criar usuário");
      }
      
      console.log('✅ Usuário criado no Supabase com sucesso:', createdUser);
      
      setNewUser({ name: "", cpf: "", password: "", role: "caixa", store_id: "" });
      refreshData();
      alert(`Usuário ${createdUser.name} criado com sucesso! Já pode fazer login com CPF ${newUser.cpf}`);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      alert(error.message || "Erro ao criar usuário");
    }
  };

  const handleDeleteUser = (userToDelete) => {
    // Não permitir deletar ADMIN
    if (userToDelete.role === 'admin') {
      alert("Não é possível remover o administrador");
      return;
    }
    
    // Verificar permissão (ADMIN ou GERENTE)
    if (user.role !== 'admin' && user.role !== 'gerente') {
      alert("Apenas administradores e gerentes podem remover usuários");
      return;
    }
    
    setUserToDelete(userToDelete);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!deletePassword) {
      alert("Digite sua senha para confirmar a exclusão");
      return;
    }

    // Verificar senha do usuário logado
    const passwordValid = await verifyUserPassword(deletePassword);
    
    if (!passwordValid) {
      alert("Senha incorreta. Digite a senha do usuário logado.");
      return;
    }

    try {
      // Se for usuário do Supabase, usar método do Supabase
      if (user?.email && user?.id) {
        // TODO: Implementar deleção via Supabase se necessário
        // Por enquanto, usar método local
        const users = db.users.list();
        const userToDeleteData = users.find(u => u.id === userToDelete.id);
        if (userToDeleteData) {
          userToDeleteData.active = false;
          db.users.update(userToDelete.id, { active: false }, user);
        }
      } else {
        // Usar método antigo do localStorage
      db.users.delete(userToDelete.id, user, deletePassword);
      }
      
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeletePassword("");
      refreshData();
      alert("Usuário removido com sucesso!");
    } catch (error) {
      alert(error.message || "Erro ao remover usuário");
    }
  };


  const handleAddCoupon = async (e) => {
    e.preventDefault();
    // Salvar no SBD primeiro, fallback para localStorage
    try {
      const { supabaseDB } = await import('./services/supabaseDB.js');
      await supabaseDB.coupons.create({ ...newCoupon, active: true }, user);
      console.log('[Settings] Cupom criado no SBD:', newCoupon.code);
    } catch (error) {
      console.error('[Settings] Erro ao criar cupom no SBD, salvando localmente:', error);
    db.coupons.create({ ...newCoupon, active: true }, user);
    }
    setNewCoupon({ code: "", discount: "" });
    refreshData();
    alert("Cupom criado!");
  };


  const handleApproveSignup = async (signup) => {
    if (!confirm(`Aprovar cadastro de ${signup.admin_name} (${signup.store_name})?`)) {
      return;
    }

    setLoadingApprovals(true);
    try {
      // Importar função de aprovação
      const { approveSignup } = await import('./services/approveSignup');
      
      const result = await approveSignup(signup.id, {
        email: signup.email,
        password_hash: signup.password_hash,
        admin_name: signup.admin_name,
        store_name: signup.store_name,
        cpf_cnpj: signup.cpf_cnpj,
        phone: signup.phone
      }, user.id);

      if (result.success) {
        await loadPendingSignups();
        alert(result.message || 'Cadastro aprovado com sucesso!');
      } else {
        alert(result.message || 'Erro ao aprovar cadastro.');
      }
    } catch (err) {
      console.error('Erro ao aprovar:', err);
      alert('Erro ao aprovar cadastro. Verifique o console para mais detalhes.');
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleRejectSignup = async (signup) => {
    const reason = prompt(`Rejeitar cadastro de ${signup.admin_name}?\n\nMotivo (opcional):`);
    if (reason === null) return; // Usuário cancelou

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
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button variant={tab === "history" ? "primary" : "outline"} onClick={() => setTab("history")} className="rounded-full"><History size={18} className="mr-2"/> Histórico</Button>
        <Button variant={tab === "users" ? "primary" : "outline"} onClick={() => setTab("users")} className="rounded-full"><Users size={18} className="mr-2"/> Usuários</Button>
        {isGoodAdmin && (
          <Button variant={tab === "approvals" ? "primary" : "outline"} onClick={() => { setTab("approvals"); loadPendingSignups(); }} className="rounded-full">
            <CheckCircle size={18} className="mr-2"/> Aprovações {pendingSignups.length > 0 && `(${pendingSignups.length})`}
          </Button>
        )}
        <Button variant={tab === "coupons" ? "primary" : "outline"} onClick={() => setTab("coupons")} className="rounded-full"><Ticket size={18} className="mr-2"/> Cupons</Button>
        <Button variant={tab === "general" ? "primary" : "outline"} onClick={() => setTab("general")} className="rounded-full"><Settings size={18} className="mr-2"/> Controle Geral</Button>
      </div>


      {tab === "history" && (
        <Card className="p-4 rounded-xl">
          <h3 className="font-bold mb-4">Histórico de Atividades</h3>
          <HistoryGrouped logs={logs} />
        </Card>
      )}


      {tab === "users" && (
        <div className="grid md:grid-cols-2 gap-6">
          {user.role === 'admin' && (
            <Card className="p-4 rounded-xl">
              <h3 className="font-bold mb-4">Novo Usuário</h3>
              <form onSubmit={handleAddUser} className="space-y-3">
                <Input placeholder="Nome Completo" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <Input placeholder="CPF (Gerente/Caixa)" required value={newUser.cpf} onChange={e => setNewUser({...newUser, cpf: e.target.value})} />
                <Input type="password" placeholder="Senha" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                <select className="w-full p-2 border rounded-lg" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  <option value="caixa">Caixa</option>
                  <option value="gerente">Gerente</option>
                </select>
                {/* Campo store_id apenas para usuário "good" */}
                {(user?.email === 'good@admin.com' || user?.email?.toLowerCase() === 'good') && (
                  <div>
                    <label className="block text-sm font-bold mb-1">
                      ID da Loja (store_id) <span className="text-red-500">*</span>
                    </label>
                    <Input 
                      placeholder="ex: lb_store, loja1, loja_br" 
                      value={newUser.store_id} 
                      onChange={e => {
                        const value = e.target.value.replace(/\s/g, ''); // Remove espaços
                        setNewUser({...newUser, store_id: value});
                      }}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Apenas letras, números e underscore. Sem espaços.
                    </p>
                  </div>
                )}
                <Button className="w-full rounded-full">Cadastrar</Button>
              </form>
            </Card>
          )}
          <Card className="p-4 rounded-xl">
            <h3 className="font-bold mb-4">Usuários Ativos</h3>
            <div className="space-y-2">
              {/* Mostrar usuário logado primeiro com destaque */}
              {user && (
                <div key={user.id || 'current'} className="flex justify-between items-center border-2 border-[#d9b53f] bg-yellow-50 p-3 rounded-lg mb-3">
                  <div>
                    <p className="font-bold text-[#d9b53f]">{user.name || 'Usuário Atual'}</p>
                    <p className="text-xs text-slate-600">
                      {user.role === 'admin' ? 'Administrador' : user.role === 'gerente' ? 'Gerente' : 'Caixa'} 
                      {user.cpf && ` | ${user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`}
                      {user.email && ` | ${user.email}`}
                    </p>
                    <p className="text-xs text-[#d9b53f] font-medium mt-1">Você está logado</p>
                  </div>
                </div>
              )}
              
              {/* Listar outros usuários (excluindo o usuário logado e usuários padrão) */}
              {users
                .filter(u => 
                  u.active !== false && 
                  u.id !== user?.id && 
                  (u.email !== user?.email || !user?.email) &&
                  // Remover usuário padrão "Adriano Admin"
                  u.email !== 'admin@lbbrand.com' &&
                  u.name !== 'Luana Admin'
                )
                .map(u => (
                <div key={u.id} className="flex justify-between items-center border-b p-2 rounded-lg">
                  <div>
                    <p className="font-bold">{u.name}</p>
                    <p className="text-xs text-slate-500">
                      {u.role === 'admin' ? 'Administrador' : u.role === 'gerente' ? 'Gerente' : 'Caixa'} 
                      {u.cpf && ` | ${u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`}
                      {u.email && ` | ${u.email}`}
                    </p>
                  </div>
                  {u.role !== 'admin' && (user.role === 'admin' || user.role === 'gerente') && (
                    <button 
                      onClick={() => handleDeleteUser(u)} 
                      className="text-red-500 hover:text-red-700 rounded-lg p-1"
                      title="Remover usuário"
                    >
                      <Trash2 size={16}/>
                    </button>
                  )}
                </div>
              ))}
              {users.filter(u => u.active !== false && u.id !== user?.id && (u.email !== user?.email || !user?.email)).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">Nenhum outro usuário encontrado</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modal de confirmação para remover usuário */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 rounded-xl max-w-md w-full">
            <h3 className="font-bold text-lg mb-2">Confirmar Remoção</h3>
            <p className="text-sm text-slate-600 mb-4">
              Tem certeza que deseja remover o usuário <strong>{userToDelete?.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Para confirmar, digite sua senha:
            </p>
            <Input 
              type="password" 
              placeholder="Sua senha" 
              value={deletePassword} 
              onChange={e => setDeletePassword(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 rounded-full"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                  setDeletePassword("");
                }}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 rounded-full bg-red-600 hover:bg-red-700"
                onClick={confirmDeleteUser}
                disabled={!deletePassword}
              >
                Remover
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "approvals" && isGoodAdmin && (
        <Card className="p-4 rounded-xl">
          <h3 className="font-bold mb-4">Solicitações de Cadastro Pendentes</h3>
          {loadingApprovals ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Carregando...</p>
            </div>
          ) : pendingSignups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Nenhuma solicitação pendente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSignups.map((signup) => (
                <div
                  key={signup.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-[#d9b53f] transition-colors"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 mb-1">{signup.admin_name}</h4>
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>Loja:</strong> {signup.store_name}
                      </p>
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>Email:</strong> {signup.email}
                      </p>
                      <p className="text-sm text-slate-600 mb-1">
                        <strong>CPF/CNPJ:</strong> {signup.cpf_cnpj}
                      </p>
                      {signup.phone && (
                        <p className="text-sm text-slate-600 mb-1">
                          <strong>Telefone:</strong> {signup.phone}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        Solicitado em {format(new Date(signup.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <Button
                      variant="primary"
                      onClick={() => handleApproveSignup(signup)}
                      disabled={loadingApprovals}
                      className="flex-1 rounded-full"
                    >
                      <CheckCircle size={18} className="mr-2" />
                      Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRejectSignup(signup)}
                      disabled={loadingApprovals}
                      className="flex-1 rounded-full text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle size={18} className="mr-2" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "coupons" && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-4 rounded-xl">
            <h3 className="font-bold mb-4">Novo Cupom</h3>
            <form onSubmit={handleAddCoupon} className="space-y-3">
              <Input placeholder="Código (ex: DESC10)" required value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})} />
              <Input placeholder="Desconto (%)" type="number" required value={newCoupon.discount} onChange={e => setNewCoupon({...newCoupon, discount: e.target.value})} />
              <Button className="w-full rounded-full">Criar Cupom</Button>
            </form>
          </Card>
          <Card className="p-4 rounded-xl">
             <h3 className="font-bold mb-4">Cupons Ativos</h3>
             {coupons.map(c => (
              <div key={c.id} className="flex justify-between items-center border-b p-2 rounded-lg">
                <div>
                  <p className="font-bold text-green-600">{c.code}</p>
                  <p className="text-xs text-slate-500">{c.discount}% de desconto</p>
                </div>
                <button onClick={async () => { 
                  try {
                    const { supabaseDB } = await import('./services/supabaseDB.js');
                    await supabaseDB.coupons.delete(c.id, user);
                    console.log('[Settings] Cupom deletado do SBD:', c.code);
                  } catch (error) {
                    console.error('[Settings] Erro ao deletar cupom do SBD, deletando localmente:', error);
                    db.coupons.delete(c.id, user);
                  }
                  refreshData(); 
                }} className="text-red-500 hover:text-red-700 rounded-lg p-1"><Trash2 size={16}/></button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === "general" && (
        <div className="space-y-6">
          <Card className="p-6 rounded-xl">
            <h3 className="font-bold mb-4 text-xl">Controle Geral</h3>
            <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">CNPJ da Empresa</label>
              <Input 
                placeholder="00.000.000/0000-00" 
                value={formatCnpj(settings.cnpj || "")}
                onChange={e => {
                  const numbers = e.target.value.replace(/\D/g, '');
                  if (numbers.length <= 14) {
                    setSettings({ ...settings, cnpj: numbers });
                  }
                }}
                maxLength={18}
                className="w-full rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">CNPJ que será usado na nota fiscal</p>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h4 className="font-bold mb-3 text-lg">Integração Shopify</h4>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-2">Domínio da Loja (myshopify.com)</label>
                    <Input 
                      placeholder="lb-brand-6997.myshopify.com" 
                      value={settings.shopifyStore || ""}
                      onChange={e => setSettings({ ...settings, shopifyStore: e.target.value })}
                      className="w-full rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Ex: sua-loja.myshopify.com</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2">API Version</label>
                    <Input 
                      placeholder="2024-01" 
                      value={settings.shopifyApiVersion || "2024-01"}
                      onChange={e => setSettings({ ...settings, shopifyApiVersion: e.target.value })}
                      className="w-full rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">Versão da API admin</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Access Token (Admin)</label>
                  <Input 
                    type="password"
                    placeholder="shpat_xxxxxxxxxxxxx" 
                    value={settings.shopifyAccessToken || ""}
                    onChange={e => setSettings({ ...settings, shopifyAccessToken: e.target.value })}
                    className="w-full rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Gerado ao instalar seu app no Dev Dashboard</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="primary" className="rounded-full" onClick={handleSaveShopifyCredentials}>Salvar Credenciais Shopify</Button>
                  <Button type="button" variant="outline" className="rounded-full" onClick={handleTestShopifyConnection} disabled={shopifyTestLoading}>{shopifyTestLoading ? 'Testando...' : 'Testar Conexão'}</Button>
                  <Button type="button" variant="outline" className="rounded-full" onClick={handleListShopifyProducts}>Listar 5 Produtos</Button>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">URL do Webhook</label>
                  <Input 
                    placeholder="https://seudominio.com/webhook/shopify" 
                    value={settings.shopifyWebhookUrl || ""}
                    onChange={e => setSettings({ ...settings, shopifyWebhookUrl: e.target.value })}
                    className="w-full rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Configure este URL no Shopify como webhook para pedidos</p>
                  <div className="mt-2 p-3 bg-[#d9b53f]/10 border border-[#d9b53f]/30 rounded-lg">
                    <p className="text-xs font-bold text-blue-700 mb-1">Como configurar no Shopify:</p>
                    <ol className="text-xs text-[#d9b53f] list-decimal list-inside space-y-1">
                      <li>Acesse: Configurações → Notificações → Webhooks</li>
                      <li>Clique em "Criar webhook"</li>
                      <li>Evento: "Pedido pago" ou "Pedido criado"</li>
                      <li>Formato: JSON</li>
                      <li>Cole a URL acima</li>
                    </ol>
                    <p className="text-xs text-[#d9b53f] mt-2">
                      <strong>Importante:</strong> O código do produto na Shopify (SKU) deve corresponder ao código do produto no sistema para desconto automático de estoque.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <Button type="submit" variant="primary" className="rounded-full">
              Salvar Configurações
            </Button>
          </form>
        </Card>
        </div>
      )}
    </div>
  );
}


// 4. PDV Melhorado (Pagamento e Desconto)
function POS({ user }) {
  if (!user) {
    return <div className="p-4"><Card className="p-8 text-center rounded-xl"><p className="text-red-500">Erro: Usuário não fornecido ao POS</p></Card></div>;
  }
  
  const [products, setProducts] = useState([]);
  // Contador da fila offline local ao POS (evita ReferenceError e mantém badge em uso)
  const [pendingSalesCountState, setPendingSalesCountState] = useState(0);
  // Carrega carrinho do localStorage ao iniciar (isolado por tenant)
  const [cart, setCart] = useState(() => {
    try {
      const tenantId = user.tenantId || 'default';
      const savedCart = localStorage.getItem(`mozyc_pdv_cart_${tenantId}`);
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error("Erro ao carregar carrinho:", error);
      return [];
    }
  });
  const [term, setTerm] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const barcodeInputRef = useRef(null);
  const barcodeTimeoutRef = useRef(null);
  const lastBarcodeValueRef = useRef("");
  const discountInputRef = useRef(null);
  const [showNFCeModal, setShowNFCeModal] = useState(false);
  const [pendingSale, setPendingSale] = useState(null);
  const finalizingRef = useRef(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  // Salva carrinho no localStorage sempre que mudar (isolado por tenant)
  useEffect(() => {
    const tenantId = user.tenantId || 'default';
    localStorage.setItem(`mozyc_pdv_cart_${tenantId}`, JSON.stringify(cart));
  }, [cart, user.tenantId]);
  
  // Função para processar código de barras lido
  const processBarcode = (code) => {
    if (!code || code.trim() === '') return;
    
    const trimmedCode = code.trim();
    
    // Prioriza busca por código exato
    const byCode = db.products.findByCode(trimmedCode);
    if (byCode) {
      add(byCode);
      setTerm('');
      return true;
    }
    
    // Tenta encontrar por modelCode ou trecho
    const all = db.products.list();
    const found = all.find(p => 
      (p.code || '').toLowerCase() === trimmedCode.toLowerCase() || 
      (p.modelCode || '').toLowerCase() === trimmedCode.toLowerCase()
    );
    
    if (found) {
      add(found);
      setTerm('');
      return true;
    }
    
    // Se não encontrou, mostra mensagem
    alert(`Produto com código "${trimmedCode}" não encontrado`);
    setTerm('');
    return false;
  };
  
  // States de Pagamento
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState("money"); // money, pix, credit, debit
  const [pixType, setPixType] = useState("maquina"); // maquina, direto
  const [moneyReceived, setMoneyReceived] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0); // em %


  useEffect(() => {
    // Sincronizar produtos do Supabase ao carregar o PDV
    const syncProductsOnLoad = async () => {
      try {
        // Sincronizar produtos do Supabase para db.products
        await db.syncProducts();
        // Atualizar lista de produtos após sincronização
    const allProducts = db.products.list();
    setProducts(allProducts);
        console.log('[PDV] Produtos sincronizados:', allProducts.length);
      } catch (error) {
        console.error('[PDV] Erro ao sincronizar produtos:', error);
        // Continuar com produtos locais mesmo se falhar
        const allProducts = db.products.list();
        setProducts(allProducts);
      }
    };
    
    syncProductsOnLoad();
    
    // REFATORAÇÃO: Verificar se há caixa aberto ao carregar PDV
    // (Não precisa fazer nada, apenas garantir que o sistema sabe que há caixa)
    const cash = JSON.parse(localStorage.getItem('currentCashRegister') || 'null');
    if (!cash) {
      // Se não há caixa aberto, avisar o usuário (opcional)
      // console.log('Nenhum caixa aberto. Abra o caixa na aba Relatórios antes de fazer vendas.');
    }
  }, []);

  // Limpar timeout quando componente desmontar
  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, []);


  const add = (p) => {
    if (!p) {
      console.error("Produto não encontrado");
      alert("Produto não encontrado");
      return;
    }
    
    
    // Verifica estoque: se não estiver definido, considera estoque ilimitado
    const stock = (p.stock !== undefined && p.stock !== null) ? p.stock : 999;
    console.log("Estoque do produto:", stock);
    
    // Se estoque está definido e é 0 ou negativo, bloqueia
    if (p.stock !== undefined && p.stock !== null && stock <= 0) {
      alert("Sem estoque disponível para este produto");
      return;
    }
    
    const exist = cart.find(i => i.pid === p.id);
    const price = p.salePrice || p.sale_price || 0;
    const cost = p.costPrice || p.cost_price || 0;
    const name = p.modelName || p.name || '';
    const displayName = `${name}${p.color && p.size ? ` - ${p.color} ${p.size}` : ''}`;
    
    console.log("Produto já existe no carrinho?", !!exist);
    
    if(exist) {
      // Verifica se há estoque suficiente para adicionar mais uma unidade
      const currentQty = exist.qtd;
      console.log("Quantidade atual no carrinho:", currentQty);
      
      // Só verifica estoque se estiver definido
      if (p.stock !== undefined && p.stock !== null && currentQty >= stock) {
        alert(`Estoque insuficiente. Disponível: ${stock} unidade(s)`);
        return;
      }
      
      console.log("Incrementando quantidade do produto existente");
      setCart(prevCart => {
        const updated = prevCart.map(i => i.pid === p.id ? {
          ...i, 
          qtd: i.qtd + 1,
          code: i.code || p.code || p.sku || '', // Garantir que SKU está presente
          sku: i.sku || p.sku || p.code || ''
        } : i);
        console.log("Carrinho atualizado (incrementado):", updated);
        return updated;
      });
    } else {
      const newItem = { 
        pid: p.id, 
        name: displayName, 
        price: price, 
        cost: cost, 
        qtd: 1,
        code: p.code || p.sku || '', // SKU é obrigatório para a RPC
        sku: p.sku || p.code || '', // Garantir ambos os campos
        image: p.image || ''
      };
      console.log("Adicionando novo item ao carrinho:", newItem);
      setCart(prevCart => {
        const updated = [...prevCart, newItem];
        console.log("Carrinho atualizado (novo item):", updated);
        return updated;
      });
    }
    
    console.log("=== FIM ADIÇÃO ===");
  };


  const checkCoupon = async () => {
    // Buscar cupons do SBD primeiro, fallback para localStorage
    let coupons = [];
    try {
      const { supabaseDB } = await import('./services/supabaseDB.js');
      coupons = await supabaseDB.coupons.list();
      if (!coupons || coupons.length === 0) {
        coupons = db.coupons.list();
      }
    } catch (error) {
      console.error('[POS] Erro ao carregar cupons do SBD, usando localStorage:', error);
      coupons = db.coupons.list();
    }
    const valid = coupons.find(c => c.code === discountCode && c.active);
    if(valid) {
      setAppliedDiscount(valid.discount);
      alert(`Desconto de ${valid.discount}% aplicado!`);
    } else {
      alert("Cupom inválido");
      setAppliedDiscount(0);
    }
  };


  const subtotal = cart.reduce((a, b) => a + (b.price * b.qtd), 0);
  const discountAmount = subtotal * (appliedDiscount / 100);
  const totalFinal = subtotal - discountAmount;
  
  // Calcula o troco: se o campo estiver vazio, considera valor recebido = total (troco = 0)
  const change = payMethod === "money" && moneyReceived && moneyReceived.trim() !== "" 
    ? Math.max(0, parseFloat(moneyReceived) - totalFinal) 
    : 0;


  const finish = () => {
    console.log('[finish] 🚀 Iniciando processo de finalização...');
    console.log('[finish] Método de pagamento:', payMethod);
    console.log('[finish] Total final:', totalFinal);
    
    // Validação para pagamento em dinheiro: só bloqueia se o valor recebido for explicitamente menor que o total
    // Se o campo estiver vazio, considera que o valor recebido é igual ao total (sem troco) e permite confirmar
    if(payMethod === "money") {
      console.log('[finish] Validando pagamento em dinheiro...');
      console.log('[finish] Valor recebido:', moneyReceived);
      
      // Se o campo estiver vazio, permite confirmar (considera valor recebido = total, sem troco)
      if (moneyReceived && moneyReceived.trim() !== "") {
        const received = parseFloat(moneyReceived);
        console.log('[finish] Valor recebido (parsed):', received);
        
        if (received < totalFinal) {
          console.log('[finish] ❌ Valor insuficiente!');
          return alert("Valor recebido insuficiente!");
        }
        console.log('[finish] ✅ Valor suficiente');
        // Se received >= totalFinal, permite confirmar (com ou sem troco)
      }
      // Se moneyReceived estiver vazio, permite confirmar normalmente (sem troco)
    }

    // Preparar método de pagamento com tipo de PIX se aplicável
    let finalPaymentMethod = payMethod;
    if (payMethod === 'pix') {
      finalPaymentMethod = `pix_${pixType}`;
    }
    console.log('[finish] Método de pagamento final:', finalPaymentMethod);
    
    // REFATORAÇÃO: Obter ID do caixa atual do localStorage
    const cash = JSON.parse(localStorage.getItem('currentCashRegister') || 'null');
    console.log('[finish] Caixa atual:', cash);
    
    if (!cash) {
      console.log('[finish] ❌ Nenhum caixa aberto!');
      alert('Erro: Nenhum caixa aberto. Abra o caixa antes de realizar vendas.');
      return;
    }

    // Obter usuário logado do localStorage (fallback quando state não está acessível aqui)
    const loggedUserStr = localStorage.getItem('mozyc_pdv_current_user');
    const loggedUser = loggedUserStr ? JSON.parse(loggedUserStr) : null;
    
    console.log('[finish] Preparando items da venda...');
    
    // Garantir que os items tenham SKU (code) para a RPC
    const saleData = { 
      sale_date: new Date().toISOString(), 
      items: cart.map(i => {
        // Buscar produto completo para garantir que temos o SKU
        const product = products.find(p => p.id === i.pid);
        const sku = product?.code || product?.sku || i.code || i.sku || null;
        
        // Validar se tem SKU antes de continuar
        if (!sku) {
          console.error('[finish] ⚠️ Item sem SKU encontrado:', {
            item: i,
            product: product,
            product_id: i.pid
          });
        }
        
        return {
          product_id: i.pid,
          quantity: i.qtd,
          code: sku, // SKU é obrigatório para a RPC
          sku: sku, // Garantir ambos os campos
          name: i.name || product?.name || 'Produto',
          price: i.price || product?.salePrice || 0,
          subtotal: (i.price || product?.salePrice || 0) * i.qtd,
          ...i
        };
      }), 
      total_amount: totalFinal, 
      payment_method: finalPaymentMethod,
      discount: discountAmount,
      cashRegisterId: cash.id, // VÍNCULO COM O CAIXA ATUAL
      user_name: (loggedUser?.name || loggedUser?.email?.split('@')[0] || 'Usuário'), // Nome do usuário logado
      user_id: (loggedUser?.id ?? null) // ID do usuário logado
    };
    
    console.log('[finish] Sale data preparado:', saleData);
    
    // Validar se todos os items têm SKU antes de continuar
    const itemsWithoutSKU = saleData.items.filter(i => !i.code && !i.sku);
    if (itemsWithoutSKU.length > 0) {
      const productNames = itemsWithoutSKU.map(i => i.name).join(', ');
      console.log('[finish] ❌ Items sem SKU:', itemsWithoutSKU);
      alert(`❌ Erro: Os seguintes produtos não têm SKU (código) cadastrado:\n\n${productNames}\n\nPor favor, cadastre o SKU para estes produtos antes de realizar a venda.`);
      return;
    }
    
    // Log dos items para debug
    console.log('[finish] Items da venda preparados:', saleData.items.map(i => ({
      product_id: i.product_id,
      code: i.code,
      sku: i.sku,
      quantity: i.quantity,
      name: i.name
    })));
    
    console.log('[finish] ✅ Validações passadas! Abrindo modal NFC-e...');
    
    // Salvar dados da venda pendente e mostrar modal NFC-e/Pré-venda
    setPendingSale({ saleData, cart, change });
    setShowPayModal(false);
    setShowNFCeModal(true);
    
    console.log('[finish] 🎉 Finalizou! Modal NFC-e deve estar visível agora.');
  };
  
  // Iniciar worker da fila unificada (SQLite/localStorage)

  useEffect(() => {
    const stop = startPendingSalesWorker({
      intervalMs: 30000,
      onUpdate: async () => {
        try {
          const count = await getPendingSalesCount();
          setPendingSalesCountState(count);
        } catch (e) {
          // ignore count errors silently
        }
      }
    });

    // Obter contagem inicial
    getPendingSalesCount().then(setPendingSalesCountState).catch(() => {});

    return () => {
      stop?.();
    };
  }, []);

  const handleManualSyncPending = async () => {
    try {
      setManualSyncPending(true);
      await syncPendingSalesQueue();
      const count = await getPendingSalesCount();
      setPendingSalesCountState(count);
    } finally {
      setManualSyncPending(false);
    }
  };

  const finalizeSale = async (saleType) => {
    if (!pendingSale) return;
    // Extrair dados da venda pendente
    const { saleData, cart: saleCart, change } = pendingSale;
    if (finalizingRef.current) {
      console.warn('[finalizeSale] Cancelando chamada duplicada - já processando outra finalização');
      return;
    }
    finalizingRef.current = true;
    setIsFinalizing(true);
    // 1. GERAR external_id (UUID)
    // ============================================
    const external_id = crypto.randomUUID();
    
    // ============================================
    // 2. TENTAR EXECUTAR callCreateSaleAtomic
    // ============================================
    let result;
    let createdSale;
    
    try {
        console.log('[finalizeSale] Tentando criar venda atomicamente:', {
          external_id,
          items: saleData.items.map(i => ({
            product_id: i.product_id,
            code: i.code,
            sku: i.sku,
            quantity: i.quantity,
            name: i.name
          })),
          total: saleData.total_amount,
          payment_method: saleData.payment_method
        });
      
      result = await Promise.race([
        supabaseDB.sales.callCreateSaleAtomic(saleData, external_id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000) // 10s timeout
        )
      ]);
      
      console.log('[finalizeSale] Resultado da RPC:', result);
    } catch (error) {
      // Timeout ou erro de rede
      console.error('[finalizeSale] Erro ao criar venda atomicamente:', error);
      result = { status: 'error', message: error.message || 'Erro de conexão' };
    }
    
    // ============================================
    // 3. PROCESSAR RESULTADO
    // ============================================
    if (result.status === 'ok') {
      // ✅ SUCESSO: Venda criada no Supabase
      // A RPC create_sale_atomic já atualizou o estoque no Supabase
      // Calcular métricas para relatório (total_cost, profit_amount, total_net, discount, items_count, metadata)
      let total_cost = 0;
      let items_count = 0;
      if (saleData.items && Array.isArray(saleData.items)) {
        for (const item of saleData.items) {
          const qty = Number(item.quantity || 0);
          items_count += qty;

          // Tentar obter preço de custo do item ou do produto local
          let cost = 0;
          if (item.cost_price !== undefined) cost = Number(item.cost_price) || 0;
          else if (item.costPrice !== undefined) cost = Number(item.costPrice) || 0;

          try {
            const prod = db.products.list().find(p => p.id === item.product_id);
            if (prod) {
              cost = cost || Number(prod.costPrice || prod.cost_price || 0);
            }
          } catch (e) {
            // ignore lookup errors
          }

          total_cost += cost * qty;
        }
      }

      const total_net = Number(saleData.total_amount ?? saleData.total_net ?? 0);
      const discount_amount = Number(saleData.discount_amount ?? saleData.discount ?? 0);
      const profit_amount = total_net - total_cost;
      const metadata = { items: (saleData.items || []).map(i => ({ sku: i.sku || i.code, product_id: i.product_id, quantity: i.quantity, price: i.price || i.unit_price || i.unitPrice })) };

      // Obter usuário logado do localStorage para complementar dados da venda
      const loggedUserStr = localStorage.getItem('mozyc_pdv_current_user');
      const loggedUser = loggedUserStr ? JSON.parse(loggedUserStr) : null;

      createdSale = {
        ...saleData,
        id: result.sale_id,
        external_id: result.external_id,
        synced: true,
        synced_at: new Date().toISOString(),
        total_cost,
        profit_amount,
        total_net,
        discount_amount,
        items_count,
        metadata,
        status: 'finalized',
        user_name: saleData.user_name || loggedUser?.name || loggedUser?.email?.split('@')[0] || 'Usuário',
        user_id: saleData.user_id || (loggedUser?.id ?? null)
      };
      
      // Sincronizar produtos do Supabase para pegar estoque atualizado pela RPC
      // Aguardar um pouco para garantir que a RPC terminou de atualizar o estoque
      try {
        console.log('[finalizeSale] Aguardando 1s antes de sincronizar produtos (garantir que RPC terminou)...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar estoque diretamente no Supabase ANTES de sincronizar
        if (saleData.items && Array.isArray(saleData.items)) {
          // Importar supabaseDB para verificar estoque diretamente
          const { supabaseDB: sdb } = await import('./services/supabaseDB.js');
          if (sdb) {
            const storeId = resolveStoreId();
            const { supabase } = await import('./services/supabaseClient.js');
            
            for (const item of saleData.items) {
              const itemSKU = item.code || item.sku;
              if (itemSKU || item.product_id) {
                try {
                  // Buscar produto por SKU primeiro (mais confiável), depois por ID
                  let supabaseProduct = null;
                  let error = null;
                  
                  if (itemSKU) {
                    const { data, error: err } = await supabase
                      .from('products')
                      .select('id, name, sku, stock, stock_quantity')
                      .eq('sku', itemSKU)
                      .eq('store_id', storeId)
                      .maybeSingle();
                    supabaseProduct = data;
                    error = err;
                  }
                  
                  // Se não encontrou por SKU, tentar por ID
                  if (!supabaseProduct && item.product_id) {
                    const { data, error: err } = await supabase
                      .from('products')
                      .select('id, name, sku, stock, stock_quantity')
                      .eq('id', item.product_id)
                      .eq('store_id', storeId)
                      .maybeSingle();
                    supabaseProduct = data;
                    error = err;
                  }
                  
                  if (supabaseProduct && !error) {
                    const supabaseStock = supabaseProduct.stock !== undefined && supabaseProduct.stock !== null ? supabaseProduct.stock : (supabaseProduct.stock_quantity || 0);
                    console.log(`[finalizeSale] 📊 Estoque DIRETO do Supabase: ${supabaseProduct.name} (SKU: ${supabaseProduct.sku || 'N/A'}) - ${supabaseStock} unidades (vendeu ${item.quantity})`);
                  } else if (error) {
                    console.error(`[finalizeSale] Erro ao buscar produto no Supabase (SKU: ${itemSKU || 'N/A'}, ID: ${item.product_id || 'N/A'}):`, error);
                  }
                } catch (e) {
                  console.error(`[finalizeSale] Erro ao verificar estoque no Supabase (SKU: ${itemSKU || 'N/A'}):`, e);
                }
              } else {
                console.warn(`[finalizeSale] ⚠️ Item sem SKU nem product_id:`, item);
              }
            }
          }
        }
        
        // Log do estoque ANTES da sincronização
        if (saleData.items && Array.isArray(saleData.items)) {
          for (const item of saleData.items) {
            if (item.product_id) {
              const productBefore = db.products.list().find(p => p.id === item.product_id);
              if (productBefore) {
                const stockBefore = productBefore.stock !== undefined && productBefore.stock !== null ? productBefore.stock : (productBefore.stock_quantity || 0);
                console.log(`[finalizeSale] Estoque ANTES da sincronização (local): ${productBefore.name} - ${stockBefore} unidades (vendeu ${item.quantity})`);
              }
            }
          }
        }
        
        await db.syncProducts();
        console.log('[finalizeSale] Produtos sincronizados do Supabase após venda');
        
        // Atualizar lista de produtos na UI
        const updatedProducts = db.products.list();
        setProducts(updatedProducts);
        console.log(`[finalizeSale] UI atualizada com ${updatedProducts.length} produtos`);
        
        // Verificar estoque atualizado para cada produto vendido
        if (saleData.items && Array.isArray(saleData.items)) {
          for (const item of saleData.items) {
            if (item.product_id) {
              const product = updatedProducts.find(p => p.id === item.product_id);
              if (product) {
                // PRIORIZAR campo stock (coluna principal do Supabase)
                const currentStock = product.stock !== undefined && product.stock !== null ? product.stock : (product.stock_quantity || 0);
                console.log(`[finalizeSale] ✅ Estoque APÓS sincronização: ${product.name} - ${currentStock} unidades`);
              } else {
                console.error(`[finalizeSale] ❌ Produto não encontrado após sincronização: ${item.product_id}`);
              }
            }
          }
        }
      } catch (error) {
        console.error('[finalizeSale] Erro ao sincronizar produtos após venda:', error);
      }
      
      // ✅ Venda salva no Supabase e localmente para consistência do relatório
      db.sales.create(createdSale, user); // Salva a venda no localStorage
      console.log('[finalizeSale] ✅ Venda salva no Supabase e LOCALMENTE (ID: %s)', createdSale.id);
      
    } else if (result.status === 'insufficient_stock') {
      // Estoque insuficiente: mostrar alerta e impedir finalizar
      alert(`❌ Estoque insuficiente!\n\n${result.message}\n\nProduto: ${result.product_id}\nDisponível: ${result.available_stock}\nRequerido: ${result.required_quantity}`);
      
      // Marcar venda como conflitante no LS
      const storeId = resolveStoreId();
      const conflictKey = `conflictSales_${storeId}`;
      const conflicts = JSON.parse(localStorage.getItem(conflictKey) || '[]');
      conflicts.push({
        external_id,
        sale: saleData,
        status: 'conflict',
        reason: 'insufficient_stock',
        message: result.message,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(conflictKey, JSON.stringify(conflicts));
      
      // Não finalizar a venda
      // Reset finalizing flags antes de retornar
      finalizingRef.current = false;
      setIsFinalizing(false);
      return;
      
    } else {
      // ❌ FALHA NO SUPABASE: Verificar tipo de erro
      const errorMessage = result.message || result.data?.message || 'Erro desconhecido ao salvar venda no Supabase';
      const errorCode = result.data?.error_code || result.error_code || result.errorCode;
      
      console.error('[finalizeSale] ❌ Falha ao salvar no Supabase:', errorMessage);
      console.error('[finalizeSale] Código do erro:', errorCode);
      console.error('[finalizeSale] Detalhes completos do erro:', result);
      
      // Se for erro de coluna external_id não existir, não adicionar à fila
      // (será resolvido quando o SQL for executado)
      if (errorCode === '42703' && (errorMessage.includes('external_id') || errorMessage.includes('does not exist'))) {
        alert(`❌ Erro de configuração!\n\nA coluna 'external_id' não existe na tabela 'sales'.\n\nExecute o SQL em sql/add_external_id_to_sales.sql no Supabase SQL Editor.\n\nA venda NÃO foi salva. Tente novamente após executar o SQL.`);
        finalizingRef.current = false;
        setIsFinalizing(false);
        return;
      }
      
      // Se for erro de SKU não encontrado, mostrar mensagem específica
      if (errorMessage.includes('SKU: N/A') || errorMessage.includes('Produto não encontrado')) {
        alert(`❌ Erro ao finalizar venda!\n\nProduto não encontrado. Verifique se os produtos têm SKU (código) cadastrado.\n\nErro: ${errorMessage}`);
        finalizingRef.current = false;
        setIsFinalizing(false);
        return;
      }
      
      // Adicionar à fila de vendas pendentes para retry automático (apenas se não for erro de configuração)
      await enqueuePendingSale({
        sale: { ...saleData, store_id: saleData.store_id || resolveStoreId() },
        externalId: external_id,
        storeId: saleData.store_id || resolveStoreId(),
        posId: saleData.pos_id,
        cashSessionId: saleData.cash_session_id,
        errorMessage,
      });
      const newCount = await getPendingSalesCount();
      setPendingSalesCountState(newCount);

      // Mostrar erro ao usuário e não finalizar a venda
      alert(`❌ Erro ao finalizar venda!\n\n${errorMessage}\n\nA venda foi adicionada à fila e será sincronizada automaticamente quando possível.`);
      
      // Reset finalizing flags antes de retornar
      finalizingRef.current = false;
      setIsFinalizing(false);
      // Não finalizar a venda - retornar para permitir nova tentativa
      return;
    }
    
    // ============================================
    // 4. GERAR E IMPRIMIR NOTA FISCAL (APENAS SE VENDA FOI SALVA)
    // ============================================
    // Só gerar nota se a venda foi salva com sucesso no Supabase
    if (createdSale && createdSale.id) {
    const settings = db.settings.get();
      // Passar o tipo de nota (prevenda ou nfce)
      generateInvoice(createdSale, saleCart, settings, user, saleType);
      
      // Mensagem de confirmação única: "Sua compra foi confirmada"
      // Só mostra troco se houver troco a devolver
      const changeMessage = saleData.payment_method === "money" && change > 0 
        ? `\n\nDevolva ${formatCurrency(change)}` 
        : "";
      alert(`Sua compra foi confirmada!${changeMessage}`);
      
      // Fechar todos os modais
      setShowPayModal(false);
      setShowNFCeModal(false);
      
      // Limpar tudo
    setCart([]);
    localStorage.removeItem('mozyc_pdv_cart'); // Limpa carrinho do localStorage
      setPendingSale(null);
    setMoneyReceived("");
    setPayMethod("money");
    setPixType("maquina");
    setAppliedDiscount(0);
    setDiscountCode("");
      
      // Recarregar produtos após venda (sincronizar do Supabase)
      try {
        await db.syncProducts();
    setProducts(db.products.list());
        console.log('[finalizeSale] Produtos recarregados após venda');
      } catch (error) {
        console.error('[finalizeSale] Erro ao recarregar produtos:', error);
        setProducts(db.products.list()); // Fallback para produtos locais
      }
    } else {
      // Se não há createdSale, a venda falhou e já foi tratada acima
      console.warn('[finalizeSale] Venda não foi criada, não gerando nota fiscal');
    }
    // Reset finalizing flags (sucesso/fluxo normal)
    finalizingRef.current = false;
    setIsFinalizing(false);
  };

  // Sistema de atalhos de teclado para PDV
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar se estiver digitando em input/textarea (exceto atalhos específicos)
      const isInputActive = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      
      // Atalho F1: Selecionar campo de cupom
      if (e.key === 'F1' && !showPayModal && !showNFCeModal) {
        e.preventDefault();
        discountInputRef.current?.focus();
        return;
      }
      
      // Atalho Enter no campo de cupom
      if (e.key === 'Enter' && e.target === discountInputRef.current && !showPayModal && !showNFCeModal) {
        e.preventDefault();
        checkCoupon();
        return;
      }
      
      // Se estiver digitando em outro input e não for atalho global, ignorar
      if (isInputActive && e.target !== discountInputRef.current) {
        // Permitir apenas atalhos globais (F2 para pagar, Esc para voltar)
        if (e.key !== 'F2' && e.key !== 'Escape' && e.key !== 'Enter') {
          return;
        }
      }
      
      // Atalho F2: Abrir modal de pagamento
      if (e.key === 'F2' && !showPayModal && !showNFCeModal && cart.length > 0) {
        e.preventDefault();
        setShowPayModal(true);
        return;
      }
      
      // Atalhos dentro do modal de pagamento
      if (showPayModal && !showNFCeModal) {
        // Esc: Fechar modal
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowPayModal(false);
          setPayMethod("money");
          setPixType("maquina");
          setMoneyReceived("");
          return;
        }
        
        // Enter: Confirmar pagamento (exceto se estiver digitando valor em dinheiro)
        if (e.key === 'Enter') {
          // Se estiver no input de dinheiro recebido, não confirmar
          if (isInputActive && payMethod === 'money' && e.target.type === 'number') {
            return;
          }
          e.preventDefault();
          finish();
          return;
        }
        
        // Atalhos de método de pagamento
        if (payMethod === 'pix') {
          // Dentro do PIX: 1 = Máquina, 2 = Direto
          if (e.key === '1') {
            e.preventDefault();
            setPixType('maquina');
            return;
          }
          if (e.key === '2') {
            e.preventDefault();
            setPixType('direto');
            return;
          }
        } else {
          // F3: Selecionar PIX (depois use 1 ou 2 para escolher tipo)
          if (e.key === 'F3') {
            e.preventDefault();
            setPayMethod('pix');
            setPixType('maquina'); // Default ao abrir PIX
            return;
          }
          // F4: Selecionar Débito
          if (e.key === 'F4') {
            e.preventDefault();
            setPayMethod('debit');
            return;
          }
          // F5: Selecionar Crédito
          if (e.key === 'F5') {
            e.preventDefault();
            setPayMethod('credit');
            return;
          }
        }
      }
      
      // Atalhos dentro do modal NFC-e/Pré-venda
      if (showNFCeModal) {
        // Esc: Fechar modal
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowNFCeModal(false);
          setPendingSale(null);
          return;
        }
        
        // Enter: Confirmar (já tratado no botão)
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPayModal, cart.length, payMethod, pixType, checkCoupon, finish]);


  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
      {/* Área Principal - Produtos (Esquerda) */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Campo BIP - Alinhado no topo com o carrinho */}
        <Card className="p-4 flex gap-2 rounded-xl flex-shrink-0">
          <Input 
            ref={barcodeInputRef}
            placeholder="Buscar produto ou escanear código de barras (BIP)..." 
            value={term} 
            onChange={(e) => {
              const value = e.target.value;
              setTerm(value);
              lastBarcodeValueRef.current = value;
              
              // Limpa timeout anterior
              if (barcodeTimeoutRef.current) {
                clearTimeout(barcodeTimeoutRef.current);
              }
              
              // Detecta leitura de código de barras (leitores digitam muito rápido)
              // Se há um código (mínimo 3 caracteres), aguarda um pouco para processar
              if (value.length >= 3) {
                barcodeTimeoutRef.current = setTimeout(() => {
                  // Se o valor não mudou, significa que a leitura terminou
                  const currentValue = barcodeInputRef.current?.value || lastBarcodeValueRef.current;
                  if (currentValue === value && value.length >= 3) {
                    processBarcode(value);
                  }
                }, 200); // 200ms de delay para capturar leituras rápidas do BIP
              }
            }}
            onKeyDown={(e) => {
              // Enter ou Tab (leitores de código de barras geralmente enviam Enter no final)
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                // Limpa timeout se houver
                if (barcodeTimeoutRef.current) {
                  clearTimeout(barcodeTimeoutRef.current);
                }
                processBarcode(term);
              }
            }}
            className="flex-1 rounded-lg"
            autoFocus
          />
          <Button 
            onClick={() => {
              setShowBarcodeScanner(true);
            }} 
            variant="primary"
            className="rounded-full"
            title="Abrir câmera para escanear código de barras"
          >
            <Camera size={20}/>
          </Button>
        </Card>

        {/* Lista de Produtos - Abaixo do campo BIP */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {products.filter(p => {
            const searchTerm = term.toLowerCase();
            return (
              p.modelName?.toLowerCase().includes(searchTerm) ||
              p.code?.toLowerCase().includes(searchTerm) ||
              p.color?.toLowerCase().includes(searchTerm) ||
              p.size?.toLowerCase().includes(searchTerm)
            );
          }).map(p => {
            // Se stock não estiver definido, considera como disponível (estoque ilimitado)
            const stock = (p.stock !== undefined && p.stock !== null) ? p.stock : 999;
            const hasStock = stock > 0 || (p.stock === undefined || p.stock === null);
            
            return (
              <Card 
                key={p.id} 
                className={`
                  p-3 flex justify-between items-center 
                  rounded-xl transition-all
                  ${hasStock 
                    ? 'cursor-pointer hover:border-[#d9b53f] hover:shadow-md hover:bg-[#d9b53f]/10 active:scale-95' 
                    : 'opacity-50 cursor-not-allowed'
                  }
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasStock) {
                    console.log("Clicou no produto:", p);
                    add(p);
                  } else {
                    alert("Produto sem estoque disponível");
                  }
                }}
                title={hasStock ? "Clique para adicionar ao carrinho" : "Produto sem estoque"}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.modelName || p.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.color && p.size ? `${p.color} - ${p.size}` : ''} {p.color && p.size ? '| ' : ''}Código: {p.code}
                  </p>
                  <p className={`text-xs ${hasStock ? 'text-[#d9b53f]' : 'text-red-500'}`}>
                    Estoque: {p.stock !== undefined && p.stock !== null ? stock : 'Ilimitado'}
                  </p>
                </div>
                <div className="flex flex-col items-end ml-4">
                  <p className="text-green-600 font-bold whitespace-nowrap">
                    {formatCurrency(p.salePrice || p.sale_price || 0)}
                  </p>
                  {hasStock && (
                    <p className="text-xs text-blue-500 mt-1">Clique para adicionar</p>
                  )}
                </div>
              </Card>
            );
          })}
          {products.filter(p => {
            const searchTerm = term.toLowerCase();
            return (
              p.modelName?.toLowerCase().includes(searchTerm) ||
              p.code?.toLowerCase().includes(searchTerm) ||
              p.color?.toLowerCase().includes(searchTerm) ||
              p.size?.toLowerCase().includes(searchTerm)
            );
          }).length === 0 && (
            <Card className="p-8 text-center rounded-xl">
              <p className="text-gray-500">Nenhum produto encontrado</p>
            </Card>
          )}
        </div>
      </div>

      {/* Carrinho (Direita) - Fixo em desktop, abaixo em mobile */}
      <div className="w-full lg:w-[400px] flex-shrink-0 lg:h-full">
        <Card className="flex flex-col border-l-4 border-l-blue-600 rounded-xl h-full lg:h-full max-h-[600px] lg:max-h-none">
          <div className="p-4 border-b bg-gray-50 rounded-t-xl flex-shrink-0">
            <h2 className="font-bold flex gap-2 items-center">
              <ShoppingCart size={20}/> Carrinho
            </h2>
          </div>
          
          {/* Itens do Carrinho */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {!cart || cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart size={48} className="mx-auto mb-2 opacity-30"/>
                <p>Carrinho vazio</p>
                <p className="text-xs mt-2">Total de itens: {cart?.length || 0}</p>
              </div>
            ) : (
              cart.map(i => (
                <div key={i.pid} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex-1 min-w-0 mr-2">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <p className="text-xs text-[#d9b53f]">{formatCurrency(i.price)}</p>
                    <p className="text-xs text-gray-500">Subtotal: {formatCurrency(i.price * i.qtd)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setCart(cart.map(x => x.pid === i.pid ? {...x, qtd: Math.max(1, x.qtd-1)} : x))} 
                        className="p-1.5 border rounded-full hover:bg-slate-200 transition-colors bg-white"
                      >
                        <Minus size={14}/>
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={i.qtd}
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value) || 1;
                          if (newQty >= 1) {
                            setCart(cart.map(x => x.pid === i.pid ? {...x, qtd: newQty} : x));
                          }
                        }}
                        onBlur={(e) => {
                          // Garantir que sempre tenha pelo menos 1
                          const value = parseInt(e.target.value);
                          if (!value || value < 1) {
                            setCart(cart.map(x => x.pid === i.pid ? {...x, qtd: 1} : x));
                          }
                        }}
                        onKeyDown={(e) => {
                          // Permitir Enter para confirmar
                          if (e.key === 'Enter') {
                            e.target.blur();
                          }
                        }}
                        className="text-sm font-bold w-12 text-center border rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button 
                        onClick={() => setCart(cart.map(x => x.pid === i.pid ? {...x, qtd: x.qtd+1} : x))} 
                        className="p-1.5 border rounded-full hover:bg-slate-200 transition-colors bg-white"
                      >
                        <Plus size={14}/>
                      </button>
                    </div>
                    <button 
                      onClick={() => setCart(cart.filter(x => x.pid !== i.pid))}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Cupom */}
          <div className="p-3 bg-white border-t flex gap-2 items-center flex-shrink-0">
            <Input 
              ref={discountInputRef}
              placeholder="Código do cupom" 
              value={discountCode} 
              onChange={e => setDiscountCode(e.target.value.toUpperCase())} 
              className="flex-1 rounded-lg" 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  checkCoupon();
                }
              }}
            />
            <Button 
              onClick={checkCoupon} 
              variant="outline" 
              className="rounded-full whitespace-nowrap"
            >
              Aplicar
            </Button>
          </div>

          {/* Total e Botão Pagar */}
          <div className="p-6 bg-gray-100 rounded-b-xl flex-shrink-0">
            {appliedDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 mb-2">
                <span>Desconto ({appliedDiscount}%)</span>
                <span>- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold mb-4">
              <span>Total</span>
              <span className="text-green-600">{formatCurrency(totalFinal)}</span>
            </div>
            <button 
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-full transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed" 
              onClick={() => setShowPayModal(true)} 
              disabled={cart.length===0}
            >
              Pagar
            </button>
          </div>
        </Card>
      </div>


      {/* Modal Pagamento */}
      {showPayModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPayModal(false);
              setPayMethod("money");
              setPixType("maquina");
              setMoneyReceived("");
            }
          }}
        >
          <Card className="w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Finalizar Pagamento</h2>
            <div className="mb-6 text-center bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-sm text-gray-500">Valor Final</p>
              <p className="text-3xl font-bold text-green-700">{formatCurrency(totalFinal)}</p>
            </div>


            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button 
                variant={payMethod === 'money' ? 'primary' : 'outline'} 
                onClick={(e) => {
                  e.stopPropagation();
                  setPayMethod('money');
                }}
                className="rounded-full"
              >
                <Banknote size={18} className="mr-2"/> Dinheiro
              </Button>
              <Button 
                variant={payMethod === 'pix' ? 'primary' : 'outline'} 
                onClick={(e) => {
                  e.stopPropagation();
                  setPayMethod('pix');
                }}
                className="rounded-full"
              >
                <QrCode size={18} className="mr-2"/> Pix
              </Button>
              <Button 
                variant={payMethod === 'debit' ? 'primary' : 'outline'} 
                onClick={(e) => {
                  e.stopPropagation();
                  setPayMethod('debit');
                }}
                className="rounded-full"
              >
                <CreditCard size={18} className="mr-2"/> Débito
              </Button>
              <Button 
                variant={payMethod === 'credit' ? 'primary' : 'outline'} 
                onClick={(e) => {
                  e.stopPropagation();
                  setPayMethod('credit');
                }}
                className="rounded-full"
              >
                <CreditCard size={18} className="mr-2"/> Crédito
              </Button>
            </div>


            {payMethod === 'money' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-bold mb-2">Valor Recebido (R$)</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    autoFocus 
                    value={moneyReceived} 
                    onChange={e => setMoneyReceived(e.target.value)} 
                    placeholder="0,00"
                    className="w-full rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-100 rounded-xl">
                  <span className="font-bold text-slate-600">Troco:</span>
                  <span className={`font-bold text-2xl ${
                    !moneyReceived || moneyReceived.trim() === "" 
                      ? 'text-gray-500' 
                      : change < 0 
                        ? 'text-red-500' 
                        : change > 0 
                          ? 'text-green-600' 
                          : 'text-gray-600'
                  }`}>
                    {!moneyReceived || moneyReceived.trim() === "" 
                      ? formatCurrency(0) 
                      : formatCurrency(change)}
                  </span>
                </div>
              </div>
            )}

            {payMethod === 'pix' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-bold mb-2">Tipo de PIX</label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant={pixType === 'maquina' ? 'primary' : 'outline'} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPixType('maquina');
                      }}
                      className="rounded-full"
                    >
                      PIX Máquina
                    </Button>
                    <Button 
                      variant={pixType === 'direto' ? 'primary' : 'outline'} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPixType('direto');
                      }}
                      className="rounded-full"
                    >
                      PIX Direto
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-100 rounded-xl">
                  <span className="font-bold text-slate-600">Tipo selecionado:</span>
                  <span className="font-bold text-lg text-[#d9b53f]">
                    {pixType === 'maquina' ? 'PIX Máquina' : 'PIX Direto'}
                  </span>
                </div>
              </div>
            )}


            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="flex-1 rounded-full" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPayModal(false);
                }}
              >
                Voltar
              </Button>
              <button 
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-full transition-colors duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  finish();
                }}
              >
                Confirmar
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal NFC-e / Pré-venda */}
      {showNFCeModal && pendingSale && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNFCeModal(false);
              setPendingSale(null);
            }
          }}
        >
          <Card className="w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4 text-center">Selecione o Tipo de Venda</h2>
            <div className="mb-6 text-center bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-sm text-gray-500">Valor Final</p>
              <p className="text-3xl font-bold text-green-700">{formatCurrency(pendingSale.saleData.total_amount)}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <Button 
                variant="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  finalizeSale('nfce');
                }}
                className="rounded-full py-4 text-lg"
                disabled={isFinalizing}
              >
                {isFinalizing ? 'Processando...' : 'NFC-e'}
              </Button>
              <Button 
                variant="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  finalizeSale('prevenda');
                }}
                className="rounded-full py-4 text-lg"
                disabled={isFinalizing}
              >
                {isFinalizing ? 'Processando...' : 'Pré-venda'}
              </Button>
            </div>

            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="flex-1 rounded-full" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNFCeModal(false);
                  setPendingSale(null);
                  setShowPayModal(true);
                }}
              >
                Voltar (ESC)
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Scanner de Código de Barras */}
      {showBarcodeScanner && (
        <BarcodeScannerModal 
          onClose={() => setShowBarcodeScanner(false)}
          onScan={(code) => {
            processBarcode(code);
            setShowBarcodeScanner(false);
          }}
        />
      )}
    </div>
  );
}

// Componente Modal de Scanner de Código de Barras
function BarcodeScannerModal({ onClose, onScan }) {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const scannerInstanceRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const initScanner = async () => {
      try {
        const scanner = new Html5QrcodeScanner(
          "barcode-reader",
          { 
            fps: 10,
            qrbox: { width: 400, height: 200 },
            formatsToSupport: [
              0, // CODE_128
              1, // CODE_39
              2, // EAN_13
              3, // EAN_8
              4, // ITF
              5, // UPC_A
              6, // UPC_E
              8, // RSS_14
              9, // CODABAR
            ],
            aspectRatio: 1.777778,
            disableFlip: false,
            showTorchButtonIfSupported: true,
            rememberLastUsedCamera: true,
          },
          false
        );

        scannerInstanceRef.current = scanner;

        scanner.render(
          (decodedText) => {
            if (isMounted) {
              console.log(`[Scanner] Código detectado: ${decodedText}`);
              scanner.clear().then(() => {
                onScan(decodedText);
              }).catch(console.error);
            }
          },
          (errorMessage) => {
            // Ignora erros normais de scanning
            if (!errorMessage.includes('NotFoundException') && 
                !errorMessage.includes('No MultiFormat Readers')) {
              console.warn(`[Scanner] ${errorMessage}`);
            }
          }
        );

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Scanner] Erro ao inicializar:', err);
        if (isMounted) {
          setError('Erro ao acessar a câmera. Verifique as permissões.');
          setIsLoading(false);
        }
      }
    };

    // Pequeno delay para garantir que o DOM está pronto
    const timeout = setTimeout(() => {
      initScanner();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.clear().catch(console.error);
      }
    };
  }, [onScan]);

  // ESC para fechar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-[80] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card className="w-full max-w-3xl p-6 rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Escanear Código de Barras</h2>
            <p className="text-sm text-gray-500 mt-1">Use a câmera para ler códigos de produtos</p>
          </div>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="rounded-full w-10 h-10 p-0 text-xl hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </Button>
        </div>

        {/* Instruções */}
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-yellow-500 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-3xl">📷</div>
            <div>
              <p className="text-sm font-semibold text-yellow-900 mb-1">
                Como usar:
              </p>
              <ul className="text-xs text-yellow-800 space-y-1">
                <li>• Permita o acesso à câmera quando solicitado</li>
                <li>• Posicione o código de barras horizontalmente</li>
                <li>• Mantenha uma distância de 10-20cm da câmera</li>
                <li>• Aguarde a leitura automática</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="mb-4 p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Iniciando câmera...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-sm text-red-800 font-medium">{error}</p>
            <p className="text-xs text-red-600 mt-1">
              Certifique-se de que o navegador tem permissão para acessar a câmera.
            </p>
          </div>
        )}

        {/* Scanner Container */}
        <div className="mb-6 bg-gray-900 rounded-xl overflow-hidden shadow-inner">
          <div id="barcode-reader" className="min-h-[300px]" />
          <style>{`
            #barcode-reader {
              background: #1f2937 !important;
            }
            #barcode-reader__dashboard_section {
              text-align: center !important;
            }
            #barcode-reader__dashboard_section_csr button,
            #barcode-reader__dashboard_section_fsr button {
              color: white !important;
              background: #d9b53f !important;
              border: none !important;
              padding: 12px 24px !important;
              border-radius: 8px !important;
              font-weight: 500 !important;
              margin: 8px auto !important;
              display: block !important;
            }
            #barcode-reader__dashboard_section_csr button:hover,
            #barcode-reader__dashboard_section_fsr button:hover {
              background: #bf9035 !important;
            }
            #barcode-reader__scan_region {
              border: 2px solid #d9b53f !important;
              border-radius: 12px !important;
            }
            #barcode-reader video {
              border-radius: 8px !important;
            }
            #barcode-reader__header_message {
              color: white !important;
              text-align: center !important;
              padding: 16px !important;
              font-size: 14px !important;
            }
            #barcode-reader__camera_permission_button {
              color: white !important;
              background: #d9b53f !important;
              border: none !important;
              padding: 12px 32px !important;
              border-radius: 8px !important;
              font-weight: 600 !important;
              margin: 16px auto !important;
              display: block !important;
            }
            #barcode-reader__camera_permission_button:hover {
              background: #bf9035 !important;
            }
            /* Estilizar ícone e texto */
            #barcode-reader img,
            #barcode-reader svg {
              filter: brightness(0) invert(1) !important;
              margin: 0 auto !important;
            }
            #barcode-reader span,
            #barcode-reader p,
            #barcode-reader div:not(#barcode-reader__scan_region) {
              color: white !important;
              text-align: center !important;
            }
            #barcode-reader a {
              color: #d9b53f !important;
              text-align: center !important;
              display: block !important;
              margin: 8px auto !important;
            }
          `}</style>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-gray-500">
            Formatos suportados: EAN-13, CODE-128, CODE-39, UPC-A
          </p>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="rounded-full px-6"
          >
            Fechar (ESC)
          </Button>
        </div>
      </Card>
    </div>
  );
}


// Página de Produtos - Cadastro por Modelo
function Products({ user }) {
  const [models, setModels] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedModelForPrint, setSelectedModelForPrint] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ type: null, message: null }); // 'success', 'error', null
  const exportMenuRef = useRef(null);
  const importMenuRef = useRef(null);
  
  // Formulário de novo modelo
  const [modelName, setModelName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [taxPercentage, setTaxPercentage] = useState("");
  const [ncm, setNcm] = useState("");
  const [modelImage, setModelImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [variations, setVariations] = useState([{ color: "", size: "", quantity: "" }]);
  const fileInputRef = useRef(null);
  
  const colors = ["Preto", "Branco", "Verde", "Azul", "Vermelho", "Amarelo", "Rosa", "Cinza", "Marrom", "Bege"];
  const sizes = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

  // Função para reconstruir modelos baseados nos produtos do Supabase
  const rebuildModelsFromProducts = async () => {
    try {
      const allProducts = db.products.list();
      const existingModels = db.productModels.list();
      
      // Agrupar produtos por modelName (ou modelId se modelName não existir)
      const productsByModel = {};
      
      allProducts.forEach(product => {
        // Usar modelName como chave principal, ou modelId como fallback
        const modelKey = product.modelName || product.modelId || product.name?.split(' ')[0] || 'Sem Modelo';
        
        if (!productsByModel[modelKey]) {
          productsByModel[modelKey] = {
            modelName: product.modelName || modelKey,
            modelId: product.modelId || null,
            products: []
          };
        }
        
        productsByModel[modelKey].products.push(product);
      });
      
      // Para cada grupo de produtos, criar ou atualizar modelo
      for (const [modelKey, modelData] of Object.entries(productsByModel)) {
        if (modelData.products.length === 0) continue;
        
        // Pegar o primeiro produto como referência
        const firstProduct = modelData.products[0];
        
        // Verificar se modelo já existe
        let existingModel = null;
        
        if (modelData.modelId) {
          // Tentar encontrar por ID
          existingModel = existingModels.find(m => m.id === modelData.modelId);
        }
        
        if (!existingModel) {
          // Tentar encontrar por nome
          existingModel = existingModels.find(m => 
            m.name === modelData.modelName || 
            m.name === firstProduct.modelName
          );
        }
        
        if (!existingModel) {
          // Criar novo modelo baseado no primeiro produto
          const baseCode = (firstProduct.code || firstProduct.sku || modelKey.slice(0, 3).toUpperCase()).replace(/[^A-Z0-9]/g, '');
          const modelCode = baseCode + Math.random().toString(36).slice(2, 6).toUpperCase();
          
          const newModel = {
            id: modelData.modelId || crypto.randomUUID(),
            name: modelData.modelName || firstProduct.name?.split(' ')[0] || 'Produto',
            code: modelCode,
            costPrice: firstProduct.costPrice || firstProduct.cost_price || 0,
            salePrice: firstProduct.salePrice || firstProduct.sale_price || firstProduct.price || 0,
            taxPercentage: firstProduct.taxPercentage || 0,
            ncm: firstProduct.ncm || null,
            image: firstProduct.image || null
          };
          
          // Salvar modelo usando a função do db (que atualiza localStorage corretamente)
          // Como não temos acesso direto ao saveDB, vamos usar uma abordagem diferente
          // Vamos criar o modelo através de uma função auxiliar
          const currentModels = db.productModels.list();
          currentModels.push(newModel);
          
          // Atualizar localStorage usando a mesma lógica do db.js
          const tenantId = (() => {
            try {
              const userStr = localStorage.getItem('mozyc_pdv_current_user');
              if (userStr) {
                const user = JSON.parse(userStr);
                if (user.role === 'admin' && user.email) {
                  return user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
                }
                if (user.tenantId) {
                  return user.tenantId;
                }
              }
            } catch (e) {}
            return null;
          })();
          
          const dbKey = tenantId ? `mozyc_pdv_db_v2_tenant_${tenantId}` : 'mozyc_pdv_db_v2';
          const dbData = JSON.parse(localStorage.getItem(dbKey) || '{}');
          if (!dbData.productModels) dbData.productModels = [];
          dbData.productModels.push(newModel);
          localStorage.setItem(dbKey, JSON.stringify(dbData));
          
          console.log(`[rebuildModelsFromProducts] Modelo criado: ${newModel.name} (${newModel.id})`);
        } else {
          // Atualizar modelo existente se necessário
          let needsUpdate = false;
          const updatedModel = { ...existingModel };
          
          // Atualizar preços se diferentes (usar valores do primeiro produto como referência)
          const firstCostPrice = firstProduct.costPrice || firstProduct.cost_price || 0;
          const firstSalePrice = firstProduct.salePrice || firstProduct.sale_price || firstProduct.price || 0;
          const firstTaxPercentage = firstProduct.taxPercentage || 0;
          const firstNcm = firstProduct.ncm || null;
          
          if (firstCostPrice > 0 && existingModel.costPrice !== firstCostPrice) {
            updatedModel.costPrice = firstCostPrice;
            needsUpdate = true;
          }
          if (firstSalePrice > 0 && existingModel.salePrice !== firstSalePrice) {
            updatedModel.salePrice = firstSalePrice;
            needsUpdate = true;
          }
          if (firstTaxPercentage > 0 && existingModel.taxPercentage !== firstTaxPercentage) {
            updatedModel.taxPercentage = firstTaxPercentage;
            needsUpdate = true;
          }
          if (firstNcm && existingModel.ncm !== firstNcm) {
            updatedModel.ncm = firstNcm;
            needsUpdate = true;
          }
          if (firstProduct.image && existingModel.image !== firstProduct.image) {
            updatedModel.image = firstProduct.image;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            // Atualizar modelo no localStorage
            const tenantId = (() => {
              try {
                const userStr = localStorage.getItem('mozyc_pdv_current_user');
                if (userStr) {
                  const user = JSON.parse(userStr);
                  if (user.role === 'admin' && user.email) {
                    return user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
                  }
                  if (user.tenantId) {
                    return user.tenantId;
                  }
                }
              } catch (e) {}
              return null;
            })();
            
            const dbKey = tenantId ? `mozyc_pdv_db_v2_tenant_${tenantId}` : 'mozyc_pdv_db_v2';
            const dbData = JSON.parse(localStorage.getItem(dbKey) || '{}');
            if (dbData.productModels) {
              const index = dbData.productModels.findIndex(m => m.id === existingModel.id);
              if (index > -1) {
                dbData.productModels[index] = updatedModel;
                localStorage.setItem(dbKey, JSON.stringify(dbData));
                console.log(`[rebuildModelsFromProducts] Modelo atualizado: ${updatedModel.name}`);
              }
            }
          }
        }
      }
      
      console.log(`[rebuildModelsFromProducts] Reconstrução concluída: ${Object.keys(productsByModel).length} modelo(s) processado(s)`);
    } catch (error) {
      console.error('[rebuildModelsFromProducts] Erro ao reconstruir modelos:', error);
    }
  };

  useEffect(() => {
    // Sincronizar produtos do Supabase ao carregar a página
    const syncProductsOnLoad = async () => {
      setIsSyncing(true);
      setSyncStatus({ type: null, message: null });
      
      try {
        // Atualizar produtos existentes no Supabase com model_name, color, size
        try {
          const sdb = await import('./services/supabaseDB.js').then(m => m.supabaseDB);
          if (sdb && sdb.products.updateProductsModelFields) {
            console.log('[Products] Atualizando produtos existentes com model_name, color, size...');
            const result = await sdb.products.updateProductsModelFields();
            if (result.updated > 0) {
              console.log(`[Products] ✓ ${result.updated} produtos atualizados com model_name`);
            }
          }
        } catch (updateError) {
          console.warn('[Products] Erro ao atualizar produtos existentes (pode ser que as colunas não existam ainda):', updateError);
          // Não bloquear a sincronização se falhar
        }
        
        await db.syncProducts();
        console.log('[Products] Produtos sincronizados do Supabase');
        
        // Reconstruir modelos baseados nos produtos do Supabase
        await rebuildModelsFromProducts();
        
        setSyncStatus({ type: 'success', message: 'Produtos sincronizados com sucesso!' });
        setTimeout(() => setSyncStatus({ type: null, message: null }), 3000);
      } catch (error) {
        console.error('[Products] Erro ao sincronizar produtos:', error);
        setSyncStatus({ type: 'error', message: 'Erro ao sincronizar produtos. Verifique sua conexão.' });
        setTimeout(() => setSyncStatus({ type: null, message: null }), 5000);
      } finally {
        setIsSyncing(false);
    refreshModels();
      }
    };
    
    syncProductsOnLoad();
  }, []);

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
      if (importMenuRef.current && !importMenuRef.current.contains(event.target)) {
        setShowImportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const refreshModels = () => {
    setModels(db.productModels.list());
  };

  // Funções de Exportar/Importar Estoque
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const result = await exportStockToCSV();
      if (result.success) {
        alert(`Estoque exportado com sucesso!\n${result.count} produtos exportados.`);
      } else {
        alert(`Erro ao exportar: ${result.error || result.message}`);
      }
    } catch (error) {
      alert(`Erro ao exportar estoque: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const result = await exportStockToExcel();
      if (result.success) {
        alert(`Estoque exportado com sucesso!\n${result.count} produtos exportados.`);
      } else {
        alert(`Erro ao exportar: ${result.error || result.message}`);
      }
    } catch (error) {
      alert(`Erro ao exportar estoque: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportCSV = async () => {
    if (!confirm('Deseja importar estoque de um arquivo CSV? Isso atualizará os estoques dos produtos encontrados.')) {
      return;
    }
    
    setIsImporting(true);
    try {
      const result = await importStockFromCSV();
      if (result.success) {
        alert(result.message);
        refreshModels();
        // Recarregar produtos se necessário
        window.location.reload();
      } else {
        alert(`Erro ao importar: ${result.error || result.message}`);
      }
    } catch (error) {
      alert(`Erro ao importar estoque: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportExcel = async () => {
    if (!confirm('Deseja importar estoque de um arquivo Excel? Isso atualizará os estoques dos produtos encontrados.')) {
      return;
    }
    
    setIsImporting(true);
    try {
      const result = await importStockFromExcel();
      if (result.success) {
        alert(result.message);
        refreshModels();
        // Recarregar produtos se necessário
        window.location.reload();
      } else {
        alert(`Erro ao importar: ${result.error || result.message}`);
      }
    } catch (error) {
      alert(`Erro ao importar estoque: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const result = await createImportTemplate();
      if (result.success) {
        alert('Template de importação criado com sucesso!');
      } else {
        alert(`Erro ao criar template: ${result.message}`);
      }
    } catch (error) {
      alert(`Erro ao criar template: ${error.message}`);
    }
  };

  const handleAddVariation = () => {
    setVariations([...variations, { color: "", size: "", quantity: "" }]);
  };

  const handleEditModel = (model) => {
    setSelectedModel(model);
    setModelName(model.name || "");
    setCostPrice(model.costPrice?.toString() || "");
    setSalePrice(model.salePrice?.toString() || "");
    setTaxPercentage(model.taxPercentage?.toString() || "");
    setNcm(model.ncm || "");
    setImagePreview(model.image || null);
    
    // Carregar produtos existentes do modelo para mostrar variações
    const existingProducts = getModelProducts(model.id);
    const existingVariations = getVariationsSummary(model.id);
    
    // Preencher com variações existentes + campo vazio para adicionar novas
    const variationsList = existingVariations.map(v => ({
      color: v.color,
      size: v.size,
      quantity: v.quantity.toString(),
      existing: true // Marca como existente
    }));
    
    // Adicionar campo vazio para novas variações
    setVariations([...variationsList, { color: "", size: "", quantity: "", existing: false }]);
    setShowModal(true);
  };

  const handleDeleteModel = async (model) => {
    if (!confirm(`Excluir modelo '${model.name}'? Esta ação também removerá produtos relacionados.`)) return;
    
    // Verificar se user está definido
    if (!user) {
      console.error('[handleDeleteModel] Usuário não definido');
      alert('Erro: Usuário não encontrado. Faça login novamente.');
      return;
    }
    
    try {
      setIsSyncing(true);
      setSyncStatus({ type: null, message: null });
      
      console.log(`[handleDeleteModel] Iniciando exclusão do modelo: ${model.name} (${model.id})`);
      console.log(`[handleDeleteModel] Usuário:`, user);
      
      // Chamar função de exclusão
      const result = await db.productModels.delete(model.id, user);
      
      console.log(`[handleDeleteModel] Exclusão concluída, resultado:`, result);
      
      setSyncStatus({ type: 'success', message: `Modelo '${model.name}' excluído com sucesso!` });
      setTimeout(() => setSyncStatus({ type: null, message: null }), 3000);
      
      // Recarregar modelos
    refreshModels();
      
      // Sincronizar produtos após exclusão
      try {
        await db.syncProducts();
        console.log('[handleDeleteModel] Produtos sincronizados após exclusão');
      } catch (syncError) {
        console.warn('[handleDeleteModel] Erro ao sincronizar produtos após exclusão:', syncError);
      }
    } catch (error) {
      console.error('[handleDeleteModel] Erro ao excluir modelo:', error);
      console.error('[handleDeleteModel] Stack trace:', error.stack);
      const errorMessage = error.message || 'Erro ao excluir modelo. Tente novamente.';
      setSyncStatus({ type: 'error', message: errorMessage });
      setTimeout(() => setSyncStatus({ type: null, message: null }), 5000);
      alert(`Erro ao excluir modelo: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemoveVariation = (index) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handleVariationChange = (index, field, value) => {
    const newVariations = [...variations];
    newVariations[index][field] = value;
    
    // Se alterar cor ou tamanho, regenerar SKU automaticamente
    if ((field === 'color' || field === 'size') && modelName) {
      // Gerar código modelo (primeiras letras maiúsculas)
      const modelCode = modelName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
      const colorCode = (newVariations[index].color || '').slice(0, 2).toUpperCase();
      const sizeCode = (newVariations[index].size || '').toUpperCase();
      if (colorCode && sizeCode) {
        newVariations[index].sku = `${modelCode}-${colorCode}-${sizeCode}`;
      }
    }
    
    // Se alterar cor ou tamanho de uma variação existente, trata como nova variação
    if (newVariations[index].existing && (field === 'color' || field === 'size')) {
      newVariations[index].existing = false;
    }
    
    setVariations(newVariations);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("A imagem deve ter no máximo 5MB");
        return;
      }
      setModelImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setModelName("");
    setCostPrice("");
    setSalePrice("");
    setTaxPercentage("");
    setNcm("");
    setModelImage(null);
    setImagePreview(null);
    setVariations([{ color: "", size: "", quantity: "" }]);
    setSelectedModel(null);
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar variações: deve ter cor, tamanho e quantidade (pode ser string ou número)
    const validVariations = variations.filter(v => {
      const hasColor = v.color && v.color.trim() !== "";
      const hasSize = v.size && v.size.trim() !== "";
      const hasQuantity = v.quantity !== "" && v.quantity !== null && v.quantity !== undefined;
      const quantityNum = parseInt(v.quantity) || 0;
      return hasColor && hasSize && hasQuantity && quantityNum >= 0;
    });
    
    if (!modelName || !costPrice || !salePrice) {
      alert("Preencha os campos de nome e preços!");
      return;
    }

    // Validar se há pelo menos uma variação válida
    if (validVariations.length === 0) {
      alert("Adicione pelo menos uma variação válida (cor, tamanho e quantidade)!");
      return;
    }

    // Converter imagem para base64 se houver
    if (modelImage) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageBase64 = reader.result;
        saveModel(imageBase64);
      };
      reader.readAsDataURL(modelImage);
    } else {
      await saveModel(null);
    }
  };

  const saveModel = async (imageData) => {
    if (selectedModel) {
      // Atualizar modelo existente e adicionar novas variações
      const validVariations = variations.filter(v => v.color && v.size && v.quantity !== "");
      
      // Identificar e remover variações excluídas
      const currentDbProducts = getModelProducts(selectedModel.id);
      const variationsToRemove = currentDbProducts.filter(p => {
        return !validVariations.some(v => v.color === p.color && v.size === p.size);
      });

      // Excluir produtos removidos
      for (const p of variationsToRemove) {
        try {
          await db.products.delete(p.id, user);
        } catch (error) {
          console.error(`[saveModel] Erro ao deletar produto ${p.id}:`, error);
          // Continuar mesmo se falhar
        }
      }

      // Separar variações existentes (para atualizar estoque) e novas (para criar produtos)
      const existingVariations = validVariations.filter(v => v.existing);
      const newVariations = validVariations.filter(v => !v.existing);
      
      // Para variações existentes, atualizar para o valor absoluto informado
      // Exemplo: Se tinha 10 peças e o usuário digita 40, o estoque será atualizado para 40 (não 10+40=50)
      const existingProducts = getModelProducts(selectedModel.id);
      const updateVariations = existingVariations.map(v => {
        const newQuantity = parseInt(v.quantity) || 0;
        
        return {
          color: v.color,
          size: v.size,
          quantity: newQuantity // Valor absoluto: o estoque será definido para este valor
        };
      });
      
      try {
        setIsSyncing(true);
        setSyncStatus({ type: null, message: null });
        
        await db.productModels.update(selectedModel.id, {
        name: modelName,
        costPrice: parseFloat(costPrice),
        salePrice: parseFloat(salePrice),
        taxPercentage: taxPercentage ? parseFloat(taxPercentage) : 0,
          ncm: ncm || null,
        image: imageData || selectedModel.image || null,
        newVariations: newVariations.map(v => ({
          color: v.color,
          size: v.size,
          quantity: parseInt(v.quantity) || 0
        })),
        updateExistingVariations: updateVariations
      }, user);
      
      const message = newVariations.length > 0 
        ? `Modelo atualizado! ${newVariations.length} nova(s) variação(ões) adicionada(s).`
        : "Modelo atualizado com sucesso!";
        
        setSyncStatus({ type: 'success', message });
        setTimeout(() => setSyncStatus({ type: null, message: null }), 3000);
      alert(message);
      } catch (error) {
        console.error('[saveModel] Erro ao atualizar modelo:', error);
        const errorMessage = error.message || 'Erro ao atualizar modelo. Tente novamente.';
        setSyncStatus({ type: 'error', message: errorMessage });
        setTimeout(() => setSyncStatus({ type: null, message: null }), 5000);
        alert(`Erro ao atualizar modelo: ${errorMessage}`);
        setIsSyncing(false);
        return;
      } finally {
        setIsSyncing(false);
      }
    } else {
      try {
        setIsSyncing(true);
        setSyncStatus({ type: null, message: null });
        
        await db.productModels.create({
        name: modelName,
        costPrice: parseFloat(costPrice),
        salePrice: parseFloat(salePrice),
        taxPercentage: taxPercentage ? parseFloat(taxPercentage) : 0,
          ncm: ncm || null,
        image: imageData,
        variations: variations.filter(v => v.color && v.size && v.quantity > 0).map(v => ({
          color: v.color,
          size: v.size,
          sku: v.sku || '', // Incluir SKU gerado
          quantity: parseInt(v.quantity)
        }))
      }, user);
        
        setSyncStatus({ type: 'success', message: 'Modelo cadastrado com sucesso!' });
        setTimeout(() => setSyncStatus({ type: null, message: null }), 3000);
      alert("Modelo cadastrado com sucesso!");
      } catch (error) {
        console.error('[saveModel] Erro ao criar modelo:', error);
        const errorMessage = error.message || 'Erro ao cadastrar modelo. Verifique sua conexão com o Supabase.';
        setSyncStatus({ type: 'error', message: errorMessage });
        setTimeout(() => setSyncStatus({ type: null, message: null }), 5000);
        alert(`Erro ao cadastrar modelo: ${errorMessage}`);
        setIsSyncing(false);
        return;
      } finally {
        setIsSyncing(false);
      }
    }

    resetForm();
    refreshModels();
  };

  const getModelProducts = (modelId) => {
    const allProducts = db.products.list();
    const model = models.find(m => m.id === modelId);
    if (!model) return [];
    
    // Buscar produtos por modelId OU modelName
    return allProducts.filter(p => 
      p.modelId === modelId || 
      p.modelName === model.name ||
      (p.modelName && model.name && p.modelName.toLowerCase() === model.name.toLowerCase())
    );
  };

  const getModelStock = (modelId) => {
    const products = getModelProducts(modelId);
    // PRIORIZAR campo stock (coluna principal do Supabase)
    return products.reduce((sum, p) => {
      const stock = p.stock !== undefined && p.stock !== null ? p.stock : (p.stock_quantity || 0);
      return sum + stock;
    }, 0);
  };

  const getVariationsSummary = (modelId) => {
    const products = getModelProducts(modelId);
    const summary = {};
    products.forEach(p => {
      const key = `${p.color}-${p.size}`;
      if (!summary[key]) {
        summary[key] = { color: p.color, size: p.size, quantity: 0 };
      }
      // PRIORIZAR campo stock (coluna principal do Supabase)
      const stock = p.stock !== undefined && p.stock !== null ? p.stock : (p.stock_quantity || 0);
      summary[key].quantity += stock;
    });
    return Object.values(summary);
  };

  const filteredModels = models.filter(m => {
    const q = (searchTerm || '').toLowerCase().trim();
    if (!q) return true;
    if (m.name?.toLowerCase().includes(q)) return true;
    if (m.code?.toLowerCase().includes(q)) return true;
    const prods = db.products.listByModel(m.id);
    return prods.some(p => (
      (p.code || '').toLowerCase().includes(q) ||
      (p.color || '').toLowerCase().includes(q) ||
      (p.size || '').toLowerCase().includes(q)
    ));
  });

  return (
    <div className="space-y-6">
      {/* Indicador de Sincronização */}
      {(isSyncing || syncStatus.type) && (
        <div className={`rounded-lg p-3 flex items-center gap-2 ${
          isSyncing 
            ? 'bg-blue-50 border border-blue-200' 
            : syncStatus.type === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {isSyncing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700">Sincronizando com Supabase...</span>
            </>
          ) : syncStatus.type === 'success' ? (
            <>
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm text-green-700">{syncStatus.message}</span>
            </>
          ) : (
            <>
              <XCircle size={16} className="text-red-600" />
              <span className="text-sm text-red-700">{syncStatus.message}</span>
            </>
          )}
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold">Gestão de Produtos</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <Input placeholder="Buscar por nome, código, cor, tamanho..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full md:w-80" />
          
          {/* Botões de Exportar/Importar Estoque com Dropdown */}
          <div className="flex gap-2 relative">
            {/* Botão Exportar */}
            <div className="relative" ref={exportMenuRef}>
              <Button 
                variant="outline" 
                className="rounded-full"
                onClick={() => {
                  setShowExportMenu(!showExportMenu);
                  setShowImportMenu(false);
                }}
                disabled={isExporting || isImporting}
                title="Exportar estoque"
              >
                <Download size={18} className="mr-2"/> Exportar
                <ChevronDown size={16} className="ml-2" />
              </Button>
              
              {/* Menu Dropdown Exportar */}
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                  <button
                    className="w-full px-4 py-3 text-left hover:bg-[#d9b53f]/10 flex items-center gap-2 transition-colors"
                    onClick={() => {
                      handleExportCSV();
                      setShowExportMenu(false);
                    }}
                    disabled={isExporting || isImporting}
                  >
                    <FileText size={18} className="text-[#d9b53f]" />
                    <span>Exportar CSV</span>
                  </button>
                  <button
                    className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center gap-2 transition-colors border-t border-gray-100"
                    onClick={() => {
                      handleExportExcel();
                      setShowExportMenu(false);
                    }}
                    disabled={isExporting || isImporting}
                  >
                    <FileSpreadsheet size={18} className="text-green-600" />
                    <span>Exportar Excel</span>
                  </button>
                </div>
              )}
            </div>

            {/* Botão Importar */}
            <div className="relative" ref={importMenuRef}>
              <Button 
                variant="outline" 
                className="rounded-full"
                onClick={() => {
                  setShowImportMenu(!showImportMenu);
                  setShowExportMenu(false);
                }}
                disabled={isExporting || isImporting}
                title="Importar estoque"
              >
                <Upload size={18} className="mr-2"/> Importar
                <ChevronDown size={16} className="ml-2" />
              </Button>
              
              {/* Menu Dropdown Importar */}
              {showImportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                  <button
                    className="w-full px-4 py-3 text-left hover:bg-[#d9b53f]/10 flex items-center gap-2 transition-colors"
                    onClick={() => {
                      handleImportCSV();
                      setShowImportMenu(false);
                    }}
                    disabled={isExporting || isImporting}
                  >
                    <FileText size={18} className="text-[#d9b53f]" />
                    <span>Importar CSV</span>
                  </button>
                  <button
                    className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center gap-2 transition-colors border-t border-gray-100"
                    onClick={() => {
                      handleImportExcel();
                      setShowImportMenu(false);
                    }}
                    disabled={isExporting || isImporting}
                  >
                    <FileSpreadsheet size={18} className="text-green-600" />
                    <span>Importar Excel</span>
                  </button>
                  <button
                    className="w-full px-4 py-3 text-left hover:bg-[#d9b53f]/10 flex items-center gap-2 transition-colors border-t border-gray-100"
                    onClick={() => {
                      handleDownloadTemplate();
                      setShowImportMenu(false);
                    }}
                    disabled={isExporting || isImporting}
                  >
                    <Download size={18} className="text-[#d9b53f]" />
                    <span>Baixar Template</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <Button 
            variant="primary" 
            className="rounded-full"
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} className="mr-2"/> Novo Modelo
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredModels.length === 0 ? (
          <Card className="p-8 rounded-xl text-center">
            <p className="text-gray-500 mb-4">Nenhum modelo encontrado.</p>
            <p className="text-sm text-gray-400 mb-4">
              Os produtos do Supabase precisam estar associados a modelos para aparecer aqui.
            </p>
            <p className="text-xs text-gray-400">
              Total de produtos sincronizados: {db.products.list().length}
            </p>
          </Card>
        ) : (
          filteredModels.map(model => {
          const stock = getModelStock(model.id);
          const variationsSummary = getVariationsSummary(model.id);
          
          return (
            <Card key={model.id} className="p-4 rounded-xl">
              <div className="flex gap-4 mb-4">
                {model.image && (
                  <div className="flex-shrink-0">
                    <img 
                      src={model.image} 
                      alt={model.name}
                      className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                  </div>
                )}
                <div className="flex-1 flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{model.name}</h3>
                    <p className="text-sm text-gray-500">Código: {model.code}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <p className="text-sm text-gray-500">Estoque Total</p>
                      <p className="text-xl font-bold text-green-600">{stock}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="rounded-full text-sm" 
                        onClick={() => {
                          setSelectedModelForPrint(model);
                          const products = getModelProducts(model.id);
                            setSelectedProducts(products.map(p => ({ 
                              ...p, 
                              selected: true,
                              printQuantity: 1 // Inicializar quantidade com 1
                            })));
                          setShowPrintModal(true);
                        }}
                      >
                        <Printer size={14} className="mr-1"/> Imprimir
                      </Button>
                      <Button variant="outline" className="rounded-full text-sm" onClick={() => handleEditModel(model)}>Editar</Button>
                      <Button variant="danger" className="rounded-full text-sm" onClick={() => handleDeleteModel(model)}>Excluir</Button>
                    </div>
                  </div>
                </div>
              </div>
              
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Preço de Custo</p>
                  <p className="text-lg font-bold">{formatCurrency(model.costPrice || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Preço de Venda</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(model.salePrice || 0)}</p>
                </div>
                {model.taxPercentage && parseFloat(model.taxPercentage) > 0 && (
                  <div>
                    <p className="text-sm text-gray-500">Imposto</p>
                    <p className="text-lg font-bold text-orange-600">{model.taxPercentage}%</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency((model.salePrice || 0) * (parseFloat(model.taxPercentage) || 0) / 100)}
                    </p>
                  </div>
                )}
              </div>
                
                {model.ncm && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500">Código NCM</p>
                    <p className="text-lg font-bold text-blue-600">{model.ncm}</p>
                  </div>
                )}

              <div className="border-t pt-4">
                <p className="text-sm font-bold mb-2">Variações (Cor/Tamanho):</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {variationsSummary.map((v, idx) => (
                    <div key={idx} className="bg-slate-50 p-2 rounded-lg text-sm">
                      <p className="font-medium">{v.color} - {v.size}</p>
                      <p className="text-xs text-gray-500">Qtd: {v.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
          })
        )}
      </div>

      {/* Modal de Cadastro */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" 
          onClick={(e) => {
            // Só fecha se clicar diretamente no backdrop, não nos filhos
            if (e.target === e.currentTarget) {
              resetForm();
            }
          }}
        >
          <Card className="w-full max-w-2xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedModel ? "Editar Modelo" : "Cadastrar Novo Modelo"}</h2>
              <button 
                onClick={() => resetForm()}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <label className="block text-sm font-medium mb-1">Nome do Modelo *</label>
                <Input 
                  placeholder="Ex: Camiseta Básica" 
                  value={modelName} 
                  onChange={e => setModelName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  required
                  className="w-full rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Um código será gerado automaticamente</p>
              </div>

              {/* Upload de Imagem */}
              <div>
                <label className="block text-sm font-medium mb-1">Imagem do Modelo</label>
                <div className="flex flex-col items-center space-y-3">
                  {imagePreview ? (
                    <div className="relative">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setModelImage(null);
                          setImagePreview(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                      <p className="text-xs text-gray-400 text-center px-2">Sem imagem</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }}
                  >
                    <Camera size={16} className="mr-2"/> {imagePreview ? 'Alterar Imagem' : 'Adicionar Imagem'}
                  </Button>
                  <p className="text-xs text-gray-500">Formatos: JPG, PNG, GIF (máx. 5MB)</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Preço de Custo (R$) *</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={costPrice} 
                    onChange={e => setCostPrice(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    required
                    className="w-full rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Preço de Venda (R$) *</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={salePrice} 
                    onChange={e => setSalePrice(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    required
                    className="w-full rounded-lg"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Imposto (%)</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    max="100"
                    placeholder="0.00" 
                    value={taxPercentage} 
                    onChange={e => setTaxPercentage(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className="w-full rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">% sobre o preço de venda</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Código NCM</label>
                  <Input 
                    type="text"
                    placeholder="Ex: 6109.10.00" 
                    value={ncm} 
                    onChange={e => setNcm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className="w-full rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Código NCM do produto</p>
                </div>
              </div>

              {/* Cálculo de Lucro */}
              {costPrice && salePrice && (
                <div className="bg-[#d9b53f]/10 border border-[#d9b53f]/30 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-blue-700 mb-2">Cálculo de Lucro</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Preço de Venda:</span>
                      <span className="font-medium">{formatCurrency(parseFloat(salePrice) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">(-) Custo do Produto:</span>
                      <span className="font-medium text-red-600">-{formatCurrency(parseFloat(costPrice) || 0)}</span>
                    </div>
                    {taxPercentage && parseFloat(taxPercentage) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">(-) Imposto ({taxPercentage}%):</span>
                        <span className="font-medium text-red-600">
                          -{formatCurrency((parseFloat(salePrice) || 0) * (parseFloat(taxPercentage) || 0) / 100)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-[#d9b53f]/30 pt-1 mt-1 flex justify-between">
                      <span className="font-bold text-blue-700">Lucro Líquido:</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(
                          (parseFloat(salePrice) || 0) - 
                          (parseFloat(costPrice) || 0) - 
                          ((parseFloat(salePrice) || 0) * (parseFloat(taxPercentage) || 0) / 100)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <label className="block text-sm font-medium">Variações (Cor/Tamanho/Quantidade) *</label>
                    {selectedModel && (
                      <p className="text-xs text-gray-500 mt-1">
                        Variações existentes aparecem destacadas. Adicione novas variações abaixo.
                      </p>
                    )}
                  </div>
                  <Button 
                    type="button"
                    variant="outline" 
                    className="rounded-full text-xs"
                    onClick={handleAddVariation}
                  >
                    <Plus size={14} className="mr-1"/> Adicionar
                  </Button>
                </div>

                <div className="space-y-3">
                  {variations.map((variation, index) => (
                    <div 
                      key={index} 
                      className={`grid grid-cols-12 gap-2 items-end p-3 rounded-lg ${
                        variation.existing 
                          ? 'bg-[#d9b53f]/10 border-2 border-[#d9b53f]/30' 
                          : 'bg-slate-50'
                      }`}
                    >
                      {variation.existing && (
                        <div className="col-span-12 mb-1">
                          <span className="text-xs font-medium text-[#d9b53f] bg-[#d9b53f]/20 px-2 py-1 rounded-full">
                            Variação Existente
                          </span>
                        </div>
                      )}
                      <div className="col-span-4">
                        <label className="block text-xs font-medium mb-1">Cor</label>
                        <Input
                          type="text"
                          list={`colors-list-${index}`}
                          value={variation.color}
                          onChange={e => handleVariationChange(index, 'color', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          placeholder="Digite ou selecione"
                          className="w-full rounded-lg text-sm"
                        />
                        <datalist id={`colors-list-${index}`}>
                          {colors.map(c => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-xs font-medium mb-1">Tamanho</label>
                        <Input
                          type="text"
                          list={`sizes-list-${index}`}
                          value={variation.size}
                          onChange={e => handleVariationChange(index, 'size', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          placeholder="Digite ou selecione"
                          className="w-full rounded-lg text-sm"
                        />
                        <datalist id={`sizes-list-${index}`}>
                          {sizes.map(s => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium mb-1">SKU</label>
                        <Input
                          type="text"
                          placeholder="Auto"
                          value={variation.sku || ''}
                          disabled={true}
                          title="SKU gerado automaticamente"
                          className="w-full rounded-lg text-sm bg-gray-50"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium mb-1">
                          {variation.existing ? "Quantidade (Atualizar)" : "Quantidade"}
                        </label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={variation.quantity}
                          onChange={e => handleVariationChange(index, 'quantity', e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          className="w-full rounded-lg text-sm"
                        />
                      </div>
                      <div className="col-span-2 flex items-end">
                        <Button
                          type="button"
                          variant="danger"
                          className="rounded-full w-full"
                          onClick={() => handleRemoveVariation(index)}
                        >
                          <Trash2 size={14}/>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button"
                  variant="outline" 
                  className="flex-1 rounded-full" 
                  onClick={() => resetForm()}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  variant="primary" 
                  className="flex-1 rounded-full"
                >
                  {selectedModel ? "Atualizar" : "Cadastrar Modelo"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal de Impressão de Código de Barras */}
      {showPrintModal && selectedModelForPrint && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrintModal(false);
            }
          }}
        >
          <Card className="w-full max-w-3xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Imprimir Códigos de Barras - {selectedModelForPrint.name}</h2>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">Selecione os produtos para imprimir:</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={() => setSelectedProducts(selectedProducts.map(p => ({ ...p, selected: true })))}
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full text-xs"
                    onClick={() => setSelectedProducts(selectedProducts.map(p => ({ ...p, selected: false })))}
                  >
                    Desmarcar Todos
                  </Button>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-2 border rounded-lg p-3">
                {selectedProducts.map((product, index) => {
                  const stock = product.stock !== undefined && product.stock !== null ? product.stock : (product.stock_quantity || 0);
                  const maxQuantity = Math.max(0, stock);
                  
                  return (
                  <div 
                    key={product.id || index}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                        product.selected ? 'bg-[#d9b53f]/10 border-[#d9b53f]' : 'hover:bg-slate-50 border-transparent'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={product.selected || false}
                      onChange={() => {
                        const updated = [...selectedProducts];
                        updated[index].selected = !updated[index].selected;
                          if (updated[index].selected) {
                            // Inicializar quantidade com 1 quando selecionar
                            const stock = updated[index].stock !== undefined && updated[index].stock !== null 
                              ? updated[index].stock 
                              : (updated[index].stock_quantity || 0);
                            updated[index].printQuantity = Math.min(1, Math.max(0, stock));
                          } else {
                            updated[index].printQuantity = 1; // Resetar quantidade ao desmarcar
                          }
                        setSelectedProducts(updated);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {product.modelName || product.name} - {product.color} - {product.size}
                      </p>
                        <p className="text-xs text-gray-500">
                          Código: {product.code} | Preço: {formatCurrency(product.salePrice || product.sale_price || 0)} | Estoque: {maxQuantity} unid.
                        </p>
                    </div>
                      {product.selected && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-gray-600">Qtd:</label>
                          <Input
                            type="number"
                            min="1"
                            max={maxQuantity}
                            value={product.printQuantity || 1}
                            onChange={(e) => {
                              const updated = [...selectedProducts];
                              const qty = Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1));
                              updated[index].printQuantity = qty;
                              setSelectedProducts(updated);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.stopPropagation()}
                            className="w-20 rounded-lg text-sm text-center"
                          />
                          <span className="text-xs text-gray-500">/ {maxQuantity}</span>
                  </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="flex-1 rounded-full" 
                onClick={() => setShowPrintModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 rounded-full" 
                onClick={() => {
                  const productsToPrint = selectedProducts.filter(p => p.selected);
                  if (productsToPrint.length === 0) {
                    alert("Selecione pelo menos um produto para imprimir!");
                    return;
                  }
                  
                  // Preparar produtos com quantidade
                  const productsWithQuantity = productsToPrint.map(p => ({
                    product: p,
                    quantity: p.printQuantity || 1
                  }));
                  
                  // Calcular total de etiquetas
                  const totalLabels = productsWithQuantity.reduce((sum, item) => sum + item.quantity, 0);
                  
                  // Usar caminho relativo para a logo
                  const logoPath = './imag/logo-LB-PRT.png';
                  printBarcodeLabels(productsWithQuantity, logoPath);
                  setShowPrintModal(false);
                }}
              >
                <Printer size={18} className="mr-2"/> Imprimir {selectedProducts.filter(p => p.selected).reduce((sum, p) => sum + (p.printQuantity || 1), 0)} Etiqueta(s)
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Outras páginas simplificadas
// Componente de Gráfico de Pizza Simples
function PieChartComponent({ data, size = 200 }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -90; // Começa no topo
  
  const segments = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    
    const x1 = 100 + 100 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 100 + 100 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 100 + 100 * Math.cos((endAngle * Math.PI) / 180);
    const y2 = 100 + 100 * Math.sin((endAngle * Math.PI) / 180);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const path = `M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    currentAngle += angle;
    
    return (
      <path
        key={index}
        d={path}
        fill={item.color}
        stroke="white"
        strokeWidth="2"
      />
    );
  });
  
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 200 200">
        {segments}
      </svg>
      <div className="mt-4 space-y-2 w-full">
        {data.map((item, index) => {
          const percentage = ((item.value / total) * 100).toFixed(1);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }}></div>
              <span className="flex-1">{item.label}</span>
              <span className="font-bold">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Componente de Gráfico de Barras Simples
function BarChartComponent({ data, height = 200, showCurrency = false }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="flex items-end justify-around gap-2" style={{ height: `${height}px` }}>
      {data.map((item, index) => {
        const barHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div key={index} className="flex flex-col items-center justify-end flex-1 h-full">
            <div className="w-full flex flex-col items-center justify-end h-full relative group">
              <div
                className="w-full bg-gradient-to-t from-blue-600 to-blue-500 rounded-t transition-all hover:from-blue-700 hover:to-blue-600 cursor-pointer"
                style={{ height: `${barHeight}%`, minHeight: barHeight > 0 ? '4px' : '0' }}
                title={`${item.label}: ${showCurrency ? formatCurrency(item.value) : item.value}`}
              ></div>
              {barHeight > 10 && (
                <span className="absolute -top-6 text-xs font-semibold text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  {showCurrency ? formatCurrency(item.value) : item.value}
                </span>
              )}
            </div>
            <span className="text-xs mt-2 text-center font-medium text-gray-700">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Dashboard({ user }) {
  const location = useLocation();
  const [tab, setTab] = useState("overview");
  // Dashboard metrics from cash_closures (current month)
  const {
    formatted: closureFormatted,
    raw: closureRaw,
    loading: closureLoading,
    error: closureError,
    refresh: refreshClosure,
  } = useClosureMetrics();
  const [expenses, setExpenses] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "",
    description: "",
    amount: ""
  });
  const [closures, setClosures] = useState([]);
  const [selectedClosure, setSelectedClosure] = useState(null);
  const [showClosureViewModal, setShowClosureViewModal] = useState(false);

  // Verificar se há parâmetro de tab na URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'closures') {
      setTab('closures');
    }
  }, [location]);

  useEffect(() => {
    try {
      refreshData();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      setExpenses([]);
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      // Buscar despesas do SBD primeiro, com fallback ou merge com localStorage quando vazio
      try {
        const { supabaseDB } = await import('./services/supabaseDB.js');
        const sbdExpenses = await supabaseDB.expenses.list();
        const localExpenses = db.expenses.list() || [];
        if (Array.isArray(sbdExpenses) && sbdExpenses.length > 0) {
          setExpenses(sbdExpenses);
        } else if (localExpenses.length > 0) {
          setExpenses(localExpenses);
        } else {
          setExpenses([]);
        }
      } catch (error) {
        console.error('[Dashboard] Erro ao carregar despesas do SBD, usando localStorage:', error);
        const localExpenses = db.expenses.list() || [];
        setExpenses(localExpenses);
      }
      
      // Buscar fechamentos do SBD primeiro, fallback para localStorage
      try {
        const { supabaseDB } = await import('./services/supabaseDB.js');
        const sbdClosures = await supabaseDB.closures.list();
        if (sbdClosures && sbdClosures.length >= 0) {
          // Tentar resolver nomes dos autores via tabela de usuários do SBD
          try {
            const sbdUsers = await supabaseDB.users.list();
            const usersMap = new Map((sbdUsers || []).map(u => [u.id, (u.name || u.full_name || u.display_name || u.email)]));
            const mapped = (sbdClosures || []).map(c => ({
              ...c,
              // resolver nome do autor quando possível
              created_by_name: usersMap.get(c.created_by) || c.created_by,
              // normalizar campos snake_case -> camelCase para a UI
              openingAmount: c.opening_amount ?? c.openingAmount ?? (c.totals && c.totals.openingAmount) ?? 0,
              totalSales: c.total_sales ?? c.totalSales ?? (c.totals && (c.totals.totalSales || c.totals.total_sales)) ?? 0,
              totalCosts: c.total_costs ?? c.totalCosts ?? (c.totals && (c.totals.totalCosts || c.totals.total_costs)) ?? 0,
              totalExpenses: c.total_expenses ?? c.totalExpenses ?? (c.totals && (c.totals.totalExpenses || c.totals.total_expenses)) ?? 0,
              grossProfit: c.gross_profit ?? c.grossProfit ?? (c.totals && (c.totals.grossProfit || c.totals.gross_profit)) ?? 0,
              finalCashAmount: c.final_cash_amount ?? c.finalCashAmount ?? (c.totals && (c.totals.finalCashAmount || c.totals.final_cash_amount)) ?? 0,
              paymentMethods: c.payment_methods ?? c.paymentMethods ?? (c.totals && c.totals.paymentMethods) ?? {},
              totalDiscounts: c.total_discounts ?? c.totalDiscounts ?? (c.totals && (c.totals.totalDiscounts || c.totals.total_discounts)) ?? 0,
              // Arrays de vendas, cancelamentos e despesas (NOVOS)
              sales: Array.isArray(c.sales) ? c.sales : (c.sales || []),
              cancelled: Array.isArray(c.cancelled) ? c.cancelled : (c.cancelled || []),
              expenses: Array.isArray(c.expenses) ? c.expenses : (c.expenses || []),
              // Contadores (NOVOS)
              salesCount: c.sales_count ?? c.salesCount ?? 0,
              cancelledCount: c.cancelled_count ?? c.cancelledCount ?? 0,
              expensesCount: c.expenses_count ?? c.expensesCount ?? 0,
            }));
            setClosures(mapped.sort((a, b) => new Date(b.date) - new Date(a.date)));
          } catch (e) {
            // Se falhar ao buscar usuários, usar os dados originais
            console.warn('[Dashboard] Não foi possível resolver nomes dos autores dos fechamentos SBD:', e);
            setClosures(sbdClosures.sort((a, b) => new Date(b.date) - new Date(a.date)));
          }
        } else {
          const localClosures = db.closures.list() || [];
          setClosures(localClosures.sort((a, b) => new Date(b.date) - new Date(a.date)) || []);
        }
      } catch (error) {
        console.error('[Dashboard] Erro ao carregar fechamentos do SBD, usando localStorage:', error);
        const localClosures = db.closures.list() || [];
        setClosures(localClosures.sort((a, b) => new Date(b.date) - new Date(a.date)) || []);
      }
    } catch (error) {
      console.error('[Dashboard] Erro ao atualizar dados:', error);
      setExpenses([]);
      setClosures([]);
    }
  }, []);

  // Cálculos de métricas com memoização
  const [sales, setSales] = useState([]);
  
  // Buscar vendas do SBD primeiro, fallback para localStorage
  useEffect(() => {
    const loadSales = async () => {
      try {
        const { supabaseDB } = await import('./services/supabaseDB.js');
        const sbdSales = await supabaseDB.sales.listFinalized();
        // Se retornou array (mesmo vazio), preferir SBD como fonte da verdade
        if (Array.isArray(sbdSales)) {
          setSales(sbdSales);
          return;
        }
        // Fallback para localStorage
        const localSales = db.sales.listFinalized() || [];
        setSales(localSales);
    } catch (error) {
        console.error('[Dashboard] Erro ao carregar vendas do SBD, usando localStorage:', error);
        // Fallback para localStorage
        const localSales = db.sales.listFinalized() || [];
        setSales(localSales);
    }
    };
    loadSales();
  }, [expenses]);
  
  const currentDate = useMemo(() => new Date(), []);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Receitas do mês atual (memoizado)
  const monthlyRevenue = useMemo(() => {
    return sales
      .filter(sale => {
        const saleDate = new Date(sale.sale_date || sale.created_at);
        return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
      })
      .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
  }, [sales, currentMonth, currentYear]);

  // Custos dos produtos vendidos no mês atual (memoizado)
  const monthlyCosts = useMemo(() => {
    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
    });

    // Preferir campo `total_cost` vindo da venda, se existir; caso contrário calcular por item
    const productsList = db.products.list();
    let costs = 0;
    monthSales.forEach(sale => {
      if (sale.total_cost !== undefined && sale.total_cost !== null) {
        costs += Number(sale.total_cost) || 0;
        return;
      }
      // fallback: calcular custo a partir dos itens e preço de custo do produto
      sale.items?.forEach(item => {
        const product = productsList.find(p => p.id === item.product_id || p.code === item.code || p.code === item.sku);
        const itemCost = (item.cost_price !== undefined ? Number(item.cost_price) : (item.costPrice !== undefined ? Number(item.costPrice) : null));
        if (itemCost !== null && !isNaN(itemCost)) {
          costs += itemCost * (Number(item.quantity) || 0);
        } else if (product && (product.costPrice || product.cost_price)) {
          costs += (Number(product.costPrice || product.cost_price) || 0) * (Number(item.quantity) || 0);
        }
      });
    });
    return costs;
  }, [sales, currentMonth, currentYear]);

  // Despesas do mês atual (memoizado)
  const monthlyExpenses = useMemo(() => {
    return expenses
      .filter(exp => {
        if (!exp || !exp.date) return false;
        try {
          const expDate = new Date(exp.date);
          return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
        } catch (e) {
          return false;
        }
      })
      .reduce((sum, exp) => {
        const amount = typeof exp.amount === 'string' ? parseFloat(exp.amount) : (exp.amount || 0);
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
  }, [expenses, currentMonth, currentYear]);

  // Descontos do mês atual (prefere sale.discount_amount)
  const monthlyDiscounts = useMemo(() => {
    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
    });
    return monthSales.reduce((sum, s) => sum + (Number(s.discount_amount ?? s.discount ?? 0) || 0), 0);
  }, [sales, currentMonth, currentYear]);

  // Itens vendidos no mês (prefere sale.items_count)
  const monthlyItemsSold = useMemo(() => {
    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
    });
    return monthSales.reduce((sum, s) => sum + (Number(s.items_count ?? (Array.isArray(s.items) ? s.items.reduce((a, it) => a + (Number(it.quantity)||0), 0) : 0)) || 0), 0);
  }, [sales, currentMonth, currentYear]);

  // Lucro a partir das vendas (prefere sale.profit_amount se disponível)
  const monthlyProfitFromSales = useMemo(() => {
    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
    });
    return monthSales.reduce((sum, s) => {
      if (s.profit_amount !== undefined && s.profit_amount !== null) return sum + (Number(s.profit_amount) || 0);
      // fallback: net - cost (if available)
      const net = Number(s.total_net ?? s.total_amount ?? 0) || 0;
      const cost = Number(s.total_cost || 0) || 0;
      return sum + (net - cost);
    }, 0);
  }, [sales, currentMonth, currentYear]);

  // Lucro líquido (inclui despesas)
  const netProfit = useMemo(() => monthlyProfitFromSales - monthlyExpenses, [monthlyProfitFromSales, monthlyExpenses]);
  // Net profit based on closures revenue/costs minus local expenses state
  const netProfitDash = useMemo(() => {
    const revenue = closureRaw?.revenue || 0;
    const costs = closureRaw?.costs || 0;
    return revenue - costs - monthlyExpenses;
  }, [closureRaw?.revenue, closureRaw?.costs, monthlyExpenses]);

  // Ticket médio
  const averageTicket = useMemo(() => {
    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      return saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear;
    });
    if (monthSales.length === 0) return 0;
    const revenue = monthSales.reduce((sum, s) => sum + (Number(s.total_amount ?? s.total_net ?? 0) || 0), 0);
    return revenue / monthSales.length;
  }, [sales, currentMonth, currentYear]);

  // Totais por método de pagamento (valores) — útil para gestão
  const paymentMethodTotalsByAmount = useMemo(() => {
    const totals = {};
    sales.forEach(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      if (saleDate.getMonth() !== currentMonth || saleDate.getFullYear() !== currentYear) return;
      const method = sale.payment_method || 'unknown';
      totals[method] = (totals[method] || 0) + (Number(sale.total_amount ?? sale.total_net ?? 0) || 0);
    });
    return totals;
  }, [sales, currentMonth, currentYear]);

  // Ranking de produtos mais vendidos (memoizado)
  const topProducts = useMemo(() => {
    const productSales = {};
    sales.forEach(sale => {
      sale.items?.forEach(item => {
        const productId = item.product_id;
        if (!productSales[productId]) {
          productSales[productId] = {
            name: item.name || 'Produto',
            quantity: 0,
            revenue: 0
          };
        }
        productSales[productId].quantity += item.quantity || 0;
        productSales[productId].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });
    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [sales]);

  // ==================== MÉTRICAS BASEADAS EM CLOSURES ====================
  // Ticket médio baseado em closures (receita / número de fechamentos)
  const closuresCurrentMonth = useMemo(() => {
    return closures.filter(c => {
      if (!c.date) return false;
      const cDate = new Date(c.date);
      return cDate.getMonth() === currentMonth && cDate.getFullYear() === currentYear;
    });
  }, [closures, currentMonth, currentYear]);

  const closureTicketAverage = useMemo(() => {
    const monthClosures = closuresCurrentMonth;
    if (monthClosures.length === 0) return 0;
    const totalRevenue = monthClosures.reduce((sum, c) => sum + (c.totalSales || 0), 0);
    return totalRevenue / monthClosures.length;
  }, [closuresCurrentMonth]);

  // Total de vendas (soma do número de vendas de todos os fechamentos do mês)
  const closureTotalSalesCount = useMemo(() => {
    return closuresCurrentMonth.reduce((sum, closure) => {
      return sum + (Array.isArray(closure.sales) ? closure.sales.length : 0);
    }, 0);
  }, [closuresCurrentMonth]);

  // Faturamento por mês (últimos 6 meses baseado em closures)
  const monthlyRevenueByClosures = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthName = format(date, "MMM/yyyy");
      
      const monthRevenue = closures
        .filter(c => {
          if (!c.date) return false;
          const cDate = new Date(c.date);
          return cDate.getMonth() === month && cDate.getFullYear() === year;
        })
        .reduce((sum, c) => sum + (c.totalSales || 0), 0);
      
      data.push({
        label: monthName,
        value: monthRevenue
      });
    }
    return data;
  }, [closures, currentMonth, currentYear]);

  // Método de pagamento mais utilizado (aggregado de todos os closures do mês)
  const paymentMethodDataFromClosures = useMemo(() => {
    const totals = {};
    closuresCurrentMonth.forEach(closure => {
      Object.entries(closure.paymentMethods || {}).forEach(([method, amount]) => {
        totals[method] = (totals[method] || 0) + (Number(amount) || 0);
      });
    });
    
    const keys = Object.keys(totals);
    if (keys.length > 0) {
      return keys.map((method, idx) => ({
        label: formatPaymentMethod(method),
        value: totals[method] || 0,
        color: getColorForIndex(idx)
      }));
    }
    return [];
  }, [closuresCurrentMonth]);

  // Faturamento por dia da semana (baseado em closures)
  const salesByDayOfWeekFromClosures = useMemo(() => {
    const salesByDay = {};
    closuresCurrentMonth.forEach(closure => {
      if (!closure.date) return;
      const cDate = new Date(closure.date);
      const dayOfWeek = cDate.getDay();
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dayName = dayNames[dayOfWeek];
      if (!salesByDay[dayName]) {
        salesByDay[dayName] = 0;
      }
      salesByDay[dayName] += closure.totalSales || 0;
    });
    
    return Object.entries(salesByDay)
      .map(([day, value]) => ({
        label: day,
        value: value
      }))
      .sort((a, b) => {
        const order = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return order.indexOf(a.label) - order.indexOf(b.label);
      });
  }, [closuresCurrentMonth]);

  // Top 5 produtos mais vendidos (aggregado de items dos closures)
  const topProductsFromClosures = useMemo(() => {
    const productSales = {};
    closuresCurrentMonth.forEach(closure => {
      (closure.sales || []).forEach(sale => {
        (sale.items || []).forEach(item => {
          const productId = item.product_id || item.id;
          if (!productSales[productId]) {
            productSales[productId] = {
              name: item.name || item.product_name || 'Produto',
              quantity: 0,
              revenue: 0
            };
          }
          productSales[productId].quantity += Number(item.quantity) || 0;
          productSales[productId].revenue += (Number(item.price) || 0) * (Number(item.quantity) || 0);
        });
      });
    });
    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [closuresCurrentMonth]);

  // Onde está vendendo mais (por loja se existir store_id nos closures)
  const storePerformanceData = useMemo(() => {
    const storeData = {};
    closuresCurrentMonth.forEach(closure => {
      const storeId = closure.store_id || closure.storeName || 'Loja Principal';
      if (!storeData[storeId]) {
        storeData[storeId] = {
          name: storeId,
          revenue: 0,
          count: 0
        };
      }
      storeData[storeId].revenue += closure.totalSales || 0;
      storeData[storeId].count += 1;
    });
    
    return Object.values(storeData)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [closuresCurrentMonth]);

  // Função para formatar método de pagamento (memoizada)
  const formatPaymentMethod = useCallback((method) => {
    const methods = {
      'money': 'Dinheiro',
      'pix_maquina': 'PIX (Máquina)',
      'pix_direto': 'PIX (Direto)',
      'credit': 'Cartão de Crédito',
      'debit': 'Cartão de Débito'
    };
    return methods[method] || method;
  }, []);

  // Função para obter cor por índice (memoizada)
  const getColorForIndex = useCallback((index) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return colors[index % colors.length];
  }, []);

  // Renderizar detalhes do fechamento (para Dashboard)
  const renderClosureDetailsDashboard = (data) => {
    const closureDate = data.date ? format(new Date(data.date), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy");
    
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">Data do Fechamento</p>
          <p className="text-2xl font-bold">{closureDate}</p>
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-xl bg-[#d9b53f]/10">
            <p className="text-xs text-gray-600 mb-1">Abertura do Caixa</p>
            <p className="text-xl font-bold text-[#d9b53f]">{formatCurrency(data.openingAmount || 0)}</p>
          </Card>
          <Card className="p-4 rounded-xl bg-green-50">
            <p className="text-xs text-gray-600 mb-1">Total de Vendas</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data.totalSales || 0)}</p>
          </Card>
          <Card className="p-4 rounded-xl bg-red-50">
            <p className="text-xs text-gray-600 mb-1">Total de Custos</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(data.totalCosts || 0)}</p>
          </Card>
          <Card className="p-4 rounded-xl bg-[#d9b53f]/10">
            <p className="text-xs text-gray-600 mb-1">Lucro Bruto</p>
            <p className={`text-xl font-bold ${(data.grossProfit || 0) >= 0 ? 'text-[#d9b53f]' : 'text-red-600'}`}>
              {formatCurrency(data.grossProfit || 0)}
            </p>
          </Card>
          {data.finalCashAmount !== undefined && (
            <Card className="p-4 rounded-xl bg-purple-50 col-span-2 md:col-span-4 border-2 border-purple-300">
              <p className="text-xs text-gray-600 mb-1">Valor Final no Caixa</p>
              <p className="text-2xl font-bold text-[#d9b53f]">
                {formatCurrency(data.finalCashAmount || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Cálculo: Abertura ({formatCurrency(data.openingAmount || 0)}) + 
                Vendas ({formatCurrency(data.totalSales || 0)}) - 
                Despesas ({formatCurrency(data.totalExpenses || 0)}) = 
                <strong className="text-[#d9b53f]"> {formatCurrency(data.finalCashAmount || 0)}</strong>
              </p>
            </Card>
          )}
        </div>

        {/* Métodos de Pagamento */}
        <div>
          <h3 className="font-bold text-lg mb-3">Métodos de Pagamento</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(data.paymentMethods || {}).map(([method, amount]) => (
              <Card key={method} className="p-3 rounded-xl">
                <p className="text-xs text-gray-600 mb-1">{formatPaymentMethod(method)}</p>
                <p className="text-lg font-bold">{formatCurrency(amount)}</p>
              </Card>
            ))}
            {Object.keys(data.paymentMethods || {}).length === 0 && (
              <p className="text-gray-500 text-sm col-span-full">Nenhuma venda registrada</p>
            )}
          </div>
        </div>

        {/* Caixas */}
        {data.cashiers && data.cashiers.length > 0 && (
          <div>
            <h3 className="font-bold text-lg mb-3">Caixas</h3>
            <div className="space-y-2">
              {data.cashiers.map(cashier => (
                <Card key={cashier.name} className="p-3 rounded-xl">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{cashier.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                        {Object.entries(cashier.methods || {}).map(([method, amount]) => (
                          <span key={method} className="bg-slate-100 px-2 py-1 rounded-full">
                            {formatPaymentMethod(method)}: {formatCurrency(amount)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(cashier.total)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-3 rounded-xl">
            <p className="text-xs text-gray-600 mb-1">Vendas Realizadas</p>
            <p className="text-2xl font-bold">{data.sales?.length || 0}</p>
          </Card>
          <Card className="p-3 rounded-xl">
            <p className="text-xs text-gray-600 mb-1">Vendas Canceladas</p>
            <p className="text-2xl font-bold text-red-600">{data.cancelled?.length || 0}</p>
          </Card>
          <Card className="p-3 rounded-xl">
            <p className="text-xs text-gray-600 mb-1">Descontos Aplicados</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalDiscounts || 0)}</p>
          </Card>
        </div>

        {/* Lista de Vendas */}
        {data.sales && data.sales.length > 0 && (
          <div>
            <h3 className="font-bold text-lg mb-3">Vendas do Dia ({data.sales.length})</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {data.sales.map(sale => (
                <Card key={sale.id} className="p-3 rounded-xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">#{sale.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(sale.sale_date), "HH:mm")} - {formatPaymentMethod(sale.payment_method)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(sale.total_amount)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Cancelamentos */}
        {data.cancelled && data.cancelled.length > 0 && (
          <div>
            <h3 className="font-bold text-lg mb-3 text-red-600">Cancelamentos do Dia ({data.cancelled.length})</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {data.cancelled.map(sale => (
                <Card key={sale.id} className="p-3 rounded-xl bg-red-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">#{sale.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(sale.sale_date), "HH:mm")} - Cancelado
                      </p>
                    </div>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(sale.total_amount)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Exportar fechamento (para Dashboard)
  const exportClosureDashboard = (closure) => {
    const closureDate = closure.date ? format(new Date(closure.date), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy");
    const closureTime = format(new Date(closure.created_at || new Date()), "HH:mm");
    let managerName = closure.created_by || 'Sistema';
    try {
      const usersList = db.users.list() || [];
      const found = usersList.find(u => u.id === closure.created_by || u.email === closure.created_by || u.tenantId === closure.created_by);
      if (found && found.name) managerName = found.name;
    } catch (e) {
      // keep fallback
    }
    
    // CORREÇÃO: Contar fechamentos do mesmo dia para numeração sequencial
    const allClosures = db.closures.list();
    const dayClosures = allClosures.filter(c => {
      const cDate = new Date(c.date);
      const closureDateObj = new Date(closure.date);
      return cDate.toISOString().split('T')[0] === closureDateObj.toISOString().split('T')[0];
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const closureIndex = dayClosures.findIndex(c => c.id === closure.id) + 1;
    const numberSuffix = dayClosures.length > 1 ? ` [${closureIndex}]` : '';
    
    // Nome do arquivo: DD/MM/YYYY [n] - NOME DA GERENTE - HORA DE FECHAMENTO
    const fileName = `${closureDate}${numberSuffix} - ${managerName} - ${closureTime}`;
    
    let content = `FECHAMENTO DE CAIXA - ${closureDate}\n`;
    content += `==========================================\n\n`;
    content += `Data: ${closureDate}\n`;
    content += `Fechado por: ${managerName}\n`;
    content += `Hora do Fechamento: ${closureTime}\n\n`;
    
    content += `RESUMO FINANCEIRO\n`;
    content += `------------------\n`;
    content += `Abertura do Caixa: ${formatCurrency(closure.openingAmount || 0)}\n`;
    content += `Total de Vendas: ${formatCurrency(closure.totalSales || 0)}\n`;
    content += `Total de Custos: ${formatCurrency(closure.totalCosts || 0)}\n`;
    content += `Lucro Bruto: ${formatCurrency(closure.grossProfit || 0)}\n`;
    content += `Descontos Aplicados: ${formatCurrency(closure.totalDiscounts || 0)}\n`;
    content += `\n`;
    content += `VALOR FINAL NO CAIXA\n`;
    content += `---------------------\n`;
    content += `Valor Final: ${formatCurrency(closure.finalCashAmount || 0)}\n`;
    content += `Cálculo: Abertura (${formatCurrency(closure.openingAmount || 0)}) + `;
    content += `Vendas (${formatCurrency(closure.totalSales || 0)}) - `;
    content += `Custos (${formatCurrency(closure.totalCosts || 0)}) = `;
    content += `${formatCurrency(closure.finalCashAmount || 0)}\n`;
    content += `\n`;
    
    content += `MÉTODOS DE PAGAMENTO\n`;
    content += `-------------------\n`;
    Object.entries(closure.paymentMethods || {}).forEach(([method, amount]) => {
      content += `${formatPaymentMethod(method)}: ${formatCurrency(amount)}\n`;
    });
    content += `\n`;
    
    content += `VENDAS REALIZADAS: ${closure.sales?.length || 0}\n`;
    content += `VENDAS CANCELADAS: ${closure.cancelled?.length || 0}\n`;
    content += `\n`;
    
    if (closure.sales && closure.sales.length > 0) {
      content += `LISTA DE VENDAS\n`;
      content += `---------------\n`;
      closure.sales.forEach((sale, idx) => {
        content += `${idx + 1}. #${sale.id.slice(0, 8).toUpperCase()} - ${format(new Date(sale.sale_date), "HH:mm")} - ${formatPaymentMethod(sale.payment_method)} - ${formatCurrency(sale.total_amount)}\n`;
      });
      content += `\n`;
    }
    
    if (closure.cancelled && closure.cancelled.length > 0) {
      content += `LISTA DE CANCELAMENTOS\n`;
      content += `----------------------\n`;
      closure.cancelled.forEach((sale, idx) => {
        content += `${idx + 1}. #${sale.id.slice(0, 8).toUpperCase()} - ${format(new Date(sale.sale_date), "HH:mm")} - ${formatCurrency(sale.total_amount)}\n`;
      });
    }
    
    // Criar e baixar arquivo
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.txt`;
    link.click();
  };

  // Método de pagamento mais utilizado (memoizado)
  const paymentMethodData = useMemo(() => {
    // Priorizar valores (totais por método) para gestão
    const totals = paymentMethodTotalsByAmount || {};
    const keys = Object.keys(totals);
    if (keys.length > 0) {
      return keys.map((method, idx) => ({
        label: formatPaymentMethod(method),
        value: totals[method] || 0,
        color: getColorForIndex(idx)
      }));
    }
    // Fallback para contagem de vendas por método
    const paymentMethods = {};
    sales.forEach(sale => {
      const method = sale.payment_method || 'unknown';
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });
    return Object.entries(paymentMethods)
      .map(([method, count]) => ({
        label: formatPaymentMethod(method),
        value: count,
        color: getColorForIndex(Object.keys(paymentMethods).indexOf(method))
      }));
  }, [sales, paymentMethodTotalsByAmount, formatPaymentMethod, getColorForIndex]);

  // Vendas físicas vs online (memoizado)
  const salesLocationData = useMemo(() => {
    const onlineOrderIds = new Set();
    try {
      const onlineOrders = db.onlineOrders.list() || [];
      onlineOrders.forEach(order => {
        if (order.saleId) {
          onlineOrderIds.add(order.saleId);
        }
      });
    } catch (e) {
      // Erro silencioso - não há pedidos online ainda
    }
    
    const physicalSales = sales.filter(s => !s.online && !onlineOrderIds.has(s.id)).length;
    const onlineSales = sales.filter(s => s.online || onlineOrderIds.has(s.id)).length;
    return [
      { label: 'Físico', value: physicalSales, color: '#3b82f6' },
      { label: 'Online', value: onlineSales, color: '#10b981' }
    ];
  }, [sales]);

  // Gráfico de Faturamento por Mês (últimos 6 meses) (memoizado)
  const monthlyRevenueData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthName = format(date, "MMM/yyyy");
      
      const monthRevenue = sales
        .filter(sale => {
          const saleDate = new Date(sale.sale_date);
          return saleDate.getMonth() === month && saleDate.getFullYear() === year;
        })
        .reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
      
      data.push({
        label: monthName,
        value: monthRevenue
      });
    }
    return data;
  }, [sales, currentMonth, currentYear]);

  // Métricas adicionais (memoizadas)
  const totalSalesCount = useMemo(() => sales.length, [sales]);
  const cancelledSales = useMemo(() => sales.filter(s => s.cancelled).length, [sales]);
  const cancellationRate = useMemo(() => totalSalesCount > 0 ? (cancelledSales / totalSalesCount) * 100 : 0, [totalSalesCount, cancelledSales]);
  
  // Vendas por dia da semana (memoizado)
  const salesByDayData = useMemo(() => {
    const salesByDayOfWeek = {};
    sales.forEach(sale => {
      const saleDate = new Date(sale.sale_date);
      const dayOfWeek = saleDate.getDay();
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dayName = dayNames[dayOfWeek];
      if (!salesByDayOfWeek[dayName]) {
        salesByDayOfWeek[dayName] = 0;
      }
      salesByDayOfWeek[dayName] += sale.total_amount || 0;
    });
    
    return Object.entries(salesByDayOfWeek)
      .map(([day, value]) => ({
        label: day,
        value: value
      }))
      .sort((a, b) => {
        const order = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return order.indexOf(a.label) - order.indexOf(b.label);
      });
  }, [sales]);

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    
    // Validar campos obrigatórios
    if (!expenseForm.date || !expenseForm.category || !expenseForm.description || !expenseForm.amount) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }
    
    // Converter amount para número
    const expenseData = {
      ...expenseForm,
      amount: parseFloat(expenseForm.amount) || 0
    };
    
    if (editingExpense) {
      // Atualizar no SBD primeiro, fallback para localStorage
      try {
        const { supabaseDB } = await import('./services/supabaseDB.js');
        await supabaseDB.expenses.update(editingExpense.id, expenseData, user);
        console.log('[Dashboard] Despesa atualizada no SBD:', editingExpense.id);
      alert("Despesa atualizada!");
      } catch (error) {
        console.error('[Dashboard] Erro ao atualizar despesa no SBD, atualizando localmente:', error);
        db.expenses.update(editingExpense.id, expenseData, user);
        alert("Despesa atualizada (localmente)!");
      }
    } else {
      // Criar no SBD primeiro, fallback para localStorage
      try {
        const { supabaseDB } = await import('./services/supabaseDB.js');
        await supabaseDB.expenses.create(expenseData, user);
        console.log('[Dashboard] Despesa criada no SBD');
      alert("Despesa adicionada!");
      } catch (error) {
        console.error('[Dashboard] Erro ao criar despesa no SBD, criando localmente:', error);
        db.expenses.create(expenseData, user);
        alert("Despesa adicionada (localmente)!");
      }
    }
    // Recarregar dados com prioridade: se falhou SBD e salvou local, lista exibirá local
    await refreshData();
    setShowExpenseModal(false);
    setEditingExpense(null);
    setExpenseForm({
      date: format(new Date(), "yyyy-MM-dd"),
      category: "",
      description: "",
      amount: ""
    });
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: expense.date ? format(new Date(expense.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      category: expense.category || "",
      description: expense.description || "",
      amount: expense.amount?.toString() || ""
    });
    setShowExpenseModal(true);
  };

  const handleDeleteExpense = (id) => {
    if (confirm("Deseja realmente remover esta despesa?")) {
      db.expenses.delete(id, user);
      refreshData();
    }
  };

  const expenseCategories = [
    "Despesas Fixas (Água, Luz, Telefone, Internet)",
    "Aluguel",
    "Salários",
    "Marketing",
    "Manutenção",
    "Impostos",
    "Outros"
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button 
          variant={tab === "overview" ? "primary" : "outline"} 
          onClick={() => setTab("overview")} 
          className="rounded-full"
        >
          <BarChart size={18} className="mr-2"/> Visão Geral
        </Button>
        <Button 
          variant={tab === "expenses" ? "primary" : "outline"} 
          onClick={() => setTab("expenses")} 
          className="rounded-full"
        >
          <DollarSign size={18} className="mr-2"/> Despesas
        </Button>
        <Button 
          variant={tab === "closures" ? "primary" : "outline"} 
          onClick={() => setTab("closures")} 
          className="rounded-full"
        >
          <FileText size={18} className="mr-2"/> Fechamentos ({closures.length})
        </Button>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          {/* Loading state for metrics */}
          {closureLoading && (
            <div className="grid md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-6 rounded-xl animate-pulse">
                  <div className="h-4 w-24 bg-slate-200 rounded mb-4" />
                  <div className="h-8 w-32 bg-slate-200 rounded" />
                </Card>
              ))}
            </div>
          )}
          {/* Cards de Resumo */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-1">Receitas</p>
                  <p className="text-3xl font-bold">{closureFormatted?.revenue}</p>
                  <p className="text-blue-100 text-xs mt-2">Mês atual</p>
                </div>
                <TrendingUp size={48} className="opacity-50" />
              </div>
            </Card>

            <Card className="p-6 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm mb-1">Custos dos Produtos</p>
                  <p className="text-3xl font-bold">{closureFormatted?.costs}</p>
                  <p className="text-purple-100 text-xs mt-2">Mês atual</p>
                </div>
                <Package size={48} className="opacity-50" />
              </div>
            </Card>

            <Card className="p-6 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm mb-1">Despesas Totais</p>
                  <p className="text-3xl font-bold">{formatCurrency(monthlyExpenses)}</p>
                  <p className="text-red-100 text-xs mt-2">Mês atual (salários, aluguel, almoço, etc.)</p>
                </div>
                <DollarSign size={48} className="opacity-50" />
              </div>
            </Card>

            <Card className={`p-6 rounded-xl bg-gradient-to-br ${netProfitDash >= 0 ? 'from-green-500 to-green-600' : 'from-orange-500 to-orange-600'} text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm mb-1">Lucro Líquido</p>
                  <p className="text-3xl font-bold">{formatCurrency(netProfitDash)}</p>
                  <p className="text-white/80 text-xs mt-2">Mês atual</p>
                </div>
                <BarChart size={48} className="opacity-50" />
              </div>
            </Card>
          </div>

          {/* Métricas Adicionais */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 rounded-xl border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Total de Vendas</p>
                  <p className="text-2xl font-bold text-[#d9b53f]">
                    {closureTotalSalesCount}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Vendas realizadas em {closuresCurrentMonth.length} dias</p>
                </div>
                <ShoppingCart size={32} className="text-blue-400" />
              </div>
            </Card>

            <Card className="p-4 rounded-xl border-2 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Ticket Médio</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(closureTicketAverage)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Por fechamento</p>
                </div>
                <CreditCard size={32} className="text-green-400" />
              </div>
            </Card>

            <Card className="p-4 rounded-xl border-2 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Custo Médio por Fechamento</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {(() => {
                      const closureCount = closures.length || 0;
                      const avg = closureCount > 0 ? (closureRaw?.costs || 0) / closureCount : 0;
                      return formatCurrency(avg);
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Por fechamento ({closures.length})</p>
                </div>
                <Minus size={32} className="text-orange-400" />
              </div>
            </Card>

            <Card className="p-4 rounded-xl border-2 border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Margem de Lucro</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {(() => {
                      const rev = closureRaw?.revenue || 0;
                      const profit = netProfitDash || 0;
                      const margin = rev > 0 ? (profit / rev * 100) : 0;
                      return `${margin.toFixed(1)}%`;
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Líquida (com despesas)</p>
                </div>
                <PieChart size={32} className="text-indigo-400" />
              </div>
            </Card>
          </div>

          {/* Gráfico de Faturamento Mensal com Dados do Supabase */}
          <Card className="p-6 rounded-xl min-h-[320px]">
            <h3 className="font-bold text-lg mb-4">Faturamento por Mês (Últimos 6 Meses)</h3>
            {monthlyRevenueByClosures.some(d => d.value > 0) ? (
              <div>
                <BarChartComponent data={monthlyRevenueByClosures} height={250} showCurrency={true} />
                <div className="mt-4 grid grid-cols-6 gap-2">
                  {monthlyRevenueByClosures.map((item, index) => (
                    <div key={index} className="text-center">
                      <p className="text-xs font-semibold text-gray-700">{formatCurrency(item.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-center text-gray-500">Nenhum dado disponível para os últimos 6 meses</p>
              </div>
            )}
          </Card>

          {/* Gráficos e Rankings */}
          <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Método de Pagamento */}
            <Card className="p-6 rounded-xl min-h-[220px]">
              <h3 className="font-bold text-lg mb-4">Método de Pagamento Mais Utilizado</h3>
              {paymentMethodDataFromClosures.length > 0 ? (
                <PieChartComponent data={paymentMethodDataFromClosures} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-center text-gray-500">Nenhum dado disponível</p>
                </div>
              )}
            </Card>

            {/* Faturamento por Dia da Semana */}
            <Card className="p-6 rounded-xl min-h-[220px]">
              <h3 className="font-bold text-lg mb-4">Faturamento por Dia da Semana</h3>
              {salesByDayOfWeekFromClosures.length > 0 ? (
                <BarChartComponent data={salesByDayOfWeekFromClosures} height={200} showCurrency={true} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-center text-gray-500">Nenhum dado disponível</p>
                </div>
              )}
            </Card>

            {/* Onde está vendendo mais (por loja) */}
            <Card className="p-6 rounded-xl min-h-[220px]">
              <h3 className="font-bold text-lg mb-4">Faturamento por Loja / Local</h3>
              {storePerformanceData.length > 0 ? (
                <div className="space-y-2">
                  {storePerformanceData.map((store, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: getColorForIndex(index) }}
                        />
                        <span className="text-sm font-medium">{store.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(store.revenue)}</p>
                        <p className="text-xs text-gray-500">{store.count} fechamentos</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-center text-gray-500">Nenhum dado disponível</p>
                </div>
              )}
            </Card>

            {/* Top 5 Produtos Mais Vendidos */}
            <Card className="p-6 rounded-xl min-h-[220px]">
              <h3 className="font-bold text-lg mb-4">Top 5 Produtos Mais Vendidos</h3>
              {topProductsFromClosures.length > 0 ? (
                <div className="space-y-2">
                  {topProductsFromClosures.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                        <span className="text-sm font-medium text-gray-700">{product.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{product.quantity}x</p>
                        <p className="text-xs text-gray-500">{formatCurrency(product.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-center text-gray-500">Nenhum produto vendido ainda</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "expenses" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gestão de Despesas</h2>
            <Button
              variant="primary"
              className="rounded-full"
              onClick={() => {
                setEditingExpense(null);
                setExpenseForm({
                  date: format(new Date(), "yyyy-MM-dd"),
                  category: "",
                  description: "",
                  amount: ""
                });
                setShowExpenseModal(true);
              }}
            >
              <Plus size={18} className="mr-2"/> Adicionar Despesa
            </Button>
          </div>

          {/* Lista de Despesas */}
          <div className="space-y-3">
            {expenses.length === 0 ? (
              <Card className="p-8 text-center rounded-xl">
                <p className="text-gray-500">Nenhuma despesa registrada ainda</p>
              </Card>
            ) : (
              expenses
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(expense => (
                  <Card key={expense.id} className="p-4 rounded-xl">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={16} className="text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {format(new Date(expense.date), "dd/MM/yyyy")}
                          </span>
                        </div>
                        <p className="font-bold text-lg">{expense.description}</p>
                        <p className="text-sm text-gray-500">{expense.category}</p>
                        {expense.created_by && (
                          <p className="text-xs text-gray-400 mt-1">Por: {expense.created_by}</p>
                        )}
                      </div>
                      <div className="text-right mr-4">
                        <p className="text-2xl font-bold text-red-600">
                          {formatCurrency(parseFloat(expense.amount) || 0)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => handleEditExpense(expense)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button
                          variant="danger"
                          className="rounded-full"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Despesa */}
      {showExpenseModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExpenseModal(false);
              setEditingExpense(null);
            }
          }}
        >
          <Card className="w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">
              {editingExpense ? "Editar Despesa" : "Adicionar Despesa"}
            </h2>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data *</label>
                <Input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                  required
                  className="w-full rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Categoria *</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                  required
                  className="w-full p-2 border rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Selecione uma categoria</option>
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Descrição *</label>
                <Input
                  placeholder="ex: Aluguel mensal, Internet, Conta de luz..."
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  required
                  className="w-full rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Digite o valor da despesa"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  required
                  className="w-full rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => {
                    setShowExpenseModal(false);
                    setEditingExpense(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 rounded-full">
                  {editingExpense ? "Atualizar" : "Adicionar"} Despesa
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {tab === "closures" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Histórico de Fechamentos de Caixa</h2>
          {closures.length === 0 ? (
            <Card className="p-8 text-center rounded-xl">
              <p className="text-gray-500">Nenhum fechamento de caixa registrado ainda</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {closures.map(closure => {
                const closureDate = format(new Date(closure.date), "dd/MM/yyyy");
                const closureTime = format(new Date(closure.created_at), "HH:mm");
                // Priorizar nome resolvido (quando carregado do SBD), senão tentar tabela local
                let authorName = closure.created_by_name || closure.created_by;
                try {
                  if (!closure.created_by_name) {
                    const usersList = db.users.list() || [];
                    const found = usersList.find(u => u.id === closure.created_by || u.email === closure.created_by || u.tenantId === closure.created_by || u.store_id === closure.created_by || u.storeId === closure.created_by);
                    if (found && found.name) authorName = found.name;
                  }
                } catch (e) {
                  // fallback: manter closure.created_by ou created_by_name
                }
                const fileName = `${closureDate} - ${authorName} - ${closureTime}`;
                
                return (
                  <Card
                    key={closure.id}
                    className="p-4 rounded-xl hover:border-blue-500 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <p className="font-bold text-lg">{fileName}</p>
                        <p className="text-sm text-gray-500">
                          Fechado em {format(new Date(closure.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                        <div className="mt-2 flex gap-4 text-sm">
                          <span className="text-green-600 font-medium">
                            Vendas: {formatCurrency(closure.totalSales || 0)}
                          </span>
                          <span className="text-[#d9b53f] font-medium">
                            Lucro: {formatCurrency(closure.grossProfit || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => {
                            setSelectedClosure(closure);
                            setShowClosureViewModal(true);
                          }}
                          title="Ver detalhes"
                        >
                          <FileText size={18} />
                        </Button>
                        <Button
                          variant="primary"
                          className="rounded-full"
                          onClick={() => exportClosureDashboard(closure)}
                          title="Baixar arquivo"
                        >
                          <Download size={18} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Visualização de Fechamento */}
      {showClosureViewModal && selectedClosure && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowClosureViewModal(false);
              setSelectedClosure(null);
            }
          }}
        >
          <Card className="w-full max-w-4xl p-6 rounded-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Detalhes do Fechamento de Caixa</h2>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setShowClosureViewModal(false);
                  setSelectedClosure(null);
                }}
              >
                ✕
              </Button>
            </div>
            {renderClosureDetailsDashboard(selectedClosure)}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => {
                  setShowClosureViewModal(false);
                  setSelectedClosure(null);
                }}
              >
                Fechar
              </Button>
              <Button
                variant="primary"
                className="flex-1 rounded-full"
                onClick={() => generateClosurePDF(selectedClosure)}
              >
                <Download size={18} className="mr-2"/> Baixar PDF
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
function Reports({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState("finalized");
  const [finalizedSales, setFinalizedSales] = useState([]);
  const [cancelledSales, setCancelledSales] = useState([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [availableManagers, setAvailableManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [closurePassword, setClosurePassword] = useState("");
  const [closureError, setClosureError] = useState("");
  const [closureData, setClosureData] = useState(null);
  const [availableClosureManagers, setAvailableClosureManagers] = useState([]);
  const [selectedClosureManagerId, setSelectedClosureManagerId] = useState("");
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [cashOpeningAmount, setCashOpeningAmount] = useState("");
  const [currentCashOpening, setCurrentCashOpening] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [resourceAmount, setResourceAmount] = useState("");

  // REFATORAÇÃO: Verificar caixa aberto usando localStorage (fonte principal)
  const checkCashOpening = useCallback(() => {
    try {
      // Buscar caixa do localStorage (fonte principal)
      const cashStr = localStorage.getItem('currentCashRegister');
      if (!cashStr) {
        setCurrentCashOpening(null);
        return;
      }

      try {
        const cash = JSON.parse(cashStr);
        
        // Verificar se o caixa foi fechado (existe relatório)
        const allReports = JSON.parse(localStorage.getItem('reports') || '[]');
        const wasClosed = allReports.some(r => r.cashRegisterId === cash.id);
        
        if (wasClosed) {
          // Caixa foi fechado, limpar
          localStorage.removeItem('currentCashRegister');
          setCurrentCashOpening(null);
          return;
        }

        // Caixa está aberto e válido
      setCurrentCashOpening(prev => {
          if (prev?.id === cash.id) {
            return prev; // Evita re-render desnecessário
          }
          return cash;
        });
      } catch (e) {
        console.error('Erro ao parsear caixa do localStorage:', e);
        localStorage.removeItem('currentCashRegister');
        setCurrentCashOpening(null);
      }
    } catch (error) {
      console.error('Erro ao verificar abertura de caixa:', error);
      setCurrentCashOpening(null);
    }
  }, []);

  // REFATORAÇÃO: Buscar vendas filtradas por cashRegisterId (não por data)
  // CORREÇÃO: usar apenas localStorage como fonte para evitar duplicação e respeitar status (incluindo canceladas)
  const refreshSales = useCallback(() => {
    const cash = JSON.parse(localStorage.getItem('currentCashRegister') || 'null');
    
    if (!cash) {
      // Se não há caixa aberto, as listas ficam vazias
      setFinalizedSales([]);
      setCancelledSales([]);
      return;
    }

    // Buscar vendas do banco local (db) e filtrar pelo caixa atual
    const allLocalSales = db.sales.list();
    const currentSales = Array.isArray(allLocalSales) ? allLocalSales.filter(sale => sale.cashRegisterId === cash.id) : [];
    
    // Separar finalizadas e canceladas
    const finalized = currentSales.filter(s => s.status !== 'cancelled' && s.status !== 'canceled');
    const cancelled = currentSales.filter(s => s.status === 'cancelled' || s.status === 'canceled');
    
    setFinalizedSales(finalized);
    setCancelledSales(cancelled);
  }, [currentCashOpening]);

  // REFATORAÇÃO: Restaurar caixa do localStorage ao carregar componente
  useEffect(() => {
    // Restaurar caixa do localStorage (fonte principal)
    const cashStr = localStorage.getItem('currentCashRegister');
    if (cashStr) {
      try {
        const cash = JSON.parse(cashStr);
        
        // Verificar se o caixa foi fechado
        const allReports = JSON.parse(localStorage.getItem('reports') || '[]');
        const wasClosed = allReports.some(r => r.cashRegisterId === cash.id);
    
        if (!wasClosed) {
          // Caixa ainda está aberto, restaurar
          setCurrentCashOpening(cash);
        } else {
          // Caixa foi fechado, limpar
          localStorage.removeItem('currentCashRegister');
      setCurrentCashOpening(null);
    }
      } catch (e) {
        console.error('Erro ao restaurar caixa:', e);
        localStorage.removeItem('currentCashRegister');
        setCurrentCashOpening(null);
      }
    } else {
      // Se não há no localStorage, verificar no banco (compatibilidade)
      checkCashOpening();
    }
  }, [location.pathname, checkCashOpening]); // Executa quando muda a rota ou ao montar

  // Atualizar vendas sempre que o caixa aberto mudar
  useEffect(() => {
    refreshSales();
  }, [refreshSales]);

  // Recarregar dados periodicamente para manter atualizado
  useEffect(() => {
    const interval = setInterval(() => {
      // Verificar se o caixa ainda está aberto (não foi fechado)
      checkCashOpening();
      // Atualizar vendas após verificar o caixa
      refreshSales();
    }, 10000); // Atualiza a cada 10 segundos

    return () => clearInterval(interval);
  }, [checkCashOpening, refreshSales]);

  const handleCancelSale = async (sale) => {
    setSelectedSale(sale);
    setCancelPassword("");
    setCancelError("");
    setSelectedManagerId("");
    setShowCancelModal(true);

    // Carregar gerentes/admins disponíveis da mesma loja quando o usuário é caixa
    if (user.role === 'caixa') {
      try {
        const storeId = user.store_id || user.tenantId;
        if (!storeId) {
          console.warn('[handleCancelSale] Store ID não definido para o usuário.');
          setAvailableManagers([]);
          return;
        }

        const { data: managers, error: managersError } = await supabase
          .from('users')
          .select('id, name, email, role, password_hash, store_id')
          .eq('store_id', storeId)
          .eq('active', true);

        if (managersError) {
          console.error('[handleCancelSale] Erro ao buscar gerentes/admins:', managersError);
          setAvailableManagers([]);
          return;
        }

        const authorizedUsers = (managers || []).filter(m =>
          m.role === 'admin' || m.role === 'gerente'
        );

        setAvailableManagers(authorizedUsers);
      } catch (error) {
        console.error('[handleCancelSale] Erro inesperado ao carregar gerentes/admins:', error);
        setAvailableManagers([]);
      }
    } else {
      // Para usuários que já são admin/gerente, não precisa de lista
      setAvailableManagers([]);
    }
  };

  // Função auxiliar para verificar senha do usuário logado (no componente POS)
  const verifyUserPasswordPOS = async (password) => {
    try {
      // Preferir checar password_hash direto na tabela users
      if (user?.id) {
        const { data: dbUser, error: dbUserError } = await supabase
          .from('users')
          .select('id, email, password_hash')
          .eq('id', user.id)
          .maybeSingle();

        if (dbUserError) {
          console.error('[verifyUserPasswordPOS] Erro ao buscar usuário no Supabase:', dbUserError);
        }

        if (dbUser) {
          if (dbUser.password_hash && dbUser.password_hash === password) {
            return true;
          }

          // Se não tem password_hash ou não bateu, tentar auth por email
          if (dbUser.email) {
            const { error: authError } = await supabase.auth.signInWithPassword({
              email: dbUser.email,
              password
            });
            return !authError;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('[verifyUserPasswordPOS] Erro ao verificar senha:', error);
      return false;
    }
  };

  const confirmCancel = async () => {
    if (!cancelPassword) {
      setCancelError("Digite a senha de gerente ou administrador");
      return;
    }

    console.log('[confirmCancel] Iniciando validação. Usuário:', user.role, 'Senha digitada:', cancelPassword);

    let passwordValid = false;
    let actingUser = user;

    // Se o usuário logado já é gerente/admin, verificar sua própria senha
    if (user.role === 'admin' || user.role === 'gerente') {
      console.log('[confirmCancel] Usuário é gerente/admin, verificando própria senha');
      passwordValid = await verifyUserPasswordPOS(cancelPassword);
      console.log('[confirmCancel] Resultado validação própria senha:', passwordValid);
      if (!passwordValid) {
        setCancelError("Senha incorreta.");
        return;
      }
    } else {
      // Se for caixa, buscar gerentes/admins da mesma loja para escolher e validar a senha
      try {
        console.log('[confirmCancel] Usuário é caixa, buscando gerentes/admins da loja');
        
        const storeId = user.store_id || user.tenantId;
        console.log('[confirmCancel] Store ID:', storeId);
        
        // Buscar gerentes/admins da mesma loja
        const { data: managers, error: managersError } = await supabase
          .from('users')
          .select('id, name, email, role, password_hash, store_id')
          .eq('store_id', storeId)
          .eq('active', true);
        
        if (managersError) {
          console.error('[confirmCancel] Erro ao buscar gerentes:', managersError);
          setCancelError("Erro ao buscar gerentes. Tente novamente.");
          return;
        }
        
        console.log('[confirmCancel] Usuários encontrados:', managers?.length || 0);
        
        // Filtrar apenas admin/gerente
        const authorizedUsers = managers?.filter(m => 
          m.role === 'admin' || m.role === 'gerente'
        ) || [];
        
        console.log('[confirmCancel] Gerentes/admins encontrados:', authorizedUsers.length);
        if (authorizedUsers.length > 0) {
          console.log('[confirmCancel] Lista:', authorizedUsers.map(m => ({ 
            name: m.name, 
            role: m.role,
            hasPasswordHash: !!m.password_hash 
          })));
        }
        // Atualizar lista disponível para o modal (usada no select)
        setAvailableManagers(authorizedUsers);

        if (!selectedManagerId) {
          setCancelError("Selecione o gerente ou administrador.");
          return;
        }

        const selectedManager = authorizedUsers.find(m => m.id === selectedManagerId);
        if (!selectedManager) {
          setCancelError("Gerente/administrador selecionado inválido.");
          return;
        }

        console.log('[confirmCancel] Verificando senha para:', selectedManager.name, '- Role:', selectedManager.role);

        if (selectedManager.password_hash && selectedManager.password_hash === cancelPassword) {
          console.log('[confirmCancel] ✅ Senha válida para:', selectedManager.name);
          passwordValid = true;
          actingUser = selectedManager;
        } else {
          console.log('[confirmCancel] ❌ Senha incorreta para:', selectedManager.name);
          setCancelError("Senha incorreta para o usuário selecionado.");
          return;
        }
      } catch (error) {
        console.error('[confirmCancel] Erro ao validar senha:', error);
        setCancelError("Erro ao validar senha. Tente novamente.");
        return;
      }
    }

    const result = db.sales.cancel(selectedSale.id, cancelPassword, actingUser);
    
    if (result.success) {
      // Atualizar também o localStorage para refletir o cancelamento nesta sessão
      try {
        const salesStr = localStorage.getItem('sales');
        if (salesStr) {
          const sales = JSON.parse(salesStr);
          const idx = sales.findIndex(s => s.id === selectedSale.id);
          if (idx !== -1) {
            sales[idx] = {
              ...sales[idx],
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            };
            localStorage.setItem('sales', JSON.stringify(sales));
          }
        }
      } catch (e) {
        console.error('Erro ao sincronizar venda cancelada no localStorage:', e);
      }

      alert(result.message);
      setShowCancelModal(false);
      setSelectedSale(null);
      setCancelPassword("");
      refreshSales();
    } else {
      setCancelError(result.message);
    }
  };

  const formatPaymentMethod = (method) => {
    const methods = {
      'money': 'Dinheiro',
      'pix_maquina': 'PIX (Máquina)',
      'pix_direto': 'PIX (Direto)',
      'credit': 'Cartão de Crédito',
      'debit': 'Cartão de Débito'
    };
    return methods[method] || method;
  };

  const renderSaleItem = (sale) => (
    <Card key={sale.id} className="p-4 rounded-xl mb-3">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-bold text-lg">Venda #{sale.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-sm text-gray-500">
            {format(new Date(sale.sale_date), "dd/MM/yyyy HH:mm")}
          </p>
          {sale.created_by && (
            <p className="text-xs text-gray-400">Vendedor: {sale.created_by}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(sale.total_amount)}
          </p>
          <p className="text-xs text-gray-500">
            {formatPaymentMethod(sale.payment_method)}
          </p>
        </div>
      </div>
      
      <div className="border-t pt-3">
        <p className="text-sm font-medium mb-2">Itens:</p>
        <div className="space-y-1">
          {sale.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.name}</span>
              <span className="text-gray-600">
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        {sale.discount > 0 && (
          <div className="mt-2 pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Desconto:</span>
              <span className="text-green-600">- {formatCurrency(sale.discount)}</span>
            </div>
          </div>
        )}
      </div>
      
      {sale.status === 'cancelled' && (
        <div className="mt-3 pt-3 border-t bg-red-50 p-2 rounded">
          <p className="text-xs text-red-600 font-medium">
            ❌ Cancelada em {sale.cancelled_at ? format(new Date(sale.cancelled_at), "dd/MM/yyyy HH:mm") : 'N/A'}
          </p>
          {sale.cancelled_by && (
            <p className="text-xs text-red-500">Por: {sale.cancelled_by}</p>
          )}
        </div>
      )}
    </Card>
  );

  const resolveCashierName = (sale, userLookup = {}, cashRegisterMap = {}) => {
    const saleUserId = sale.user_id || sale.userId || sale.userID || sale.user;
    const fallbackName = (
      sale.created_by ||
      sale.user_name || // Priorizar user_name que agora é preenchido
      sale.cashier_name ||
      sale.user_name ||
      sale.userName ||
      sale.seller_name ||
      sale.operator_name ||
      (saleUserId ? userLookup[saleUserId] : null) ||
      (saleUserId ? `Usuário ${String(saleUserId).slice(0, 6)}` : null)
    );
    
    // Se temos um nome, usar ele
    if (fallbackName) {
      return fallbackName;
    }
    
    // Caso contrário, tentar usar o cashRegisterId para gerar um identificador
    const cashRegisterId = sale.cashRegisterId || sale.cash_register_id || sale.pos_id;
    if (cashRegisterId && cashRegisterMap[cashRegisterId]) {
      return cashRegisterMap[cashRegisterId];
    }
    
    // Fallback final
    return 'Caixa';
  };

  const buildCashierBreakdown = (sales = [], cancelled = [], userLookup = {}) => {
    const map = {};

    // Função auxiliar para verificar se uma venda tem um nome atribuído
    const hasCashierName = (sale) => {
      return !!(
        sale.created_by ||
        sale.cashier_name ||
        sale.user_name ||
        sale.userName ||
        sale.seller_name ||
        sale.operator_name ||
        ((sale.user_id || sale.userId || sale.userID || sale.user) && userLookup[(sale.user_id || sale.userId || sale.userID || sale.user)])
      );
    };

    // Criar mapa de cashRegisterIds únicos para numeração (CAIXA 1, CAIXA 2, etc)
    // Apenas para vendas sem nome atribuído
    const uniqueCashRegisterIds = new Set();
    const allSalesAndCancelled = [...sales, ...cancelled];
    
    allSalesAndCancelled.forEach(sale => {
      if (!hasCashierName(sale)) {
        const cashRegisterId = sale.cashRegisterId || sale.cash_register_id || sale.pos_id;
        if (cashRegisterId) {
          uniqueCashRegisterIds.add(cashRegisterId);
        }
      }
    });
    
    // Criar mapa de cashRegisterId -> "CAIXA N"
    const cashRegisterMap = {};
    const sortedIds = Array.from(uniqueCashRegisterIds).sort();
    sortedIds.forEach((id, index) => {
      cashRegisterMap[id] = `CAIXA ${index + 1}`;
    });

    const accumulate = (sale, factor) => {
      const name = resolveCashierName(sale, userLookup, cashRegisterMap);
      const amount = (sale.total_amount || 0) * factor;
      const method = sale.payment_method || 'money';

      if (!map[name]) {
        map[name] = { total: 0, methods: {} };
      }

      map[name].total += amount;
      map[name].methods[method] = (map[name].methods[method] || 0) + amount;
    };

    sales.forEach(sale => accumulate(sale, 1));
    cancelled.forEach(sale => accumulate(sale, -1));

    return Object.entries(map)
      .map(([name, data]) => ({ name, total: data.total, methods: data.methods }))
      .sort((a, b) => b.total - a.total);
  };

  // Calcular fechamento de caixa do dia
  const calculateDayClosure = async (date = new Date()) => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Buscar abertura de caixa do dia
    const cashOpening = db.cashOpenings.getByDate(targetDate);
    const openingAmount = cashOpening ? (cashOpening.amount || 0) : 0;
    
    // CORREÇÃO: Buscar último fechamento do dia para filtrar vendas
    const allClosures = db.closures.list();
    const dayClosures = allClosures.filter(c => {
      const closureDate = new Date(c.date);
      return closureDate.toISOString().split('T')[0] === targetDate.toISOString().split('T')[0];
    });
    
    const lastClosure = dayClosures.length > 0 
      ? dayClosures.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
      : null;
    
    // Data de corte: último fechamento ou abertura do caixa
    const openingTime = cashOpening ? new Date(cashOpening.created_at || cashOpening.date) : targetDate;
    const filterDate = lastClosure ? new Date(lastClosure.created_at) : openingTime;

    // Buscar vendas do banco de dados (não usar estados locais)
    // Buscar vendas do SBD primeiro, fallback para localStorage
    let allFinalizedSales = [];
    let allCancelledSales = [];
    try {
      const { supabaseDB } = await import('./services/supabaseDB.js');
      const sbdFinalized = await supabaseDB.sales.listFinalized();
      const sbdCancelled = await supabaseDB.sales.listCancelled();
      // Preferir SBD como fonte da verdade (mesmo vazio)
      allFinalizedSales = Array.isArray(sbdFinalized) ? sbdFinalized : db.sales.listFinalized();
      allCancelledSales = Array.isArray(sbdCancelled) ? sbdCancelled : db.sales.listCancelled();
    } catch (error) {
      console.error('[Reports] Erro ao carregar vendas do SBD, usando localStorage:', error);
      allFinalizedSales = db.sales.listFinalized();
      allCancelledSales = db.sales.listCancelled();
    }

    // CORREÇÃO: Vendas apenas após o último fechamento (ou abertura se não houver fechamento)
    const daySales = allFinalizedSales.filter(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      return saleDate >= filterDate && saleDate < nextDay;
    });

    // Cancelamentos apenas após o último fechamento
    const dayCancelled = allCancelledSales.filter(sale => {
      const saleDate = new Date(sale.sale_date || sale.created_at);
      return saleDate >= filterDate && saleDate < nextDay;
    });

    // Mapear usuários da loja para exibir nome do caixa
    let cashierUserMap = {};
    try {
      const storeId = resolveStoreId();
      const { data: supaUsers, error: supaUsersError } = await supabase
        .from('users')
        .select('id, name, cpf, email')
        .eq('store_id', storeId)
        .eq('active', true);

      if (!supaUsersError && Array.isArray(supaUsers)) {
        cashierUserMap = supaUsers.reduce((acc, u) => {
          acc[u.id] = u.name || u.cpf || u.email || `Usuário ${String(u.id).slice(0, 6)}`;
          return acc;
        }, {});
      }
    } catch (error) {
      console.error('[calculateDayClosure] Erro ao carregar usuários para resumo por caixa:', error);
    }

    // Calcular totais por método de pagamento
    const paymentMethods = {};
    let totalSales = 0;
    let totalDiscounts = 0;
    let totalCosts = 0;

    daySales.forEach(sale => {
      const method = sale.payment_method || 'money';
      if (!paymentMethods[method]) {
        paymentMethods[method] = 0;
      }
      paymentMethods[method] += sale.total_amount;
      totalSales += sale.total_amount;
      totalDiscounts += sale.discount || 0;

      // Calcular custos dos itens vendidos
      sale.items?.forEach(item => {
        const product = db.products.list().find(p => p.id === item.product_id);
        if (product && product.costPrice) {
          totalCosts += (product.costPrice * item.quantity);
        }
      });
    });

    // Descontar cancelamentos
    dayCancelled.forEach(sale => {
      totalSales -= sale.total_amount;
      const method = sale.payment_method || 'money';
      if (paymentMethods[method]) {
        paymentMethods[method] -= sale.total_amount;
      }
    });

    // Calcular despesas do dia
    const dayExpenses = db.expenses.list().filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= targetDate && expenseDate < nextDay;
    });
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Lucro bruto = Vendas - Custos - Despesas
    const grossProfit = totalSales - totalCosts - totalExpenses;

    // Valor final no caixa = Abertura + Vendas - Despesas
    const finalCashAmount = openingAmount + totalSales - totalExpenses;

    const cashiers = buildCashierBreakdown(daySales, dayCancelled, cashierUserMap);

    return {
      date: targetDate.toISOString(),
      sales: daySales,
      cancelled: dayCancelled,
      totalSales,
      totalCosts,
      totalExpenses,
      totalDiscounts,
      grossProfit,
      paymentMethods,
      expenses: dayExpenses,
      openingAmount,
      finalCashAmount,
      cashiers
    };
  };

  // Adicionar Recursos ao Caixa
  const handleAddResource = () => {
    console.log('[handleAddResource] 🟢 Botão + Recursos clicado');
    
    if (!currentCashOpening || currentCashOpening.closed) {
      alert('Não há caixa aberto para adicionar recursos.');
      return;
    }
    
    setResourceAmount("");
    setShowAddResourceModal(true);
  };

  const confirmAddResource = async () => {
    console.log('[confirmAddResource] 🟢 Confirmando adição de recurso');
    console.log('[confirmAddResource] Valor digitado:', resourceAmount);

    const amount = parseFloat(resourceAmount);

    if (!resourceAmount || resourceAmount.trim() === "" || isNaN(amount) || amount <= 0) {
      console.log('[confirmAddResource] ❌ Valor inválido:', resourceAmount);
      alert('Digite um valor válido maior que zero');
      return;
    }

    if (!currentCashOpening || currentCashOpening.closed) {
      alert('Não há caixa aberto para adicionar recursos.');
      return;
    }

    try {
      const cashData = currentCashOpening;

      // Adicionar o valor ao openingValue
      const newOpeningValue = (cashData.openingValue || 0) + amount;
      console.log('[confirmAddResource] Novo valor de abertura:', newOpeningValue);

      // Atualizar o objeto do caixa
      const updatedCash = {
        ...cashData,
        openingValue: newOpeningValue,
        resourcesAdded: (cashData.resourcesAdded || 0) + amount,
        lastResourceAddedAt: new Date().toISOString()
      };

      console.log('[confirmAddResource] Caixa atualizado:', updatedCash);

      // Salvar no localStorage
      localStorage.setItem('currentCashRegister', JSON.stringify(updatedCash));
      console.log('[confirmAddResource] ✅ Caixa atualizado no localStorage');

      // Atualizar o estado
      setCurrentCashOpening(updatedCash);
      setShowAddResourceModal(false);
      setResourceAmount("");

      alert(`Recurso de ${formatCurrency(amount)} adicionado com sucesso!\n\nValor total no caixa agora: ${formatCurrency(newOpeningValue)}`);
      console.log('[confirmAddResource] ✅✅✅ RECURSO ADICIONADO COM SUCESSO!');
    } catch (error) {
      console.error('[confirmAddResource] ❌ Erro ao adicionar recurso:', error);
      alert('Erro ao adicionar recurso: ' + error.message);
    }
  };

  // Abrir caixa
  const handleOpenCash = () => {
    console.log('[handleOpenCash] 🔵 Botão Abrir Caixa clicado');
    
    try {
      // Verificar se já existe caixa aberto no localStorage (método mais confiável)
      const existingCash = localStorage.getItem('currentCashRegister');
      console.log('[handleOpenCash] Verificando localStorage currentCashRegister:', existingCash);
      
      if (existingCash) {
        try {
          const parsed = JSON.parse(existingCash);
          console.log('[handleOpenCash] Caixa encontrado no localStorage:', parsed);
          
          // Verificar se o caixa foi fechado
          const allReports = JSON.parse(localStorage.getItem('reports') || '[]');
          console.log('[handleOpenCash] Total de reports:', allReports.length);
          
          const wasClosed = allReports.some(r => r.cashRegisterId === parsed.id);
          console.log('[handleOpenCash] Caixa foi fechado?', wasClosed);
          
          if (!wasClosed) {
            console.log('[handleOpenCash] ⚠️ Caixa já está aberto!');
            alert('O caixa já está aberto! Feche o caixa antes de abrir um novo.');
            setCurrentCashOpening(parsed);
            return;
          }
          
          console.log('[handleOpenCash] ✅ Caixa foi fechado, pode abrir novo');
        } catch (e) {
          console.error('[handleOpenCash] Erro ao parsear caixa existente:', e);
          localStorage.removeItem('currentCashRegister');
        }
      } else {
        console.log('[handleOpenCash] ✅ Nenhum caixa aberto no localStorage');
      }
      
      // Permitir abrir novo caixa
      console.log('[handleOpenCash] 📂 Abrindo modal de abertura de caixa');
      setCashOpeningAmount("");
      setShowOpenCashModal(true);
    } catch (error) {
      console.error('[handleOpenCash] ❌ Erro ao verificar abertura de caixa:', error);
      alert('Erro ao verificar abertura de caixa: ' + (error.message || 'Erro desconhecido'));
    }
  };

  // REFATORAÇÃO: Abertura de caixa com ID único e localStorage
  // Atualizado para carregar produtos do Supabase e salvar no cache local
  const confirmOpenCash = async () => {
    console.log('[confirmOpenCash] 🟢 INICIANDO abertura de caixa');
    console.log('[confirmOpenCash] Valor digitado:', cashOpeningAmount);
    
    const amount = parseFloat(cashOpeningAmount);
    
    if (!cashOpeningAmount || cashOpeningAmount.trim() === "" || isNaN(amount) || amount < 0) {
      console.log('[confirmOpenCash] ❌ Valor inválido:', cashOpeningAmount);
      alert('Digite um valor válido para abrir o caixa');
      return;
    }

    console.log('[confirmOpenCash] ✅ Valor válido:', amount);

    try {
      // Verificar se já existe caixa aberto no localStorage
      const existingCash = localStorage.getItem('currentCashRegister');
      console.log('[confirmOpenCash] Verificando caixa existente:', existingCash);
      
      if (existingCash) {
        try {
          const parsed = JSON.parse(existingCash);
          console.log('[confirmOpenCash] Caixa existente:', parsed);
          
          // Verificar se o caixa ainda é válido (não foi fechado)
          const allReports = JSON.parse(localStorage.getItem('reports') || '[]');
          const wasClosed = allReports.some(r => r.cashRegisterId === parsed.id);
          
          console.log('[confirmOpenCash] Foi fechado?', wasClosed);
          
          if (!wasClosed) {
            console.log('[confirmOpenCash] ⚠️ CAIXA JÁ ABERTO - Abortando');
            alert('O caixa já está aberto! Feche o caixa antes de abrir um novo.');
            setShowOpenCashModal(false);
            setCashOpeningAmount("");
            setCurrentCashOpening(parsed);
            return;
          }
        } catch (e) {
          console.error('[confirmOpenCash] Erro ao parsear:', e);
          // Se houver erro ao parsear, limpa e continua
          localStorage.removeItem('currentCashRegister');
        }
      }

      console.log('[confirmOpenCash] 📦 Iniciando sincronização de produtos...');

      // ============================================
      // 1. SINCRONIZAR PRODUTOS DO SUPABASE
      // ============================================
      setLoadingProducts(true);
      
      try {
        // Sincronizar produtos do Supabase para db.products (localStorage)
        // Isso garante que produtos do Supabase sejam carregados e mesclados com produtos locais
        await db.syncProducts();
        
        const storeId = resolveStoreId();
        
        // Também salvar no cache de produtos (para compatibilidade)
        const products = db.products.list();
        const productVersions = products
          .filter(p => p.updated_at)
          .map(p => ({
            id: p.id,
            updated_at: p.updated_at || new Date().toISOString()
          }));
        
        // Salvar produtos no cache local (formato Supabase)
        const cacheKey = `products_cache_${storeId}`;
        localStorage.setItem(cacheKey, JSON.stringify(products));
        
        // Salvar product_versions
        const versionsKey = `product_versions_${storeId}`;
        localStorage.setItem(versionsKey, JSON.stringify(productVersions));
        
        console.log(`[confirmOpenCash] ✅ ${products.length} produtos sincronizados e disponíveis`);
      } catch (error) {
        console.error('[confirmOpenCash] ❌ Erro ao sincronizar produtos:', error);
        // Continuar mesmo se houver erro ao sincronizar produtos
        alert('Aviso: Erro ao sincronizar produtos do servidor. Continuando com cache local.');
      } finally {
        setLoadingProducts(false);
      }

      console.log('[confirmOpenCash] 💰 Criando novo caixa...');
      
      // Criar novo caixa com ID único
      const newCash = {
        id: Date.now(), // ID ÚNICO PARA A SESSÃO DO CAIXA
        openingValue: Number(amount),
        openedAt: new Date().toISOString(),
      };

      console.log('[confirmOpenCash] Novo caixa criado:', newCash);

      // Salvar no localStorage
      localStorage.setItem('currentCashRegister', JSON.stringify(newCash));
      console.log('[confirmOpenCash] ✅ Caixa salvo no localStorage');
      
      // Também salvar no banco para compatibilidade (opcional, mas mantém histórico)
      const today = new Date();
      const opening = db.cashOpenings.create({
        date: today.toISOString(),
        amount: amount,
        cashRegisterId: newCash.id // Vincular ao ID único
      }, user);

      console.log('[confirmOpenCash] Opening no db:', opening);

      if (opening) {
        console.log('[confirmOpenCash] ✅✅✅ CAIXA ABERTO COM SUCESSO!');
        setCurrentCashOpening(newCash);
        setShowOpenCashModal(false);
        setCashOpeningAmount("");
        // Atualizar vendas após abrir o caixa
        refreshSales();
        alert(`Caixa aberto com ${formatCurrency(amount)}`);
      } else {
        console.log('[confirmOpenCash] ❌ Erro: opening retornou falsy');
        alert('Erro ao abrir o caixa. Tente novamente.');
      }
    } catch (error) {
      console.error('[confirmOpenCash] ❌❌❌ ERRO FATAL:', error);
      setLoadingProducts(false);
      alert('Erro ao abrir o caixa: ' + error.message);
    }
  };

  // REFATORAÇÃO: Abrir modal de fechamento usando apenas vendas do caixa atual
  const handleCloseCash = async () => {
    // Permitir que qualquer usuário veja as informações de fechamento
    // A senha de gerente/admin será solicitada na confirmação
    
    // Verificar se há caixa aberto no localStorage
    const cash = JSON.parse(localStorage.getItem('currentCashRegister') || 'null');
    if (!cash) {
      alert('Não há caixa aberto para fechar. Abra o caixa primeiro.');
      return;
    }
    
    // Buscar vendas apenas do caixa atual (usar banco local `db`)
    const allSales = db.sales.list();
    const salesOfCurrentCash = Array.isArray(allSales) ? allSales.filter(s => s.cashRegisterId === cash.id && s.status !== 'cancelled' && s.status !== 'canceled') : [];
    const cancelledOfCurrentCash = Array.isArray(allSales) ? allSales.filter(
      s => (s.status === 'cancelled' || s.status === 'canceled') && s.cashRegisterId === cash.id
    ) : [];

    const userLookup = db.users.list().reduce((acc, u) => {
      acc[u.id] = u.name || u.cpf || u.email || 'Caixa';
      return acc;
    }, {});

    // Calcular totais apenas com vendas do caixa atual
    const paymentMethods = {};
    let totalSales = 0;
    let totalDiscounts = 0;
    let totalCosts = 0;

    salesOfCurrentCash.forEach(sale => {
      const method = sale.payment_method || 'money';
      if (!paymentMethods[method]) {
        paymentMethods[method] = 0;
      }
      paymentMethods[method] += sale.total_amount;
      totalSales += sale.total_amount;
      totalDiscounts += sale.discount || 0;

      sale.items?.forEach(item => {
        const product = db.products.list().find(p => p.id === item.product_id);
        if (product && product.costPrice) {
          totalCosts += (product.costPrice * item.quantity);
        }
      });
    });

    cancelledOfCurrentCash.forEach(sale => {
      totalSales -= sale.total_amount;
      const method = sale.payment_method || 'money';
      if (paymentMethods[method]) {
        paymentMethods[method] -= sale.total_amount;
      }
    });

    const today = new Date();
    const dayExpenses = db.expenses.list().filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
    });
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    // Lucro Bruto: Vendas - Abertura - Custos
    const grossProfit = totalSales - cash.openingValue - totalCosts;
    // Valor final no caixa agora considera custos em vez de despesas
    const finalCashAmount = cash.openingValue + totalSales - totalCosts;

    const cashiers = buildCashierBreakdown(salesOfCurrentCash, cancelledOfCurrentCash, userLookup);

    // Preparar dados do fechamento
    const closureData = {
      date: today.toISOString(),
      sales: salesOfCurrentCash,
      cancelled: cancelledOfCurrentCash,
      totalSales,
      totalCosts,
      totalExpenses,
      totalDiscounts,
      grossProfit,
      paymentMethods,
      openingAmount: cash.openingValue,
      finalCashAmount,
      cashRegisterId: cash.id,
      cashiers
    };

    setClosureData(closureData);
    setClosurePassword("");
    setClosureError("");
    setSelectedClosureManagerId("");

    // Carregar gerentes/admins disponíveis da mesma loja quando o usuário é caixa
    if (user.role === 'caixa') {
      try {
        const storeId = user.store_id || user.tenantId;
        if (!storeId) {
          console.warn('[handleCloseCash] Store ID não definido para o usuário.');
          setAvailableClosureManagers([]);
        } else {
          const { data: managers, error: managersError } = await supabase
            .from('users')
            .select('id, name, email, role, password_hash, store_id')
            .eq('store_id', storeId)
            .eq('active', true);

          if (managersError) {
            console.error('[handleCloseCash] Erro ao buscar gerentes/admins:', managersError);
            setAvailableClosureManagers([]);
          } else {
            const authorizedUsers = (managers || []).filter(m =>
              m.role === 'admin' || m.role === 'gerente'
            );
            setAvailableClosureManagers(authorizedUsers);
          }
        }
      } catch (error) {
        console.error('[handleCloseCash] Erro inesperado ao carregar gerentes/admins:', error);
        setAvailableClosureManagers([]);
      }
    } else {
      setAvailableClosureManagers([]);
    }

    setShowPasswordModal(true);
  };

  // REFATORAÇÃO: Fechamento usando apenas vendas do caixa atual
  // Atualizado para sincronizar vendas pendentes, gerar PDF, upload e salvar no Supabase
  const confirmCloseCash = async () => {
    if (!closurePassword) {
      setClosureError("Digite a senha de gerente ou administrador");
      return;
    }

    let passwordValid = false;
    let authorizedUser = null;
    
    // Se o usuário logado já é gerente/admin, verificar sua própria senha
    if (user.role === 'admin' || user.role === 'gerente') {
      if (user?.email && user?.id) {
        try {
          // Verificar senha usando Supabase Auth
          const { error: authError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: closurePassword
          });
          
          if (!authError) {
            passwordValid = true;
            authorizedUser = user;
          } else {
            setClosureError("Senha incorreta.");
            return;
          }
        } catch (error) {
          console.error('[confirmCloseCash] Erro ao verificar senha:', error);
          setClosureError("Erro ao verificar senha. Tente novamente.");
          return;
        }
      } else {
        // Fallback para localStorage
        const users = db.users.list();
        const foundUser = users.find(u => 
          u.id === user?.id && 
          u.password === closurePassword
        );
        
        if (foundUser) {
          passwordValid = true;
          authorizedUser = foundUser;
        } else {
          setClosureError("Senha incorreta.");
          return;
        }
      }
    } else {
      // Se for caixa, usar lista de gerentes/admins carregada e exigir seleção
      try {
        if (!selectedClosureManagerId) {
          setClosureError("Selecione o gerente ou administrador.");
          return;
        }

        const selectedManager = availableClosureManagers.find(m => m.id === selectedClosureManagerId);
        if (!selectedManager) {
          setClosureError("Gerente/administrador selecionado inválido.");
          return;
        }

        if (selectedManager.password_hash && selectedManager.password_hash === closurePassword) {
          passwordValid = true;
          authorizedUser = selectedManager;
        } else {
          setClosureError("Senha incorreta para o usuário selecionado.");
          return;
        }
      } catch (error) {
        console.error('[confirmCloseCash] Erro ao validar senha:', error);
        setClosureError("Erro ao validar senha. Tente novamente.");
        return;
      }
    }

    if (!passwordValid) {
      setClosureError("Apenas gerente ou admin podem fechar o caixa.");
      return;
    }

    // ============================================
    // 1. SINCRONIZAR VENDAS PENDENTES ANTES DE FECHAR
    // ============================================
    setClosureError("Sincronizando vendas pendentes...");
    try {
      const syncResult = await syncPendingSalesQueue();
      console.log(`[confirmCloseCash] Sincronização: ${syncResult.synced} sincronizadas, ${syncResult.errors} com erro`);
    } catch (error) {
      console.error('[confirmCloseCash] Erro ao sincronizar vendas pendentes:', error);
      // Continuar mesmo se houver erro na sincronização
    }

    // Obter caixa atual do localStorage
    const cash = JSON.parse(localStorage.getItem('currentCashRegister') || 'null');
    if (!cash) {
      alert('Erro: Nenhum caixa aberto encontrado.');
      return;
    }

    // ============================================
    // BUSCAR VENDAS DO SUPABASE + LOCALSTORAGE
    // ============================================
    const today = new Date();
    let salesOfCurrentCash = [];
    let cancelledOfCurrentCash = [];
    
    try {
      const storeId = resolveStoreId();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      console.log('[confirmCloseCash] Buscando vendas do Supabase...');
      console.log('[confirmCloseCash] Store ID:', storeId);
      console.log('[confirmCloseCash] Período:', startOfDay, 'até', endOfDay);
      
      // Buscar vendas do dia do Supabase
      const { data: supabaseSales, error } = await supabase
        .from('sales')
        .select('*')
        .eq('store_id', storeId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[confirmCloseCash] Erro ao buscar vendas do Supabase:', error);
      } else {
        console.log('[confirmCloseCash] Vendas encontradas no Supabase:', supabaseSales?.length || 0);
        
        // Separar vendas normais e canceladas
        salesOfCurrentCash = supabaseSales.filter(s => 
          s.status !== 'cancelled' && s.status !== 'canceled'
        ) || [];
        
        cancelledOfCurrentCash = supabaseSales.filter(s => 
          s.status === 'cancelled' || s.status === 'canceled'
        ) || [];
        
        console.log('[confirmCloseCash] Vendas ativas:', salesOfCurrentCash.length);
        console.log('[confirmCloseCash] Vendas canceladas:', cancelledOfCurrentCash.length);
      }
    } catch (error) {
      console.error('[confirmCloseCash] Erro ao buscar vendas:', error);
      
      // Fallback: buscar do localStorage se houver erro no Supabase
      console.log('[confirmCloseCash] Usando fallback do localStorage...');
      const allSales = JSON.parse(localStorage.getItem('sales') || '[]');
      salesOfCurrentCash = allSales.filter(s => 
        s.cashRegisterId === cash.id && 
        s.status !== 'cancelled' && 
        s.status !== 'canceled'
      );
      cancelledOfCurrentCash = allSales.filter(
        s => (s.status === 'cancelled' || s.status === 'canceled') && s.cashRegisterId === cash.id
      );
    }

    // Calcular totais apenas com vendas do caixa atual
    const paymentMethods = {};
    let totalSales = 0;
    let totalDiscounts = 0;
    let totalCosts = 0;

    // Buscar produtos do Supabase para cálculo de custos
    let productsMap = {};
    try {
      const storeId = resolveStoreId();
      const { data: supabaseProducts } = await supabase
        .from('products')
        .select('id, cost_price, costPrice')
        .eq('store_id', storeId);
      
      if (supabaseProducts) {
        supabaseProducts.forEach(p => {
          productsMap[p.id] = p.cost_price || p.costPrice || 0;
        });
        console.log('[confirmCloseCash] ✅ Produtos carregados:', Object.keys(productsMap).length);
        console.log('[confirmCloseCash] 📦 Mapa de Produtos:', productsMap);
      }
    } catch (error) {
      console.error('[confirmCloseCash] Erro ao buscar produtos:', error);
      // Fallback para localStorage
      const localProducts = db.products.list();
      localProducts.forEach(p => {
        productsMap[p.id] = p.cost_price || p.costPrice || 0;
      });
      console.log('[confirmCloseCash] ⚠️ Usando fallback localStorage, produtos:', Object.keys(productsMap).length);
    }

    salesOfCurrentCash.forEach(sale => {
      const method = sale.payment_method || 'money';
      if (!paymentMethods[method]) {
        paymentMethods[method] = 0;
      }
      
      const saleAmount = sale.total_amount || sale.totalAmount || 0;
      paymentMethods[method] += saleAmount;
      totalSales += saleAmount;
      totalDiscounts += sale.discount || 0;

      // Calcular custos dos itens vendidos
      const items = sale.items || [];
      console.log(`[confirmCloseCash] 🧾 Venda ${sale.id}: ${items.length} itens`);
      items.forEach(item => {
        const costPrice = productsMap[item.product_id] || 0;
        const itemCost = costPrice * item.quantity;
        console.log(`[confirmCloseCash]   - Produto ${item.product_id}: custo unitário R$ ${costPrice}, qtd ${item.quantity}, subtotal R$ ${itemCost}`);
        totalCosts += itemCost;
      });
    });
    console.log(`[confirmCloseCash] 💰 Total de Custos Calculado: R$ ${totalCosts}`);

    // Descontar cancelamentos
    cancelledOfCurrentCash.forEach(sale => {
      const saleAmount = sale.total_amount || sale.totalAmount || 0;
      totalSales -= saleAmount;
      const method = sale.payment_method || 'money';
      if (paymentMethods[method]) {
        paymentMethods[method] -= saleAmount;
      }
    });

    // Calcular despesas do dia do Supabase
    let dayExpenses = [];
    try {
      const storeId = resolveStoreId();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      const { data: supabaseExpenses, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('store_id', storeId)
        .gte('date', startOfDay)
        .lte('date', endOfDay);
      
      if (error) {
        console.error('[confirmCloseCash] Erro ao buscar despesas:', error);
        // Fallback para localStorage
        const allExpenses = db.expenses.list();
        dayExpenses = allExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
        });
      } else {
        dayExpenses = supabaseExpenses || [];
        console.log('[confirmCloseCash] Despesas encontradas:', dayExpenses.length);
      }
    } catch (error) {
      console.error('[confirmCloseCash] Erro ao buscar despesas:', error);
      const allExpenses = db.expenses.list();
      dayExpenses = allExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
      });
    }
    
    const totalExpenses = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Lucro Bruto: Vendas - Abertura - Custos
    const grossProfit = totalSales - cash.openingValue - totalCosts;

    // Valor final no caixa = Abertura + Vendas - Custos
    const finalCashAmount = cash.openingValue + totalSales - totalCosts;

    // ============================================
    // 2. GERAR RESUMO
    // ============================================
    const totals = {
      totalSales,
      totalCosts,
      totalExpenses,
      totalDiscounts,
      grossProfit,
      paymentMethods,
      openingAmount: cash.openingValue,
      finalCashAmount,
      salesCount: salesOfCurrentCash.length,
      cancelledCount: cancelledOfCurrentCash.length,
      expensesCount: dayExpenses.length,
    };

    // Criar relatório local
    const report = {
      id: Date.now(),
      cashRegisterId: cash.id,
      openingValue: cash.openingValue,
      openedAt: cash.openedAt,
      closedAt: new Date().toISOString(),
      sales: salesOfCurrentCash,
      cancelled: cancelledOfCurrentCash,
      ...totals,
      created_by: user?.name || user?.email || 'Sistema',
      date: today.toISOString()
    };

    // Salvar relatório no localStorage
    const existingReports = JSON.parse(localStorage.getItem('reports') || '[]');
    localStorage.setItem('reports', JSON.stringify([...existingReports, report]));

    // Salvar também no banco local para compatibilidade
    const closureData = {
      date: today.toISOString(),
      sales: salesOfCurrentCash,
      cancelled: cancelledOfCurrentCash,
      cashRegisterId: cash.id,
      // Adicionar todos os campos com os nomes corretos que o PDF espera
      openingAmount: cash.openingValue,
      totalSales: totalSales,
      totalCosts: totalCosts,
      totalExpenses: totalExpenses,
      totalDiscounts: totalDiscounts,
      grossProfit: grossProfit,
      finalCashAmount: finalCashAmount,
      paymentMethods: paymentMethods,
      salesCount: salesOfCurrentCash.length,
      cancelledCount: cancelledOfCurrentCash.length,
      expensesCount: dayExpenses.length,
      expenses: dayExpenses,
      created_by: user?.name || user?.email || 'Sistema',
      created_at: today.toISOString()
    };
    // ============================================
    // 3. GERAR PDF
    // ============================================
    setClosureError("Gerando PDF do fechamento...");
    let pdfPath = null;
    
    try {
      // Gerar PDF usando a função existente (gera e imprime)
      generateClosurePDF(closureData);
      
      // Criar nome do arquivo para referência
      const closureDate = format(today, "dd-MM-yyyy");
      const closureTime = format(today, "HH-mm");
      const managerName = (user?.name || user?.email || 'Sistema').replace(/[^a-z0-9]/gi, '_');
      const fileName = `fechamento_${closureDate}_${closureTime}_${managerName}.pdf`;
      
      // Definir caminho para referência (em produção, fazer upload real do PDF gerado)
      pdfPath = `closures/${fileName}`;
      
      console.log('[confirmCloseCash] PDF gerado:', pdfPath);
      
      // TODO: Em produção, capturar o PDF gerado e fazer upload real
      // Por enquanto, apenas registrar o caminho
    } catch (error) {
      console.error('[confirmCloseCash] Erro ao gerar PDF:', error);
      // Continuar mesmo se houver erro ao gerar PDF
    }

    // ============================================
    // 4. UPLOAD PARA SUPABASE STORAGE (OPCIONAL)
    // ============================================
    // Nota: O upload real do PDF requer captura do arquivo gerado
    // Por enquanto, apenas registramos o caminho esperado
    if (pdfPath) {
      setClosureError("Preparando upload do PDF...");
      
      try {
        const storeId = resolveStoreId();
        
        // TODO: Em produção, fazer upload real do PDF
        // Por enquanto, apenas registrar o caminho
        console.log('[confirmCloseCash] Caminho do PDF para upload:', pdfPath);
        
        // Exemplo de como seria o upload (comentado até implementar captura do PDF):
        /*
        const pdfBlob = await capturePDF(); // Função a ser implementada
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('closures')
          .upload(pdfPath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });
        
        if (uploadError) {
          console.warn('[confirmCloseCash] Erro ao fazer upload do PDF:', uploadError);
        } else {
          pdfPath = uploadData.path;
        }
        */
      } catch (error) {
        console.error('[confirmCloseCash] Erro ao preparar upload do PDF:', error);
        // Continuar mesmo se houver erro
      }
    }

    // ============================================
    // 5. INSERIR REGISTRO NA TABELA closures
    // ============================================
    setClosureError("Salvando fechamento no servidor...");
    
    try {
      const storeId = resolveStoreId();
      
      // Buscar cash_session_id do Supabase
      let cashSessionId = null;
      try {
        const { data: session } = await supabase
          .from('cash_sessions')
          .select('id')
          .eq('store_id', storeId)
          .eq('status', 'open')
          .maybeSingle();
        
        cashSessionId = session?.id || null;
      } catch (e) {
        console.warn('[confirmCloseCash] Erro ao buscar cash_session_id:', e);
      }
      
      const closurePayload = {
        date: today.toISOString(),
        cash_session_id: cashSessionId || cash.id?.toString?.(),
        cashSessionId: cashSessionId || cash.id?.toString?.(),
        cashRegisterId: cash.id,
        openingAmount: cash.openingValue || 0,
        totalSales: totalSales || 0,
        totalCosts: totalCosts || 0,
        totalExpenses: totalExpenses || 0,
        totalDiscounts: totalDiscounts || 0,
        grossProfit: grossProfit || 0,
        finalCashAmount: finalCashAmount || 0,
        paymentMethods: paymentMethods || {},
        sales: salesOfCurrentCash || [],
        cancelled: cancelledOfCurrentCash || [],
        expenses: dayExpenses || [],
        salesCount: salesOfCurrentCash.length || 0,
        cancelledCount: cancelledOfCurrentCash.length || 0,
        expensesCount: dayExpenses.length || 0,
        totals: totals,
        pdfPath: pdfPath,
      };

      const { supabaseDB } = await import('./services/supabaseDB.js');
      const closureRecord = await supabaseDB.closures.create(closurePayload, user);
      
      console.log('[confirmCloseCash] ✅ Fechamento salvo no Supabase com TODOS os dados!');
      console.log('[confirmCloseCash] 📊 Resumo do fechamento:');
      console.log('[confirmCloseCash] - ID:', closureRecord.id);
      console.log('[confirmCloseCash] - Data:', closureRecord.date);
      console.log('[confirmCloseCash] - Abertura: R$', closureRecord.opening_amount);
      console.log('[confirmCloseCash] - Total Vendas: R$', closureRecord.total_sales);
      console.log('[confirmCloseCash] - Total Custos: R$', closureRecord.total_costs);
      console.log('[confirmCloseCash] - Total Despesas: R$', closureRecord.total_expenses);
      console.log('[confirmCloseCash] - Descontos: R$', closureRecord.total_discounts);
      console.log('[confirmCloseCash] - Lucro Bruto: R$', closureRecord.gross_profit);
      console.log('[confirmCloseCash] - Valor Final: R$', closureRecord.final_cash_amount);
      console.log('[confirmCloseCash] - Vendas Realizadas:', closureRecord.sales_count);
      console.log('[confirmCloseCash] - Vendas Canceladas:', closureRecord.cancelled_count);
      console.log('[confirmCloseCash] - Despesas Registradas:', closureRecord.expenses_count);
      console.log('[confirmCloseCash] - Métodos de pagamento:', Object.keys(closureRecord.payment_methods || {}));
    } catch (error) {
      console.error('[confirmCloseCash] Erro ao inserir fechamento:', error);
      try {
        // Fallback local para não perder o fechamento
        db.closures.create({
          date: today.toISOString(),
          sales: salesOfCurrentCash,
          cancelled: cancelledOfCurrentCash,
          expenses: dayExpenses,
          openingAmount: cash.openingValue || 0,
          totalSales: totalSales || 0,
          totalCosts: totalCosts || 0,
          totalExpenses: totalExpenses || 0,
          totalDiscounts: totalDiscounts || 0,
          grossProfit: grossProfit || 0,
          finalCashAmount: finalCashAmount || 0,
          paymentMethods: paymentMethods || {},
          salesCount: salesOfCurrentCash.length || 0,
          cancelledCount: cancelledOfCurrentCash.length || 0,
          expensesCount: dayExpenses.length || 0,
          totals: totals,
          pdfPath: pdfPath,
          cashRegisterId: cash.id,
        }, user);
        console.warn('[confirmCloseCash] Fechamento salvo localmente (fallback).');
      } catch (fallbackError) {
        console.error('[confirmCloseCash] Falhou também o fallback local:', fallbackError);
      }
      // Continuar mesmo se houver erro
    }

    // ============================================
    // 6. LIMPAR SESSÃO DE CAIXA LOCAL
    // ============================================
    localStorage.removeItem('currentCashRegister');
    setCurrentCashOpening(null);
    
    // Fechar o modal
    setShowPasswordModal(false);
    setClosurePassword("");
    setClosureError("");
    setClosureData(null);

    // Atualizar vendas (vai limpar a lista já que não há caixa aberto)
    refreshSales();
    
    // Mostrar mensagem de sucesso
    alert(`Caixa fechado com sucesso!\n\nValor Final: ${formatCurrency(finalCashAmount)}\nTotal de Vendas: ${formatCurrency(totalSales)}\nLucro: ${formatCurrency(grossProfit)}\n\nO relatório foi salvo e sincronizado.`);
  };

  // Exportar fechamento
  const exportClosure = (closure) => {
    const closureDate = closure.date ? format(new Date(closure.date), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy");
    const closureTime = format(new Date(closure.created_at || new Date()), "HH:mm");
    // Preferir nome resolvido (vindo do SBD) e depois fallback para usuários locais
    let managerName = closure.created_by_name || closure.created_by || 'Sistema';
    try {
      if (!closure.created_by_name) {
        const usersList = db.users.list() || [];
        const found = usersList.find(u => u.id === closure.created_by || u.email === closure.created_by || u.tenantId === closure.created_by || u.store_id === closure.created_by || u.storeId === closure.created_by);
        if (found && found.name) managerName = found.name;
      }
    } catch (e) {
      // keep fallback
    }
    
    // CORREÇÃO: Contar fechamentos do mesmo dia para numeração sequencial
    const allClosures = db.closures.list();
    const dayClosures = allClosures.filter(c => {
      const cDate = new Date(c.date);
      const closureDateObj = new Date(closure.date);
      return cDate.toISOString().split('T')[0] === closureDateObj.toISOString().split('T')[0];
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    const closureIndex = dayClosures.findIndex(c => c.id === closure.id) + 1;
    const numberSuffix = dayClosures.length > 1 ? ` [${closureIndex}]` : '';
    
    // Nome do arquivo: DD/MM/YYYY [n] - NOME DA GERENTE - HORA DE FECHAMENTO
    const fileName = `${closureDate}${numberSuffix} - ${managerName} - ${closureTime}`;
    
    let content = `FECHAMENTO DE CAIXA - ${closureDate}\n`;
    content += `==========================================\n\n`;
    content += `Data: ${closureDate}\n`;
    content += `Fechado por: ${managerName}\n`;
    content += `Hora do Fechamento: ${closureTime}\n\n`;
    
    content += `RESUMO FINANCEIRO\n`;
    content += `------------------\n`;
    content += `Abertura do Caixa: ${formatCurrency(closure.openingAmount || 0)}\n`;
    content += `Total de Vendas: ${formatCurrency(closure.totalSales || 0)}\n`;
    content += `Total de Custos: ${formatCurrency(closure.totalCosts || 0)}\n`;
    content += `Lucro Bruto: ${formatCurrency(closure.grossProfit || 0)}\n`;
    content += `Descontos Aplicados: ${formatCurrency(closure.totalDiscounts || 0)}\n`;
    content += `\n`;
    content += `VALOR FINAL NO CAIXA\n`;
    content += `---------------------\n`;
    content += `Valor Final: ${formatCurrency(closure.finalCashAmount || 0)}\n`;
    content += `Cálculo: Abertura (${formatCurrency(closure.openingAmount || 0)}) + `;
    content += `Vendas (${formatCurrency(closure.totalSales || 0)}) - `;
    content += `Custos (${formatCurrency(closure.totalCosts || 0)}) = `;
    content += `${formatCurrency(closure.finalCashAmount || 0)}\n`;
    content += `\n`;
    
    content += `MÉTODOS DE PAGAMENTO\n`;
    content += `-------------------\n`;
    Object.entries(closure.paymentMethods || {}).forEach(([method, amount]) => {
      content += `${formatPaymentMethod(method)}: ${formatCurrency(amount)}\n`;
    });
    content += `\n`;
    
    content += `VENDAS REALIZADAS: ${closure.sales?.length || 0}\n`;
    content += `VENDAS CANCELADAS: ${closure.cancelled?.length || 0}\n`;
    content += `DESPESAS REGISTRADAS: ${closure.expenses?.length || 0}\n\n`;
    
    if (closure.sales && closure.sales.length > 0) {
      content += `LISTA DE VENDAS\n`;
      content += `---------------\n`;
      closure.sales.forEach((sale, idx) => {
        content += `${idx + 1}. #${sale.id.slice(0, 8).toUpperCase()} - ${format(new Date(sale.sale_date), "HH:mm")} - ${formatPaymentMethod(sale.payment_method)} - ${formatCurrency(sale.total_amount)}\n`;
      });
      content += `\n`;
    }
    
    if (closure.cancelled && closure.cancelled.length > 0) {
      content += `LISTA DE CANCELAMENTOS\n`;
      content += `----------------------\n`;
      closure.cancelled.forEach((sale, idx) => {
        content += `${idx + 1}. #${sale.id.slice(0, 8).toUpperCase()} - ${format(new Date(sale.sale_date), "HH:mm")} - ${formatCurrency(sale.total_amount)}\n`;
      });
    }
    
    // Criar e baixar arquivo
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.txt`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button 
            variant={tab === "finalized" ? "primary" : "outline"} 
            onClick={() => setTab("finalized")} 
            className="rounded-full"
          >
            <FileText size={18} className="mr-2"/> Finalizadas ({finalizedSales.length})
          </Button>
          <Button 
            variant={tab === "cancelled" ? "primary" : "outline"} 
            onClick={() => setTab("cancelled")} 
            className="rounded-full"
          >
            <FileText size={18} className="mr-2"/> Canceladas ({cancelledSales.length})
          </Button>
        </div>
        
        {/* Botões de Caixa */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={handleOpenCash}
          >
            <DollarSign size={18} className="mr-2"/> {currentCashOpening ? "Caixa Aberto" : "Abrir Caixa"}
          </Button>
          {currentCashOpening && !currentCashOpening.closed && (
            <Button
              variant="outline"
              className="rounded-full bg-blue-50 border-blue-300 hover:bg-blue-100"
              onClick={handleAddResource}
            >
              <DollarSign size={18} className="mr-2"/> Recursos
            </Button>
          )}
          {(user.role === 'gerente' || user.role === 'admin' || user.role === 'caixa') && currentCashOpening && !currentCashOpening.closed && (
            <Button
              variant="primary"
              className="rounded-full"
              onClick={handleCloseCash}
            >
              <DollarSign size={18} className="mr-2"/> Fechar Caixa
            </Button>
          )}
        </div>
      </div>

      {/* Card de Informações do Caixa - Só mostra se o caixa estiver aberto (não fechado) */}
      {currentCashOpening && !currentCashOpening.closed && (
        <Card className="p-4 rounded-xl bg-green-50 border-green-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600 mb-1">Caixa Aberto em</p>
              <p className="text-lg font-bold">
                {(() => {
                  const rawDate = currentCashOpening.openedAt || currentCashOpening.date;
                  if (!rawDate) return "";
                  const d = new Date(rawDate);
                  if (isNaN(d.getTime())) return "";
                  return format(d, "dd/MM/yyyy");
                })()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Valor de Abertura</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(currentCashOpening.openingValue || currentCashOpening.amount || 0)}
              </p>
            </div>
          </div>
        </Card>
      )}


      {tab === "finalized" && (
        <div>
          {finalizedSales.length === 0 ? (
            <Card className="p-8 text-center rounded-xl">
              <p className="text-gray-500">Nenhuma venda finalizada ainda</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {finalizedSales.map(sale => (
                <div key={sale.id}>
                  {renderSaleItem(sale)}
                  {/* Qualquer usuário pode cancelar vendas, mas precisa de senha de gerente/admin */}
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="danger"
                      className="rounded-full text-sm"
                      onClick={() => handleCancelSale(sale)}
                    >
                      <Trash2 size={14} className="mr-1"/> Cancelar Venda
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "cancelled" && (
        <div>
          {cancelledSales.length === 0 ? (
            <Card className="p-8 text-center rounded-xl">
              <p className="text-gray-500">Nenhuma venda cancelada</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {cancelledSales.map(sale => renderSaleItem(sale))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Adicionar Recursos */}
      {showAddResourceModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddResourceModal(false);
              setResourceAmount("");
            }
          }}
        >
          <Card className="w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">+ Adicionar Recursos</h2>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setShowAddResourceModal(false);
                  setResourceAmount("");
                }}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>Valor atual no caixa:</strong>
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {formatCurrency(currentCashOpening?.openingValue || 0)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Valor a Adicionar (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={resourceAmount}
                  onChange={(e) => setResourceAmount(e.target.value)}
                  className="w-full rounded-lg"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite o valor dos recursos que serão adicionados ao caixa (ex: moedas para troco)
                </p>
              </div>

              {resourceAmount && !isNaN(parseFloat(resourceAmount)) && parseFloat(resourceAmount) > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-700">
                    <strong>Novo valor total no caixa:</strong>
                  </p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {formatCurrency((currentCashOpening?.openingValue || 0) + parseFloat(resourceAmount))}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => {
                    setShowAddResourceModal(false);
                    setResourceAmount("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 rounded-full"
                  onClick={confirmAddResource}
                >
                  Adicionar Recurso
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Abertura de Caixa */}
      {showOpenCashModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowOpenCashModal(false);
              setCashOpeningAmount("");
            }
          }}
        >
          <Card className="w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Abrir Caixa</h2>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setShowOpenCashModal(false);
                  setCashOpeningAmount("");
                }}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Data do Caixa
                </label>
                <Input
                  type="text"
                  value={format(new Date(), "dd/MM/yyyy")}
                  disabled
                  className="w-full rounded-lg bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Valor Inicial no Caixa (R$) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cashOpeningAmount}
                  onChange={(e) => setCashOpeningAmount(e.target.value)}
                  className="w-full rounded-lg"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite o valor que está disponível no caixa no início do dia
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => {
                    setShowOpenCashModal(false);
                    setCashOpeningAmount("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 rounded-full"
                  onClick={confirmOpenCash}
                >
                  {loadingProducts ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Carregando produtos...
                    </div>
                  ) : (
                    'Abrir Caixa'
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Fechamento de Caixa com Resumo Completo */}
      {showPasswordModal && closureData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPasswordModal(false);
              setClosurePassword("");
              setClosureError("");
              setClosureData(null);
            }
          }}
        >
          <Card className="w-full max-w-4xl p-6 rounded-2xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Fechar Caixa</h2>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setShowPasswordModal(false);
                  setClosurePassword("");
                  setClosureError("");
                  setClosureData(null);
                }}
              >
                ✕
              </Button>
            </div>

            {/* Resumo Completo do Dia */}
            <div className="mb-6 space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Data do Fechamento</p>
                <p className="text-2xl font-bold">{format(new Date(closureData.date), "dd/MM/yyyy")}</p>
              </div>

              {/* Resumo Financeiro */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="p-4 rounded-xl bg-[#d9b53f]/10">
                  <p className="text-xs text-gray-600 mb-1">Abertura do Caixa</p>
                  <p className="text-xl font-bold text-[#d9b53f]">{formatCurrency(closureData.openingAmount || 0)}</p>
                </Card>
                <Card className="p-4 rounded-xl bg-green-50">
                  <p className="text-xs text-gray-600 mb-1">Total de Vendas</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(closureData.totalSales || 0)}</p>
                </Card>
                <Card className="p-4 rounded-xl bg-red-50">
                  <p className="text-xs text-gray-600 mb-1">Total de Custos</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(closureData.totalCosts || 0)}</p>
                </Card>
                <Card className="p-4 rounded-xl bg-[#d9b53f]/10">
                  <p className="text-xs text-gray-600 mb-1">Lucro Bruto</p>
                  <p className={`text-xl font-bold ${(closureData.grossProfit || 0) >= 0 ? 'text-[#d9b53f]' : 'text-red-600'}`}>
                    {formatCurrency(closureData.grossProfit || 0)}
                  </p>
                </Card>
                <Card className="p-4 rounded-xl bg-purple-50 col-span-2 md:col-span-4 border-2 border-purple-300">
                  <p className="text-xs text-gray-600 mb-1">Valor Final no Caixa</p>
                  <p className="text-2xl font-bold text-[#d9b53f]">
                    {formatCurrency(closureData.finalCashAmount || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Cálculo: Abertura ({formatCurrency(closureData.openingAmount || 0)}) + 
                    Vendas ({formatCurrency(closureData.totalSales || 0)}) - 
                    Custos ({formatCurrency(closureData.totalCosts || 0)}) = 
                    <strong className="text-purple-600"> {formatCurrency(closureData.finalCashAmount || 0)}</strong>
                  </p>
                </Card>
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-3 rounded-xl">
                  <p className="text-xs text-gray-600 mb-1">Vendas Realizadas</p>
                  <p className="text-2xl font-bold">{closureData.sales?.length || 0}</p>
                </Card>
                <Card className="p-3 rounded-xl">
                  <p className="text-xs text-gray-600 mb-1">Vendas Canceladas</p>
                  <p className="text-2xl font-bold text-red-600">{closureData.cancelled?.length || 0}</p>
                </Card>
                <Card className="p-3 rounded-xl">
                  <p className="text-xs text-gray-600 mb-1">Descontos Aplicados</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(closureData.totalDiscounts || 0)}</p>
                </Card>
              </div>

              {/* Métodos de Pagamento */}
              {Object.keys(closureData.paymentMethods || {}).length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3">Métodos de Pagamento</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(closureData.paymentMethods || {}).map(([method, amount]) => (
                      <Card key={method} className="p-3 rounded-xl">
                        <p className="text-xs text-gray-600 mb-1">{formatPaymentMethod(method)}</p>
                        <p className="text-lg font-bold">{formatCurrency(amount)}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Caixas */}
              {closureData.cashiers && closureData.cashiers.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-bold text-lg mb-3">Caixas</h3>
                  <div className="space-y-2">
                    {closureData.cashiers.map(cashier => (
                      <Card key={cashier.name} className="p-3 rounded-xl">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800">{cashier.name}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-600">
                              {Object.entries(cashier.methods || {}).map(([method, amount]) => (
                                <span key={method} className="bg-slate-100 px-2 py-1 rounded-full">
                                  {formatPaymentMethod(method)}: {formatCurrency(amount)}
                                </span>
                              ))}
                            </div>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{formatCurrency(cashier.total)}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Campo de Senha / Seleção de Gerente - Só mostrar se não for fechamento existente */}
            {!closureData.id && (
              <div className="border-t pt-4">
                {user.role === 'caixa' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Gerente ou Administrador responsável *
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={selectedClosureManagerId}
                      onChange={(e) => {
                        setSelectedClosureManagerId(e.target.value);
                        setClosureError("");
                      }}
                    >
                      <option value="">Selecione...</option>
                      {availableClosureManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} ({manager.role})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Escolha qual administrador ou gerente está autorizando este fechamento.
                    </p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Senha *
                  </label>
                  <Input
                    type="password"
                    placeholder="Digite a senha para confirmar o fechamento"
                    value={closurePassword}
                    onChange={(e) => {
                      setClosurePassword(e.target.value);
                      setClosureError("");
                    }}
                    className="w-full rounded-lg"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        confirmCloseCash();
                      }
                    }}
                  />
                  {closureError && (
                    <p className="text-red-500 text-xs mt-1">{closureError}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    É necessário a senha de gerente ou administrador para fechar o caixa.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setClosurePassword("");
                      setClosureError("");
                      setClosureData(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 rounded-full"
                    onClick={confirmCloseCash}
                  >
                    <DollarSign size={18} className="mr-2"/> Confirmar Fechamento
                  </Button>
                </div>
              </div>
            )}
            
            {/* Se for fechamento existente, mostrar botão para fechar */}
            {closureData.id && (
              <div className="border-t pt-4">
                <div className="bg-blue-50 p-4 rounded-xl mb-4">
                  <p className="text-sm text-blue-600">
                    Este caixa já foi fechado em {format(new Date(closureData.created_at), "dd/MM/yyyy HH:mm")} por {closureData.created_by}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setClosurePassword("");
                      setClosureError("");
                      setClosureData(null);
                    }}
                  >
                    Fechar
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 rounded-full"
                    onClick={() => navigate('/?tab=closures')}
                  >
                    Ver em Fechamentos
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {showCancelModal && selectedSale && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCancelModal(false);
              setSelectedSale(null);
              setCancelPassword("");
              setCancelError("");
            }
          }}
        >
          <Card className="w-full max-w-md p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Cancelar Venda</h2>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm font-medium mb-2">Venda #{selectedSale.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(selectedSale.total_amount)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {format(new Date(selectedSale.sale_date), "dd/MM/yyyy HH:mm")}
              </p>
            </div>

            {user.role === 'caixa' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Gerente ou Administrador responsável *
                </label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedManagerId}
                  onChange={(e) => {
                    setSelectedManagerId(e.target.value);
                    setCancelError("");
                  }}
                >
                  <option value="">Selecione...</option>
                  {availableManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.role})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Escolha qual administrador ou gerente está autorizando este cancelamento.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Senha *
              </label>
              <Input
                type="password"
                placeholder="Digite a senha"
                value={cancelPassword}
                onChange={(e) => {
                  setCancelPassword(e.target.value);
                  setCancelError("");
                }}
                className="w-full rounded-lg"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
              />
              {cancelError && (
                <p className="text-red-500 text-xs mt-1">{cancelError}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                É necessário a senha de gerente ou administrador para cancelar uma venda.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1 rounded-full"
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedSale(null);
                  setCancelPassword("");
                  setCancelError("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                className="flex-1 rounded-full"
                onClick={confirmCancel}
              >
                Confirmar Cancelamento
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// 4.5. Componente Online
function Online({ user }) {
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    refreshOrders();
  }, []);

  const refreshOrders = () => {
    const existing = db.onlineOrders.list() || [];
    setOrders(existing);
  };

  const updateOrderStatus = (orderId, newStatus) => {
    db.onlineOrders.update(orderId, { status: newStatus }, user);
    refreshOrders();
  };

  const filteredOrders = filterStatus === "all" 
    ? orders 
    : orders.filter(o => o.status === filterStatus);

  const getStatusColor = (status) => {
    switch(status) {
      case "aguardo": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "processo": return "bg-blue-100 text-blue-800 border-blue-300";
      case "entregue": return "bg-green-100 text-green-800 border-green-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case "aguardo": return "Em Aguardo";
      case "processo": return "Em Processo";
      case "entregue": return "Entregue";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-2xl font-bold">Pedidos Online</h2>
        <div className="flex gap-2">
          <Button 
            variant={filterStatus === "all" ? "primary" : "outline"} 
            onClick={() => setFilterStatus("all")}
            className="rounded-full text-sm"
          >
            Todos ({orders.length})
          </Button>
          <Button 
            variant={filterStatus === "aguardo" ? "primary" : "outline"} 
            onClick={() => setFilterStatus("aguardo")}
            className="rounded-full text-sm"
          >
            Aguardo ({orders.filter(o => o.status === "aguardo").length})
          </Button>
          <Button 
            variant={filterStatus === "processo" ? "primary" : "outline"} 
            onClick={() => setFilterStatus("processo")}
            className="rounded-full text-sm"
          >
            Processo ({orders.filter(o => o.status === "processo").length})
          </Button>
          <Button 
            variant={filterStatus === "entregue" ? "primary" : "outline"} 
            onClick={() => setFilterStatus("entregue")}
            className="rounded-full text-sm"
          >
            Entregue ({orders.filter(o => o.status === "entregue").length})
          </Button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <Card className="p-8 text-center rounded-xl">
          <Globe size={64} className="mx-auto mb-4 text-blue-500 opacity-50" />
          <h3 className="text-xl font-bold mb-2">Nenhum pedido encontrado</h3>
          <p className="text-gray-500">
            {filterStatus === "all" 
              ? "Aguardando pedidos da Shopify..." 
              : `Nenhum pedido com status "${getStatusLabel(filterStatus)}"`}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map(order => (
            <Card key={order.id} className="p-6 rounded-xl">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Imagem do Produto */}
                {order.productImage && (
                  <div className="flex-shrink-0">
                    <img 
                      src={order.productImage} 
                      alt={order.productName}
                      className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                  </div>
                )}

                <div className="flex-1 space-y-3">
                  {/* Header com Status */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold">{order.customerName || "Cliente"}</h3>
                      <p className="text-sm text-gray-500">
                        Pedido #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                      </p>
                      {order.isDemo && (
                        <p className="text-xs font-bold text-orange-600">Pedido de exemplo (mostruário)</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : ""}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  {/* Informações do Produto */}
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="font-medium text-sm mb-1">Produto</p>
                    <p className="text-sm">{order.productName || "Produto"}</p>
                    <p className="text-xs text-gray-500">Código: {order.productCode || "N/A"}</p>
                    <p className="text-xs text-gray-500">Quantidade: {order.quantity || 1}</p>
                  </div>

                  {/* Valor e Pagamento */}
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Valor Total</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(order.totalAmount || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Método de Pagamento</p>
                      <p className="text-sm font-medium">{order.paymentMethod || "N/A"}</p>
                    </div>
                  </div>

                  {/* Endereço de Entrega */}
                  {order.shippingAddress && (
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="font-medium text-sm mb-1 text-blue-700">Endereço de Entrega</p>
                      <p className="text-xs text-blue-600">
                        {typeof order.shippingAddress === 'string' 
                          ? order.shippingAddress 
                          : `
                            ${order.shippingAddress.street || ""} ${order.shippingAddress.number || ""}
                            ${order.shippingAddress.complement ? ` - ${order.shippingAddress.complement}` : ""}
                            ${order.shippingAddress.neighborhood ? `, ${order.shippingAddress.neighborhood}` : ""}
                            ${order.shippingAddress.city ? ` - ${order.shippingAddress.city}` : ""}
                            ${order.shippingAddress.state ? `/${order.shippingAddress.state}` : ""}
                            ${order.shippingAddress.zipCode ? ` - CEP: ${order.shippingAddress.zipCode}` : ""}
                          `.trim()}
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      className="rounded-full text-sm"
                      disabled={order.isDemo}
                      onClick={() => { if (!order.isDemo) printShippingLabel(order); }}
                    >
                      <Printer size={14} className="mr-1"/> Imprimir Etiqueta
                    </Button>
                    {!order.isDemo && order.status !== "aguardo" && (
                      <Button
                        variant="outline"
                        className="rounded-full text-sm"
                        onClick={() => updateOrderStatus(order.id, "aguardo")}
                      >
                        Marcar como Aguardo
                      </Button>
                    )}
                    {!order.isDemo && order.status !== "processo" && (
                      <Button
                        variant="outline"
                        className="rounded-full text-sm"
                        onClick={() => updateOrderStatus(order.id, "processo")}
                      >
                        Marcar como Processo
                      </Button>
                    )}
                    {!order.isDemo && order.status !== "entregue" && (
                      <Button
                        variant="primary"
                        className="rounded-full text-sm"
                        onClick={() => updateOrderStatus(order.id, "entregue")}
                      >
                        Marcar como Entregue
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// 5. App Principal (Rotas e Controle de Sessão)
// Componente de Teste do Supabase (temporário)
function TestSupabase() {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Não testado');

  const runTest = async () => {
    setLoading(true);
    setConnectionStatus('Testando...');
    
    try {
      const result = await testSupabaseConnection();
      setTestResult(result);
      
      if (result.success) {
        setConnectionStatus('✅ Conectado com sucesso!');
      } else {
        setConnectionStatus(`❌ Erro: ${result.error || 'Desconhecido'}`);
      }
    } catch (error) {
      setConnectionStatus(`❌ Erro: ${error.message}`);
      setTestResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Verificar chave API
  const apiKey = typeof import.meta !== 'undefined' 
    ? import.meta.env.VITE_SUPABASE_ANON_KEY 
    : process.env.SUPABASE_KEY;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">🧪 Teste de Conexão Supabase</h1>
        
        <div className="space-y-4">
          <div>
            <p className="font-semibold mb-2">Status da Chave API:</p>
            {apiKey ? (
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-green-700">✅ Chave encontrada</p>
                <p className="text-xs text-gray-600 mt-1">
                  Primeiros 20 caracteres: {apiKey.substring(0, 20)}...
                </p>
              </div>
            ) : (
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-red-700">❌ Chave não encontrada!</p>
                <p className="text-xs text-gray-600 mt-1">
                  Configure VITE_SUPABASE_ANON_KEY no arquivo .env.local
                </p>
              </div>
            )}
          </div>

          <div>
            <p className="font-semibold mb-2">Status da Conexão:</p>
            <p className={`p-3 rounded-lg ${
              connectionStatus.includes('✅') ? 'bg-green-50 text-green-700' :
              connectionStatus.includes('❌') ? 'bg-red-50 text-red-700' :
              'bg-yellow-50 text-yellow-700'
            }`}>
              {connectionStatus}
            </p>
          </div>

          <Button 
            onClick={runTest} 
            disabled={loading || !apiKey}
            className="w-full"
          >
            {loading ? 'Testando...' : '🔍 Executar Teste de Conexão'}
          </Button>

          {testResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-semibold mb-2">Resultado Detalhado:</p>
              <pre className="text-xs overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>📝 Nota:</strong> Este é um componente de teste temporário. 
              Após verificar a conexão, você pode remover esta rota.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  // --- CORREÇÃO DE EMERGÊNCIA (COLE ISSO NO INÍCIO DO COMPONENTE APP) ---
  const [pendingSalesCountState, setPendingSalesCountState] = useState(0);
  const [manualSyncPending, setManualSyncPending] = useState(false);
  // ----------------------------------------------------------------------

  // Sincroniza manualmente a fila offline; evita ReferenceError e falhas silenciosas
  const handleManualSyncPending = useCallback(async () => {
    if (manualSyncPending) return;
    setManualSyncPending(true);
    try {
      await syncPendingSalesQueue();
      const count = await getPendingSalesCount();
      setPendingSalesCountState(count ?? 0);
    } catch (e) {
      console.error('[App] Erro ao sincronizar fila offline:', e);
      setError('Falha ao sincronizar vendas offline. Tente novamente.');
    } finally {
      setManualSyncPending(false);
    }
  }, [manualSyncPending]);

  // Efeito para persistir sessão se recarregar a página (opcional, aqui simplificado)
  // Se quiser que o login "caia" ao dar F5, remova este useEffect.
  
  // Carregar usuário do localStorage ao iniciar (persistência de sessão)
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('mozyc_pdv_current_user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        // Validar se o usuário ainda existe no banco
        const allUsers = db.users.list();
        const validUser = allUsers.find(u => 
          (u.id === user.id) || 
          (u.email && user.email && u.email === user.email) ||
          (u.cpf && user.cpf && u.cpf === user.cpf)
        );
        if (validUser && validUser.active !== false) {
          // Atualizar dados do usuário
          Object.assign(validUser, {
            tenantId: user.tenantId || (validUser.role === 'admin' && validUser.email 
              ? validUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
              : user.tenantId || 'default')
          });
          setCurrentUser(validUser);
        } else {
          localStorage.removeItem('mozyc_pdv_current_user');
        }
      }
    } catch (e) {
      // Erro ao carregar, ignora
    }
  }, []);

  // Verificar periodicamente se o usuário foi desativado (apenas para usuários do Supabase)
  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      return; // Apenas verificar para usuários do Supabase (com email)
    }

    const checkUserStatus = async () => {
      try {
        const { supabase } = await import('./services/supabaseClient');
        const { data: profile, error } = await supabase
          .from('users')
          .select('id, active, email')
          .eq('email', currentUser.email)
          .maybeSingle();

        if (!error && profile) {
          // Se o usuário foi desativado, fazer logout
          if (profile.active === false) {
            console.log('[App] Usuário foi desativado, fazendo logout automático...');
            // Fazer logout do Supabase
            await supabase.auth.signOut();
            // Limpar localStorage
            localStorage.removeItem('mozyc_pdv_current_user');
            localStorage.removeItem('mozyc_pdv_saved_credentials');
            // Limpar estado
            setCurrentUser(null);
            setError('Sua conta está temporariamente desativada. Entre em contato com o suporte.');
            // Redirecionar para login
            window.location.hash = '#/login';
          }
        }
      } catch (err) {
        // Ignorar erros silenciosamente (pode ser problema de conexão)
        console.log('[App] Erro ao verificar status do usuário (não crítico):', err);
      }
    };

    // Verificar a cada 30 segundos
    const interval = setInterval(checkUserStatus, 30000);
    
    // Verificar quando a janela ganha foco
    const handleFocus = () => {
      checkUserStatus();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser]);

  // Função para lidar com login
  const handleLogin = (user) => {
    if (user) {
      if (!user.role) {
        user.role = 'caixa';
      }
      // Garantir tenantId
      if (!user.tenantId) {
        if (user.role === 'admin' && user.email) {
          user.tenantId = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        } else {
          const allUsers = db.users.list();
          const admin = allUsers.find(u => u.role === 'admin');
          user.tenantId = admin && admin.email 
            ? admin.email.toLowerCase().replace(/[^a-z0-9]/g, '_')
            : 'default';
        }
      }
      localStorage.setItem('mozyc_pdv_current_user', JSON.stringify(user));
      setCurrentUser(user);
      setError(null);
      
      // Redirecionar todos para /pos
      setTimeout(() => {
        window.location.hash = '#/pos';
      }, 100);
    }
  };

  // Componente para rotas protegidas
  const ProtectedRoute = ({ children, requireRole }) => {
    if (!currentUser || !currentUser.role) {
      return <Login onLogin={handleLogin} />;
    }
    if (requireRole && currentUser.role !== requireRole && !requireRole.includes(currentUser.role)) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Card className="p-8 text-center rounded-xl max-w-md">
            <p className="text-red-500 font-bold mb-4">Acesso negado. Você não tem permissão para acessar esta página.</p>
            <Button onClick={() => setCurrentUser(null)} className="rounded-full">Fazer Login Novamente</Button>
          </Card>
        </div>
      );
    }
    return children;
  };

  // Componente para rota protegida do Admin
  const ProtectedGoodAdminRoute = ({ children }) => {
    if (!currentUser || !currentUser.role) {
      return <Login onLogin={handleLogin} />;
    }
    
    // Verificar se é Admin
    const isGoodAdmin = currentUser?.email === 'goodadm@studiovigo.com' || 
                       currentUser?.role === 'admin';
    
    if (!isGoodAdmin) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <Card className="p-8 text-center rounded-xl max-w-md">
            <p className="text-red-500 font-bold mb-4">Acesso negado. Apenas Admin pode acessar esta página.</p>
            <Button onClick={() => setCurrentUser(null)} className="rounded-full">Fazer Login Novamente</Button>
          </Card>
        </div>
      );
    }
    return children;
  };

  const pendingSalesCount = (typeof pendingSalesCountState !== 'undefined' ? pendingSalesCountState : 0) ?? 0;
  return (
    <>
      <HashRouter>
      <Routes>
        {/* Rota pública de login */}
        <Route 
          path="/login" 
          element={<Login onLogin={handleLogin} />} 
        />
        
        {/* Rota principal: redireciona sempre para POS */}
        <Route 
          path="/" 
          element={<Navigate to="/pos" replace />} 
        />
          
          <Route 
            path="/pos" 
            element={
              <ProtectedRoute>
                {currentUser && currentUser.role ? (
                  <Layout user={currentUser} onLogout={() => {
                    setCurrentUser(null);
                    setError(null);
                  }}>
                    <POS user={currentUser} />
                  </Layout>
                ) : null}
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute requireRole={['gerente', 'admin']}>
                {currentUser && currentUser.role ? (
                  <Layout user={currentUser} onLogout={() => {
                    setCurrentUser(null);
                    setError(null);
                  }}>
                    <SettingsPage user={currentUser} />
                  </Layout>
                ) : null}
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/products" 
            element={
              <ProtectedRoute>
                {currentUser && currentUser.role ? (
                  <Layout user={currentUser} onLogout={() => {
                    setCurrentUser(null);
                    setError(null);
                  }}>
                    <Products user={currentUser} />
                  </Layout>
                ) : null}
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/reports" 
            element={
              <ProtectedRoute>
                {currentUser && currentUser.role ? (
                  <Layout user={currentUser} onLogout={() => {
                    setCurrentUser(null);
                    setError(null);
                  }}>
                    <Reports user={currentUser} />
                  </Layout>
                ) : null}
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/online" 
            element={
              <ProtectedRoute>
                {currentUser && currentUser.role ? (
                  <Layout user={currentUser} onLogout={() => {
                    setCurrentUser(null);
                    setError(null);
                  }}>
                    <Online user={currentUser} />
                  </Layout>
                ) : null}
              </ProtectedRoute>
            } 
          />

          {/* Rota de Teste do Supabase (temporária) */}
          <Route 
            path="/test-supabase" 
            element={<TestSupabase />} 
          />
          
        {/* Rota padrão - redireciona para login */}
        <Route 
          path="*" 
          element={<Login onLogin={handleLogin} />} 
        />
      </Routes>
    </HashRouter>

    </>
  );
}