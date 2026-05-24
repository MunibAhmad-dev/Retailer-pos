// Direct execution wrapper
const { execSync } = require('child_process');
const path = require('path');

try {
    console.log('Starting seed data population...\n');
    const result = execSync('node seed-dashboard-data.js', {
        cwd: 'd:\\Full stack\\Local projects\\Retailer shops - pos',
        stdio: 'inherit',
        shell: 'cmd.exe'
    });
    console.log('\n✅ Seed completed successfully!');
} catch (error) {
    console.error('Error running seed:', error.message);
    process.exit(1);
}
