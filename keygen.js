const crypto = require('crypto');
const readline = require('readline');

// Must match src/main/license_manager.ts
const SECRET_KEY = Buffer.from('4a616e75617279203173742c2032303236204c6963656e736520536563726574', 'hex');
const IV_LENGTH = 12;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const part = argv[i];
    if (part.startsWith('--')) {
      const key = part.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

function clampMaxDevices(v) {
  const n = Math.floor(Number(v) || 1);
  return Math.min(5, Math.max(1, n));
}

function normalizeUnit(v) {
  const u = String(v || 'days').toLowerCase();
  if (u === 'day' || u === 'days') return 'days';
  if (u === 'week' || u === 'weeks') return 'weeks';
  if (u === 'month' || u === 'months') return 'months';
  if (u === 'year' || u === 'years') return 'years';
  throw new Error('Invalid duration unit. Use days|weeks|months|years.');
}

function buildLicense({ issuedTo, fingerprint, durationValue, durationUnit, maxDevices }) {
  const now = new Date();
  const expiresAt = new Date(now);
  const value = Math.max(1, Math.floor(Number(durationValue) || 1));
  const unit = normalizeUnit(durationUnit);

  if (unit === 'days') expiresAt.setDate(expiresAt.getDate() + value);
  if (unit === 'weeks') expiresAt.setDate(expiresAt.getDate() + value * 7);
  if (unit === 'months') expiresAt.setMonth(expiresAt.getMonth() + value);
  if (unit === 'years') expiresAt.setFullYear(expiresAt.getFullYear() + value);

  const durationDays = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    id: crypto.randomUUID(),
    issuedTo: String(issuedTo || '').trim() || 'Unknown Business',
    issuedForFingerprint: String(fingerprint || '').trim(),
    durationDays,
    maxDevices: clampMaxDevices(maxDevices),
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}

function encryptLicense(license) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', SECRET_KEY, iv);

  const json = JSON.stringify(license);
  let encrypted = cipher.update(json, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function printResult(license, key) {
  console.log('\n=================================');
  console.log('V2 LICENSE GENERATED');
  console.log('=================================');
  console.log(`Business: ${license.issuedTo}`);
  console.log(`Fingerprint: ${license.issuedForFingerprint}`);
  console.log(`Max Devices: ${license.maxDevices}`);
  console.log(`Issued At: ${license.issuedAt}`);
  console.log(`Expires At: ${license.expiresAt}`);
  console.log('\nLICENSE KEY (paste in Activation):');
  console.log(key);
  console.log('=================================\n');
}

function runNonInteractive(args) {
  const fingerprint = String(args.fingerprint || '').trim();
  if (!fingerprint) throw new Error('--fingerprint is required');

  let durationValue = args.durationValue || args.duration || 30;
  let durationUnit = args.durationUnit || args.unit || 'days';
  const plan = String(args.plan || '').toLowerCase();

  if (plan) {
    if (plan === 'weekly') { durationValue = 1; durationUnit = 'weeks'; }
    else if (plan === 'monthly') { durationValue = 1; durationUnit = 'months'; }
    else if (plan === 'yearly') { durationValue = 1; durationUnit = 'years'; }
    else if (plan === 'lifetime') { durationValue = 100; durationUnit = 'years'; }
    else if (plan === 'custom') {
      durationValue = args.customDays || durationValue;
      durationUnit = 'days';
    } else {
      throw new Error('Invalid --plan. Use weekly|monthly|yearly|lifetime|custom');
    }
  }

  const license = buildLicense({
    issuedTo: args.business || args.issuedTo || '',
    fingerprint,
    durationValue,
    durationUnit,
    maxDevices: args.maxDevices || 1
  });

  const key = encryptLicense(license);
  printResult(license, key);
}

function runInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('--- POS V2 License Generator ---');
  console.log('Paste the customer fingerprint, then generate a matching key.\n');

  rl.question('Device fingerprint: ', (fingerprint) => {
    if (!String(fingerprint || '').trim()) {
      console.error('Fingerprint is required.');
      rl.close();
      return;
    }

    rl.question('Business name (optional): ', (business) => {
      rl.question('Duration value (default 30): ', (durationValue) => {
        rl.question('Duration unit days/weeks/months/years (default days): ', (durationUnit) => {
          rl.question('Max devices 1-5 (default 1): ', (maxDevices) => {
            try {
              const license = buildLicense({
                issuedTo: business,
                fingerprint,
                durationValue: durationValue || 30,
                durationUnit: durationUnit || 'days',
                maxDevices: maxDevices || 1
              });

              const key = encryptLicense(license);
              printResult(license, key);
            } catch (err) {
              console.error(`Failed to generate license: ${err.message}`);
            } finally {
              rl.close();
            }
          });
        });
      });
    });
  });
}

try {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage:');
    console.log('  node keygen.js');
    console.log('  node keygen.js --fingerprint <sha256> --business "My Shop" --durationValue 30 --durationUnit days --maxDevices 1');
    console.log('  node keygen.js --fingerprint <sha256> --plan weekly');
    console.log('  node keygen.js --fingerprint <sha256> --plan custom --customDays 45');
    process.exit(0);
  }

  if (args.fingerprint) {
    runNonInteractive(args);
  } else {
    runInteractive();
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
