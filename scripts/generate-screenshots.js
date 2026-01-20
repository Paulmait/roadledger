#!/usr/bin/env node
/**
 * RoadLedger App Store Screenshot Generator
 *
 * This script helps generate promotional screenshots for the App Store.
 * It creates marketing frames around device screenshots with captions.
 *
 * Usage:
 *   node scripts/generate-screenshots.js
 *
 * Requirements:
 *   npm install sharp
 *
 * Input: Raw screenshots in assets/appstore/raw/
 * Output: Framed screenshots in assets/appstore/screenshots/
 */

const fs = require('fs');
const path = require('path');

// Try to require sharp, provide helpful message if not installed
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp is not installed. Installing now...');
  console.log('Run: npm install sharp');
  console.log('\nAfter installing, run this script again.');
  process.exit(1);
}

// Screenshot configurations for App Store
const SCREENSHOT_CONFIGS = {
  'iPhone-6.7': {
    width: 1290,
    height: 2796,
    deviceFrame: null, // Raw screenshots, no device frame
    description: 'iPhone 14 Pro Max / iPhone 15 Pro Max'
  },
  'iPhone-6.5': {
    width: 1284,
    height: 2778,
    deviceFrame: null,
    description: 'iPhone 11 Pro Max / iPhone XS Max'
  },
  'iPhone-5.5': {
    width: 1242,
    height: 2208,
    deviceFrame: null,
    description: 'iPhone 8 Plus'
  },
  'iPad-12.9': {
    width: 2048,
    height: 2732,
    deviceFrame: null,
    description: 'iPad Pro 12.9"'
  },
  'iPad-13': {
    width: 2064,
    height: 2752,
    deviceFrame: null,
    description: 'iPad Pro 13" (M4)'
  }
};

// Screenshot data with marketing copy
const SCREENSHOTS = [
  {
    id: '01',
    filename: 'Dashboard',
    headline: 'Know Your Profit',
    subheadline: 'Track every dollar, every mile',
    feature: 'Real-time profit dashboard',
    color: '#1E3A5F' // Dark blue
  },
  {
    id: '02',
    filename: 'LoadCalculator',
    headline: 'Worth It?',
    subheadline: 'Know before you accept',
    feature: 'Load profitability calculator',
    color: '#2D5016' // Dark green
  },
  {
    id: '03',
    filename: 'TripTracking',
    headline: 'Track Miles',
    subheadline: 'GPS-powered IFTA tracking',
    feature: 'Automatic mileage by state',
    color: '#4A1E5F' // Dark purple
  },
  {
    id: '04',
    filename: 'Documents',
    headline: 'Snap & Save',
    subheadline: 'AI-powered receipt scanning',
    feature: 'Auto-extract vendor, amount, date',
    color: '#5F3A1E' // Dark orange/brown
  },
  {
    id: '05',
    filename: 'IFTA',
    headline: 'IFTA Ready',
    subheadline: 'One-click quarterly reports',
    feature: 'Miles & fuel by jurisdiction',
    color: '#1E5F5F' // Dark teal
  },
  {
    id: '06',
    filename: 'Transactions',
    headline: 'Every Expense',
    subheadline: 'Income vs expenses at a glance',
    feature: 'Categorized transactions',
    color: '#5F1E3A' // Dark magenta
  },
  {
    id: '07',
    filename: 'Reports',
    headline: 'Tax Ready',
    subheadline: 'Export for your accountant',
    feature: 'PDF reports & CSV exports',
    color: '#3A5F1E' // Olive green
  },
  {
    id: '08',
    filename: 'Settings',
    headline: 'Your Way',
    subheadline: 'Customize your experience',
    feature: 'Profile, preferences, legal',
    color: '#5F5F1E' // Dark yellow
  },
  {
    id: '09',
    filename: 'Subscription',
    headline: 'Go Pro',
    subheadline: 'Unlock all features',
    feature: 'Simple, transparent pricing',
    color: '#1E5F3A' // Forest green
  }
];

// Demo account data summary (matches migration data)
const DEMO_DATA = {
  totalRevenue: 11722.50,
  totalFuel: 2281.20,
  totalExpenses: 5847.50,
  netProfit: 5875.00,
  totalMiles: 4605,
  tripsCount: 8,
  states: ['TX', 'CA', 'AZ', 'NM', 'OK', 'LA'],
  profitPerMile: 1.28
};

