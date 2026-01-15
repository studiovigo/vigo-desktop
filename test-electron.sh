#!/bin/bash

# Script de teste do Electron
# Este script testa o Electron em modo desenvolvimento

set -e

echo "🧪 Testando Electron em modo desenvolvimento..."
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📋 Pré-requisitos:${NC}"
echo "1. Backend deve estar rodando em http://localhost:8080"
echo "2. Frontend deve estar rodando em http://localhost:5173"
echo ""
echo -e "${YELLOW}💡 Dica: Abra dois terminais:${NC}"
echo "   Terminal 1: cd backend && mvn spring-boot:run"
echo "   Terminal 2: npm run dev"
echo ""
echo -e "${GREEN}🚀 Iniciando Electron...${NC}"
echo ""

npm run electron:dev

