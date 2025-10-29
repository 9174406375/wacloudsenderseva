#!/bin/bash

echo "=========================================="
echo "🔍 WA CLOUD SENDER SEVA - PROJECT VERIFICATION"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in project directory!${NC}"
    echo "Run: cd ~/wacloudsenderseva"
    exit 1
fi

echo "📁 CHECKING FOLDER STRUCTURE..."
echo "----------------------------------------"

# Required folders
folders=("config" "models" "routes" "middleware" "services" "public")
for folder in "${folders[@]}"; do
    if [ -d "$folder" ]; then
        echo -e "${GREEN}✅ $folder/${NC}"
    else
        echo -e "${RED}❌ Missing: $folder/${NC}"
    fi
done

echo ""
echo "📄 CHECKING FILES..."
echo "----------------------------------------"

# Root files
files=(
    "package.json"
    "server.js"
    ".env"
    ".gitignore"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
    fi
done

# Config files
echo ""
echo "🔧 Config files:"
if [ -f "config/database.js" ]; then
    echo -e "${GREEN}✅ config/database.js${NC}"
else
    echo -e "${RED}❌ config/database.js${NC}"
fi

# Models
echo ""
echo "📊 Models:"
model_files=("User.js" "Campaign.js" "Contact.js")
for model in "${model_files[@]}"; do
    if [ -f "models/$model" ]; then
        echo -e "${GREEN}✅ models/$model${NC}"
    else
        echo -e "${RED}❌ models/$model${NC}"
    fi
done

# Routes
echo ""
echo "🛣️  Routes:"
route_files=("auth.js" "campaign.js" "contact.js")
for route in "${route_files[@]}"; do
    if [ -f "routes/$route" ]; then
        echo -e "${GREEN}✅ routes/$route${NC}"
    else
        echo -e "${RED}❌ routes/$route${NC}"
    fi
done

# Middleware
echo ""
echo "🔒 Middleware:"
if [ -f "middleware/auth.js" ]; then
    echo -e "${GREEN}✅ middleware/auth.js${NC}"
else
    echo -e "${RED}❌ middleware/auth.js${NC}"
fi

# Services
echo ""
echo "⚙️  Services:"
if [ -f "services/scheduler.js" ]; then
    echo -e "${GREEN}✅ services/scheduler.js${NC}"
else
    echo -e "${RED}❌ services/scheduler.js${NC}"
fi

# Frontend
echo ""
echo "🎨 Frontend:"
frontend_files=("index.html" "dashboard.html")
for html in "${frontend_files[@]}"; do
    if [ -f "public/$html" ]; then
        echo -e "${GREEN}✅ public/$html${NC}"
    else
        echo -e "${RED}❌ public/$html${NC}"
    fi
done

echo ""
echo "=========================================="
echo "📝 CHECKING PACKAGE.JSON..."
echo "----------------------------------------"

# Check if package.json is valid JSON
if node -e "require('./package.json')" 2>/dev/null; then
    echo -e "${GREEN}✅ package.json is valid JSON${NC}"
    
    # Check required fields
    if grep -q '"name"' package.json; then
        echo -e "${GREEN}✅ Has 'name' field${NC}"
    fi
    if grep -q '"version"' package.json; then
        echo -e "${GREEN}✅ Has 'version' field${NC}"
    fi
    if grep -q '"main"' package.json; then
        echo -e "${GREEN}✅ Has 'main' field${NC}"
    fi
    if grep -q '"start"' package.json; then
        echo -e "${GREEN}✅ Has 'start' script${NC}"
    fi
else
    echo -e "${RED}❌ package.json is INVALID JSON!${NC}"
fi

echo ""
echo "=========================================="
echo "🔍 CHECKING SERVER.JS SYNTAX..."
echo "----------------------------------------"

# Check if server.js has syntax errors
if node -c server.js 2>/dev/null; then
    echo -e "${GREEN}✅ server.js has no syntax errors${NC}"
else
    echo -e "${RED}❌ server.js has SYNTAX ERRORS!${NC}"
    node -c server.js
fi

echo ""
echo "=========================================="
echo "🔐 CHECKING .ENV FILE..."
echo "----------------------------------------"

if [ -f ".env" ]; then
    required_vars=("MONGODB_URI" "JWT_SECRET" "PORT")
    for var in "${required_vars[@]}"; do
        if grep -q "$var" .env; then
            echo -e "${GREEN}✅ $var is set${NC}"
        else
            echo -e "${RED}❌ Missing: $var${NC}"
        fi
    done
else
    echo -e "${RED}❌ .env file not found!${NC}"
fi

echo ""
echo "=========================================="
echo "📊 FILE COUNTS..."
echo "----------------------------------------"
echo "Total files: $(find . -type f | wc -l)"
echo "JavaScript files: $(find . -name "*.js" | wc -l)"
echo "HTML files: $(find . -name "*.html" | wc -l)"
echo "Total lines of code: $(find . -name "*.js" -o -name "*.html" | xargs wc -l | tail -1)"

echo ""
echo "=========================================="
echo "📦 CHECKING NODE_MODULES..."
echo "----------------------------------------"

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules exists${NC}"
    echo "Installed packages: $(ls node_modules | wc -l)"
else
    echo -e "${YELLOW}⚠️  node_modules not found (run npm install)${NC}"
fi

echo ""
echo "=========================================="
echo "✅ VERIFICATION COMPLETE!"
echo "=========================================="