async function createMarketingOverlay(screenshot, config, size) {
  const { headline, subheadline, feature, color } = config;
  const { width, height } = size;

  // Create SVG overlay with marketing text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="headerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.95"/>
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.85"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
        </filter>
      </defs>

      <!-- Header background -->
      <rect x="0" y="0" width="${width}" height="${Math.round(height * 0.18)}" fill="url(#headerGradient)"/>

      <!-- Headline -->
      <text x="${width/2}" y="${Math.round(height * 0.07)}"
            font-family="SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif"
            font-size="${Math.round(width * 0.065)}"
            font-weight="700"
            fill="white"
            text-anchor="middle"
            filter="url(#shadow)">
        ${headline}
      </text>

      <!-- Subheadline -->
      <text x="${width/2}" y="${Math.round(height * 0.115)}"
            font-family="SF Pro Text, -apple-system, BlinkMacSystemFont, sans-serif"
            font-size="${Math.round(width * 0.032)}"
            font-weight="400"
            fill="rgba(255,255,255,0.9)"
            text-anchor="middle">
        ${subheadline}
      </text>

      <!-- Feature badge -->
      <rect x="${width/2 - Math.round(width * 0.35)}" y="${Math.round(height * 0.135)}"
            width="${Math.round(width * 0.7)}" height="${Math.round(height * 0.028)}"
            rx="4" fill="rgba(255,255,255,0.15)"/>
      <text x="${width/2}" y="${Math.round(height * 0.155)}"
            font-family="SF Pro Text, -apple-system, BlinkMacSystemFont, sans-serif"
            font-size="${Math.round(width * 0.022)}"
            font-weight="500"
            fill="rgba(255,255,255,0.8)"
            text-anchor="middle">
        ${feature}
      </text>
    </svg>
  `;

  return Buffer.from(svg);
}

async function processScreenshot(inputPath, outputPath, config, sizeConfig) {
  console.log(`  Processing: ${path.basename(inputPath)}`);

  try {
    // Read the input image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Resize to target dimensions if needed
    const resized = image.resize(sizeConfig.width, sizeConfig.height, {
      fit: 'cover',
      position: 'top'
    });

    // Create marketing overlay
    const overlay = await createMarketingOverlay(null, config, sizeConfig);

    // Composite the overlay onto the screenshot
    const result = await resized
      .composite([
        {
          input: overlay,
          top: 0,
          left: 0
        }
      ])
      .png()
      .toBuffer();

    // Save the result
    await sharp(result).toFile(outputPath);
    console.log(`  Saved: ${outputPath}`);

    return true;
  } catch (error) {
    console.error(`  Error processing ${inputPath}:`, error.message);
    return false;
  }
}

async function generateScreenshots() {
  console.log('RoadLedger App Store Screenshot Generator\n');
  console.log('Demo Account Data Summary:');
  console.log(`  Total Revenue: $${DEMO_DATA.totalRevenue.toLocaleString()}`);
  console.log(`  Total Expenses: $${DEMO_DATA.totalExpenses.toLocaleString()}`);
  console.log(`  Net Profit: $${DEMO_DATA.netProfit.toLocaleString()}`);
  console.log(`  Total Miles: ${DEMO_DATA.totalMiles.toLocaleString()}`);
  console.log(`  Profit/Mile: $${DEMO_DATA.profitPerMile.toFixed(2)}`);
  console.log(`  States: ${DEMO_DATA.states.join(', ')}`);
  console.log(`  Trips: ${DEMO_DATA.tripsCount}`);
  console.log('');

  const assetsDir = path.join(__dirname, '..', 'assets', 'appstore');
  const rawDir = path.join(assetsDir, 'raw');
  const outputDir = path.join(assetsDir, 'screenshots');

  // Create directories if they don't exist
  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
    console.log(`Created raw screenshots directory: ${rawDir}`);
    console.log('\nTo generate screenshots:');
    console.log('1. Take raw screenshots of the app (while logged in as demo user)');
    console.log('2. Save them to assets/appstore/raw/ with names like:');
    SCREENSHOTS.forEach(s => {
      console.log(`   - ${s.filename}.png`);
    });
    console.log('3. Run this script again');
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Process each screenshot configuration
  for (const [sizeName, sizeConfig] of Object.entries(SCREENSHOT_CONFIGS)) {
    console.log(`\nProcessing ${sizeName} (${sizeConfig.description}):`);

    for (const screenshot of SCREENSHOTS) {
      const inputPath = path.join(rawDir, `${screenshot.filename}.png`);
      const outputPath = path.join(outputDir, `${sizeName}-${screenshot.id}-${screenshot.filename}.png`);

      if (fs.existsSync(inputPath)) {
        await processScreenshot(inputPath, outputPath, screenshot, sizeConfig);
      } else {
        console.log(`  Skipping: ${screenshot.filename}.png not found in raw/`);
      }
    }
  }

  console.log('\nDone!');
  console.log('\nScreenshot Instructions:');
  console.log('1. Open the iOS Simulator or run on a device');
  console.log('2. Log in with demo account: roadledger.demo.review@gmail.com');
  console.log('3. Navigate to each screen and take a screenshot');
  console.log('4. For best results, show real data on each screen');
  console.log('5. Save screenshots to assets/appstore/raw/');
  console.log('6. Run this script to add marketing overlays');
}

// Also export a function to just resize existing screenshots
async function resizeScreenshots(targetSize = 'iPhone-6.5') {
  const sizeConfig = SCREENSHOT_CONFIGS[targetSize];
  if (!sizeConfig) {
    console.error(`Unknown size: ${targetSize}`);
    console.log('Available sizes:', Object.keys(SCREENSHOT_CONFIGS).join(', '));
    return;
  }

  console.log(`Resizing screenshots to ${targetSize} (${sizeConfig.width}x${sizeConfig.height})...`);

  const inputDir = path.join(__dirname, '..', 'assets', 'appstore', 'screenshots');
  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.png'));

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = inputPath.replace('.png', `-${sizeConfig.width}x${sizeConfig.height}.png`);

    try {
      await sharp(inputPath)
        .resize(sizeConfig.width, sizeConfig.height, {
          fit: 'cover',
          position: 'top'
        })
        .toFile(outputPath);
      console.log(`  Resized: ${file}`);
    } catch (error) {
      console.error(`  Error: ${file} - ${error.message}`);
    }
  }
}

// Run the generator
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'resize') {
    resizeScreenshots(args[1]);
  } else {
    generateScreenshots().catch(console.error);
  }
}

module.exports = { generateScreenshots, resizeScreenshots, DEMO_DATA, SCREENSHOTS };
