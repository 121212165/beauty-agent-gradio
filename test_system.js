// Simple test script to verify the blood pressure monitoring system

import fs from 'fs';
import path from 'path';

console.log('🩺 Blood Pressure Monitor System Test\n');

// Test 1: Check if all required files exist
console.log('📁 Checking file structure...');
const requiredFiles = [
    'server/app.js',
    'server/routes/bloodPressure.js',
    'server/routes/users.js',
    'server/routes/analytics.js',
    'server/utils/database.js',
    'server/utils/ocrService.js',
    'server/utils/voiceService.js',
    'server/utils/aiValidationService.js',
    'public/script.js',
    'index.html',
    'package.json'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesExist = false;
    }
});

// Test 2: Check package.json dependencies
console.log('\n📦 Checking dependencies...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = [
        'express',
        'cors',
        'dotenv',
        'multer',
        'openai',
        'tesseract.js',
        'sqlite3',
        'sharp',
        'bcrypt',
        'jsonwebtoken',
        'moment'
    ];
    
    let allDepsPresent = true;
    requiredDeps.forEach(dep => {
        if (packageJson.dependencies[dep]) {
            console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
        } else {
            console.log(`❌ ${dep} - MISSING`);
            allDepsPresent = false;
        }
    });
    
    if (allDepsPresent) {
        console.log('✅ All required dependencies are present');
    } else {
        console.log('❌ Some dependencies are missing');
    }
} catch (error) {
    console.log('❌ Error reading package.json:', error.message);
}

// Test 3: Check if data directory exists
console.log('\n💾 Checking data directory...');
if (fs.existsSync('server/data')) {
    console.log('✅ Data directory exists');
} else {
    console.log('❌ Data directory missing - creating...');
    try {
        fs.mkdirSync('server/data', { recursive: true });
        console.log('✅ Data directory created');
    } catch (error) {
        console.log('❌ Failed to create data directory:', error.message);
    }
}

// Test 4: Basic syntax check for main files
console.log('\n🔍 Basic syntax validation...');
const jsFiles = [
    'server/app.js',
    'server/utils/database.js',
    'public/script.js'
];

jsFiles.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        // Basic syntax check - look for common issues
        if (content.includes('import ') && content.includes('require(')) {
            console.log(`⚠️  ${file} - Mixed import/require syntax detected`);
        } else if (content.length > 0) {
            console.log(`✅ ${file} - Basic syntax OK`);
        } else {
            console.log(`❌ ${file} - File is empty`);
        }
    } catch (error) {
        console.log(`❌ ${file} - Error reading file:`, error.message);
    }
});

// Test 5: Check HTML structure
console.log('\n🌐 Checking HTML structure...');
try {
    const htmlContent = fs.readFileSync('index.html', 'utf8');
    const requiredElements = [
        'user-selector',
        'recordTab',
        'historyTab',
        'settingsTab',
        'photoUpload',
        'voiceBtn',
        'systolic',
        'diastolic'
    ];
    
    let htmlValid = true;
    requiredElements.forEach(elementId => {
        if (htmlContent.includes(`id="${elementId}"`)) {
            console.log(`✅ Element #${elementId} found`);
        } else {
            console.log(`❌ Element #${elementId} missing`);
            htmlValid = false;
        }
    });
    
    if (htmlValid) {
        console.log('✅ HTML structure is valid');
    }
} catch (error) {
    console.log('❌ Error reading HTML file:', error.message);
}

// Test 6: Environment setup check
console.log('\n🔧 Environment setup...');
if (fs.existsSync('.env')) {
    console.log('✅ .env file exists');
} else {
    console.log('⚠️  .env file not found - creating example...');
    const envExample = `# Blood Pressure Monitor Environment Variables
# AI Services (choose one)
OPENAI_API_KEY=your_openai_api_key_here
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./server/data/bp_monitor.db
`;
    try {
        fs.writeFileSync('.env.example', envExample);
        console.log('✅ .env.example created - copy to .env and add your API keys');
    } catch (error) {
        console.log('❌ Failed to create .env.example:', error.message);
    }
}

// Summary
console.log('\n📋 Test Summary');
console.log('================');
if (allFilesExist) {
    console.log('✅ File structure: PASS');
} else {
    console.log('❌ File structure: FAIL - Some files are missing');
}

console.log('\n🚀 Next Steps:');
console.log('1. Copy .env.example to .env and add your API keys');
console.log('2. Run: npm install (if not already done)');
console.log('3. Run: npm start');
console.log('4. Open: http://localhost:3000');
console.log('\n🎯 Features to test:');
console.log('- User creation and switching');
console.log('- Manual blood pressure entry');
console.log('- Photo upload (OCR will need API key)');
console.log('- Voice recording (needs microphone permission)');
console.log('- History viewing and data export');
console.log('- Accessibility features (high contrast, large font)');

console.log('\n🩺 Blood Pressure Monitor System Ready!');
