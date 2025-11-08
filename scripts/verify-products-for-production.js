/**
 * PRODUCTION VERIFICATION SCRIPT
 * 
 * Run this BEFORE going live to ensure all products have required shipping data
 * 
 * Usage: node scripts/verify-products-for-production.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Product = require("../models/product");

async function verifyProducts() {
  try {
    console.log("🔍 Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("=" .repeat(60));
    console.log("📦 PRODUCTION READINESS CHECK - Product Verification");
    console.log("=".repeat(60));
    console.log();

    // Count total active products
    const totalProducts = await Product.countDocuments({ 
      isActive: true,
      sellerDeleted: false 
    });
    console.log(`📊 Total active products: ${totalProducts}\n`);

    // Check for products missing weight
    console.log("⚖️  Checking for products missing WEIGHT...");
    const missingWeight = await Product.find({
      isActive: true,
      sellerDeleted: false,
      $or: [
        { weight: { $exists: false } },
        { weight: null },
        { weight: 0 }
      ]
    }).select("title sku user weight");

    if (missingWeight.length > 0) {
      console.log(`❌ CRITICAL: ${missingWeight.length} products missing weight!\n`);
      console.log("Products without weight:");
      missingWeight.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title} (SKU: ${p.sku})`);
      });
      console.log();
    } else {
      console.log(`✅ All products have weight defined\n`);
    }

    // Check for products missing dimensions
    console.log("📏 Checking for products missing DIMENSIONS...");
    const missingDimensions = await Product.find({
      isActive: true,
      sellerDeleted: false,
      $or: [
        { length: { $exists: false } },
        { breadth: { $exists: false } },
        { height: { $exists: false } },
        { length: null },
        { breadth: null },
        { height: null },
        { length: 0 },
        { breadth: 0 },
        { height: 0 }
      ]
    }).select("title sku length breadth height");

    if (missingDimensions.length > 0) {
      console.log(`❌ CRITICAL: ${missingDimensions.length} products missing dimensions!\n`);
      console.log("Products without dimensions:");
      missingDimensions.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title} (SKU: ${p.sku})`);
        console.log(`     L: ${p.length || 'MISSING'}, B: ${p.breadth || 'MISSING'}, H: ${p.height || 'MISSING'}`);
      });
      console.log();
    } else {
      console.log(`✅ All products have dimensions defined\n`);
    }

    // Check for products missing SKU
    console.log("🏷️  Checking for products missing SKU...");
    const missingSKU = await Product.find({
      isActive: true,
      sellerDeleted: false,
      $or: [
        { sku: { $exists: false } },
        { sku: null },
        { sku: "" }
      ]
    }).select("title");

    if (missingSKU.length > 0) {
      console.log(`❌ WARNING: ${missingSKU.length} products missing SKU!\n`);
      missingSKU.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title}`);
      });
      console.log();
    } else {
      console.log(`✅ All products have SKU\n`);
    }

    // Show sample of products with all data
    console.log("📋 Sample of READY products (first 5):");
    const readyProducts = await Product.find({
      isActive: true,
      sellerDeleted: false,
      weight: { $exists: true, $ne: 0, $ne: null },
      length: { $exists: true, $ne: 0, $ne: null },
      breadth: { $exists: true, $ne: 0, $ne: null },
      height: { $exists: true, $ne: 0, $ne: null },
      sku: { $exists: true, $ne: "", $ne: null }
    })
    .select("title sku weight length breadth height price")
    .limit(5);

    if (readyProducts.length === 0) {
      console.log("❌ NO PRODUCTS ARE PRODUCTION READY!\n");
    } else {
      readyProducts.forEach((p, i) => {
        console.log(`\n  ${i + 1}. ${p.title}`);
        console.log(`     SKU: ${p.sku}`);
        console.log(`     Weight: ${p.weight}kg`);
        console.log(`     Dimensions: ${p.length}×${p.breadth}×${p.height} cm`);
        console.log(`     Price: ₹${p.price}`);
      });
      console.log();
    }

    // Final Summary
    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    
    const readyCount = await Product.countDocuments({
      isActive: true,
      sellerDeleted: false,
      weight: { $exists: true, $ne: 0, $ne: null },
      length: { $exists: true, $ne: 0, $ne: null },
      breadth: { $exists: true, $ne: 0, $ne: null },
      height: { $exists: true, $ne: 0, $ne: null },
      sku: { $exists: true, $ne: "", $ne: null }
    });

    console.log(`Total Active Products:     ${totalProducts}`);
    console.log(`Production Ready:          ${readyCount} ✅`);
    console.log(`Missing Weight:            ${missingWeight.length} ${missingWeight.length > 0 ? '❌' : '✅'}`);
    console.log(`Missing Dimensions:        ${missingDimensions.length} ${missingDimensions.length > 0 ? '❌' : '✅'}`);
    console.log(`Missing SKU:               ${missingSKU.length} ${missingSKU.length > 0 ? '⚠️' : '✅'}`);
    console.log();

    // Production Readiness Status
    const criticalIssues = missingWeight.length + missingDimensions.length;
    
    if (criticalIssues === 0) {
      console.log("🎉 " + "=".repeat(56) + " 🎉");
      console.log("🎉 PRODUCTION READY! All products have required data! 🎉");
      console.log("🎉 " + "=".repeat(56) + " 🎉");
      console.log();
      console.log("✅ You can go live!");
    } else {
      console.log("❌ " + "=".repeat(56) + " ❌");
      console.log("❌ NOT READY FOR PRODUCTION! Critical issues found! ❌");
      console.log("❌ " + "=".repeat(56) + " ❌");
      console.log();
      console.log("⚠️  CRITICAL: Fix the products listed above before going live!");
      console.log();
      console.log("To fix:");
      console.log("1. Update products in seller dashboard");
      console.log("2. Add weight (in kg): minimum 0.1kg");
      console.log("3. Add dimensions (in cm): length, breadth, height");
      console.log("4. Ensure SKU is unique for each product");
      console.log("5. Run this script again to verify");
    }

    console.log();
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

// Run the verification
verifyProducts();

