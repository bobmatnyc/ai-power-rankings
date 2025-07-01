#!/bin/bash

# Script to easily switch between production and development environments
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Environment Switcher${NC}"
echo "========================"

# Backup current .env.local if it exists
if [ -f .env.local ]; then
    if [ ! -f .env.local.backup ]; then
        echo -e "${YELLOW}📦 Backing up current .env.local...${NC}"
        cp .env.local .env.local.backup
    fi
fi

echo ""
echo -e "${YELLOW}Choose environment:${NC}"
echo "1. 🏗️  Development (Safe for testing)"
echo "2. 🚀 Production (Live data - be careful!)" 
echo "3. 📋 Show current environment"
echo "4. 🔙 Restore from backup"
echo ""

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo -e "${YELLOW}Switching to development environment...${NC}"
        cp .env.local.dev .env.local
        echo -e "${GREEN}✅ Switched to DEVELOPMENT${NC}"
        echo -e "${BLUE}   Database: gqucazglcjgvnzycwwia.supabase.co${NC}"
        echo -e "${BLUE}   Safe for: Breaking changes, testing, experiments${NC}"
        ;;
    2)
        echo -e "${RED}⚠️  Switching to production environment...${NC}"
        if [ -f .env.local.backup ]; then
            cp .env.local.backup .env.local
            echo -e "${RED}✅ Switched to PRODUCTION${NC}"
            echo -e "${RED}   Database: fukdwnsvjdgyakdvtdin.supabase.co${NC}"
            echo -e "${RED}   WARNING: Live data - be very careful!${NC}"
        else
            echo -e "${RED}❌ No production backup found!${NC}"
            echo "Please manually restore your production .env.local"
        fi
        ;;
    3)
        echo -e "${YELLOW}Current environment:${NC}"
        if [ -f .env.local ]; then
            if grep -q "gqucazglcjgvnzycwwia" .env.local; then
                echo -e "${GREEN}   🏗️  DEVELOPMENT${NC}"
                echo -e "${BLUE}   Database: gqucazglcjgvnzycwwia.supabase.co${NC}"
            elif grep -q "fukdwnsvjdgyakdvtdin" .env.local; then
                echo -e "${RED}   🚀 PRODUCTION${NC}"
                echo -e "${RED}   Database: fukdwnsvjdgyakdvtdin.supabase.co${NC}"
            else
                echo -e "${YELLOW}   ❓ UNKNOWN${NC}"
            fi
        else
            echo -e "${YELLOW}   ❌ No .env.local file found${NC}"
        fi
        ;;
    4)
        if [ -f .env.local.backup ]; then
            echo -e "${YELLOW}Restoring from backup...${NC}"
            cp .env.local.backup .env.local
            echo -e "${GREEN}✅ Restored from backup${NC}"
        else
            echo -e "${RED}❌ No backup file found${NC}"
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • Always use development for testing new features"
echo "   • Run 'npm run dev' after switching environments"
echo "   • Check the URL in your browser to confirm environment"
echo "   • Development: localhost:3000 with dev database"
echo "   • Production: Make sure you're connected to live database"