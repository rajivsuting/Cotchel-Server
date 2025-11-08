/**
 * Admin Alert Service
 * 
 * Sends critical alerts to platform admins via console logs
 * (You monitor server logs anyway, so no need for email complexity)
 */

/**
 * Alert: Shiprocket Wallet Balance Low
 */
async function alertShiprocketWalletLow(orderId, sellerName) {
  // Log prominently in console (you're monitoring logs anyway!)
  console.error("\n");
  console.error("=" .repeat(80));
  console.error("🚨 CRITICAL ADMIN ALERT: SHIPROCKET WALLET BALANCE LOW");
  console.error("=" .repeat(80));
  console.error(`📦 Order ID: ${orderId}`);
  console.error(`👤 Seller: ${sellerName}`);
  console.error(`❌ Issue: Wallet balance < ₹100`);
  console.error(`⚠️  Impact: Cannot generate AWB codes for new shipments`);
  console.error(``);
  console.error(`✅ IMMEDIATE ACTION:`);
  console.error(`   1. Login: https://app.shiprocket.in/wallet`);
  console.error(`   2. Recharge: ₹5,000+ recommended`);
  console.error(`   3. Verify balance updated`);
  console.error(`   4. Seller will retry "Generate Label" automatically`);
  console.error("=" .repeat(80));
  console.error("\n");
}

/**
 * Alert: Payment Gateway Error
 */
async function alertPaymentGatewayError(error, orderId) {
  console.error("\n");
  console.error("=" .repeat(80));
  console.error("🚨 CRITICAL: PAYMENT GATEWAY ERROR");
  console.error("=" .repeat(80));
  console.error(`Order ID: ${orderId || 'Unknown'}`);
  console.error(`Error: ${error.message}`);
  console.error(`Action: Check Razorpay dashboard and webhook configuration`);
  console.error("=" .repeat(80));
  console.error("\n");
}

/**
 * Alert: Database Connection Lost
 */
async function alertDatabaseError(error) {
  console.error("\n");
  console.error("=" .repeat(80));
  console.error("🚨 CRITICAL: DATABASE CONNECTION ERROR");
  console.error("=" .repeat(80));
  console.error(`Error: ${error.message}`);
  console.error(`Action: Check MongoDB Atlas and restart server if needed`);
  console.error("=" .repeat(80));
  console.error("\n");
}

module.exports = {
  alertShiprocketWalletLow,
  alertPaymentGatewayError,
  alertDatabaseError,
};

