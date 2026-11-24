#!/bin/bash
# ID Generator Dependencies Installation Script

echo "Installing ID Generator Dependencies..."
echo "========================================"

# Check if npm is available
if ! command -v npm &> /dev/null
then
    echo "npm is not installed. Please install Node.js and npm first."
    exit 1
fi

echo "Installing html2canvas..."
npm install html2canvas

echo "Installing html2pdf.js..."
npm install html2pdf.js

echo "========================================"
echo "✅ Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Update idGeneratorUtils.js with your school information"
echo "2. Restart your development server"
echo "3. Open an active enrollment and click 'Generate ID Card' in the actions menu"
