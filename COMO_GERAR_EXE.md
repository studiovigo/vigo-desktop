# Como Criar o Instalador EXE do Sistema PDV

## Pré-requisitos
- Node.js instalado
- Todas as dependências instaladas (npm install)

## Passos para Gerar o Instalador

### 1. Compilar a aplicação
```powershell
npm run build
```
Este comando compila o código React/Vite para a pasta `dist/`

### 2. Gerar o instalador Windows
```powershell
npm run dist:win
```
Este comando cria:
- **Instalador NSIS** (Setup.exe) - instalador tradicional do Windows
- **Versão Portable** (.exe) - executável que não precisa instalação

### 3. Localizar os arquivos gerados
Os instaladores estarão na pasta:
```
vigo-desktop/release/
```

Você encontrará arquivos como:
- `LB Brand - Sistema PDV Setup X.X.X.exe` - Instalador completo
- `LB Brand - Sistema PDV X.X.X.exe` - Versão portable

## Comando Completo (Build + Instalador)
```powershell
npm run build:electron
```
Este comando faz tudo de uma vez: compila e gera o instalador.

## Configurações do Instalador

O instalador já está configurado para:
- ✅ Permitir escolher pasta de instalação
- ✅ Criar atalho na área de trabalho
- ✅ Criar atalho no Menu Iniciar
- ✅ Ícone personalizado (imag/ICONE SISTEMA.png)

## Distribuição

Depois de gerado, você pode:
1. Copiar o instalador para um pendrive
2. Enviar por email/drive
3. Hospedar em servidor web
4. Distribuir para clientes instalarem

## Observações Importantes

⚠️ **Primeira execução**: O Windows pode mostrar aviso "Windows protegeu seu PC" porque o instalador não está assinado digitalmente. Isso é normal para aplicativos não assinados.

Para contornar:
- Clique em "Mais informações"
- Depois clique em "Executar assim mesmo"

💡 **Assinatura Digital** (opcional): Para remover o aviso, você precisaria de um certificado de assinatura de código (Code Signing Certificate) da Microsoft.

## Solução de Problemas

### Erro de memória
Se houver erro de "JavaScript heap out of memory":
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build:electron
```

### Erro no electron-builder
Reinstale as dependências:
```powershell
npm install --force
npm run build:electron
```

### Ícone não aparece
Certifique-se de que existe um arquivo PNG em:
```
vigo-desktop/imag/ICONE SISTEMA.png
```

## Versão Portable vs Instalador

**Instalador (Setup.exe)**:
- Instala o programa na pasta Arquivos de Programas
- Cria atalhos automaticamente
- Adiciona ao "Adicionar ou Remover Programas"
- Recomendado para distribuição profissional

**Portable (.exe)**:
- Não precisa instalação
- Pode rodar de qualquer pasta (inclusive pendrive)
- Não deixa rastros no sistema
- Ideal para testes ou uso temporário
