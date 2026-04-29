const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("--- POS License Generator ---");

function generateKey(businessName, plan, customDays) {
    let durationDays = 30;

    if (plan.toLowerCase() === 'monthly') {
      durationDays = 30;
    } else if (plan.toLowerCase() === 'weekly') {
      durationDays = 7;
    } else if (plan.toLowerCase() === 'yearly') {
      durationDays = 365;
    } else if (plan.toLowerCase() === 'lifetime') {
      durationDays = 36500; // 100 years
    } else if (plan.toLowerCase() === 'custom' && customDays) {
      durationDays = parseInt(customDays, 10);
    } else {
      console.log("Invalid plan selected. Defaulting to monthly.");
      durationDays = 30;
      plan = 'monthly';
    }

    const licenseId = crypto.randomBytes(8).toString('hex');

    const license = {
      businessName: businessName.trim(),
      plan: plan.toLowerCase(),
      durationDays: durationDays,
      licenseId: licenseId
    };

    const jsonStr = JSON.stringify(license);
    const base64Key = Buffer.from(jsonStr).toString('base64');

    console.log("\n=================================");
    console.log("LICENSE GENERATED SUCCESSFULLY!");
    console.log("=================================\n");
    console.log(`Business Name: ${license.businessName}`);
    console.log(`Plan: ${license.plan}`);
    console.log(`Duration Added: ${license.durationDays} Days`);
    console.log("\nACTIVATION KEY (Copy this into the app to add days):");
    console.log(base64Key);
    console.log("\n=================================");
    
    rl.close();
}

rl.question('Enter Business Name: ', (businessName) => {
  rl.question('Select Plan (weekly/monthly/yearly/lifetime/custom): ', (plan) => {
    
    if (plan.toLowerCase() === 'custom') {
        rl.question('Enter number of days: ', (days) => {
            generateKey(businessName, plan, days);
        });
    } else {
        generateKey(businessName, plan, null);
    }
  });
});
