#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Try to execute the actual seed script
try {
    const seedPath = path.join(__dirname, 'seed-dashboard-data.js');
    console.log(`Executing: ${seedPath}\n`);
    
    // Import and run the seed script
    delete require.cache[require.resolve(seedPath)];
    require(seedPath);
    
} catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
}
