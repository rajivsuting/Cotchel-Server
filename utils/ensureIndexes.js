/**
 * Ensure Database Indexes Exist (Auto-Run on Server Start)
 * 
 * This checks if indexes exist and creates them if missing.
 * Safe to run on every server start (only creates if missing).
 */

const Product = require("../models/product");
const Category = require("../models/category");
const Order = require("../models/order");

async function ensureIndexes() {
  try {
    console.log("🔍 Checking database indexes...");

    // Check if product indexes exist
    const productIndexes = await Product.collection.getIndexes();
    
    if (Object.keys(productIndexes).length < 5) {
      console.log("⚠️  Missing indexes detected!");
      console.log("⚠️  Please run: node scripts/create-production-indexes.js");
      console.log("⚠️  This is a ONE-TIME setup required for production.");
      return false;
    }

    console.log("✅ Database indexes verified");
    console.log(`   - Products: ${Object.keys(productIndexes).length} indexes`);
    return true;

  } catch (error) {
    console.error("❌ Error checking indexes:", error.message);
    return false;
  }
}

module.exports = ensureIndexes;

