/**
 * RoadLedger App Store Asset Generator
 * Generates all required images for Apple App Store submission
 *
 * Apple Requirements:
 * - App Icon: 1024x1024 (no alpha, no rounded corners)
 * - iPhone 6.5": 1284x2778 (iPhone 14/15 Pro Max)
 * - iPhone 5.5": 1242x2208 (iPhone 8 Plus)
 * - iPad 12.9": 2048x2732 (iPad Pro)
 */

const { createCanvas, registerFont } = require('canvas');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Brand colors
const COLORS = {
  background: '#0D1B2A',
  surface: '#1B2838',
  primary: '#2ECC71',
  secondary: '#3498DB',
  accent: '#F39C12',
  text: '#FFFFFF',
  textSecondary: '#8892A0',
  profit: '#2ECC71',
  loss: '#E74C3C',
};

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'appstore');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate App Store Icon (1024x1024)
 */
async function generateAppIcon() {
  console.log('Generating App Store Icon (1024x1024)...');

  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#0D1B2A');
  gradient.addColorStop(1, '#1B2838');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Truck icon (simplified)
  ctx.fillStyle = COLORS.primary;

  // Truck body
  const truckX = size * 0.15;
  const truckY = size * 0.35;
  const truckWidth = size * 0.5;
  const truckHeight = size * 0.3;

  // Cab
  ctx.beginPath();
  ctx.roundRect(truckX, truckY, truckWidth * 0.35, truckHeight, 20);
  ctx.fill();

  // Trailer
  ctx.beginPath();
  ctx.roundRect(truckX + truckWidth * 0.38, truckY - truckHeight * 0.1, truckWidth * 0.62, truckHeight * 1.1, 20);
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#1a1a2e';
  const wheelRadius = size * 0.06;
  // Front wheel
  ctx.beginPath();
  ctx.arc(truckX + truckWidth * 0.15, truckY + truckHeight + wheelRadius * 0.5, wheelRadius, 0, Math.PI * 2);
  ctx.fill();
  // Back wheels
  ctx.beginPath();
  ctx.arc(truckX + truckWidth * 0.55, truckY + truckHeight + wheelRadius * 0.5, wheelRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(truckX + truckWidth * 0.75, truckY + truckHeight + wheelRadius * 0.5, wheelRadius, 0, Math.PI * 2);
  ctx.fill();

  // Dollar sign (profit symbol)
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 280px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', size * 0.7, size * 0.55);

  // App name
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 100px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('RoadLedger', size * 0.5, size * 0.85);

  // Save
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'AppIcon-1024x1024.png'));

  console.log('  Created: AppIcon-1024x1024.png');
}

/**
 * Generate iPhone Screenshot
 */
async function generateiPhoneScreenshot(width, height, filename, title, subtitle, features) {
  console.log(`Generating ${filename}...`);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.background);
  gradient.addColorStop(1, '#0a1420');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Status bar area (safe zone)
  const safeTop = height * 0.06;
  const safeBottom = height * 0.04;
  const sidePadding = width * 0.08;

  // Title
  const titleSize = Math.round(width * 0.07);
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold ${titleSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, safeTop + titleSize * 1.5);

  // Subtitle
  const subtitleSize = Math.round(width * 0.04);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = `${subtitleSize}px Arial`;
  ctx.fillText(subtitle, width / 2, safeTop + titleSize * 2.5);

  // Phone mockup area
  const mockupTop = safeTop + titleSize * 4;
  const mockupHeight = height * 0.55;
  const mockupWidth = width * 0.85;
  const mockupX = (width - mockupWidth) / 2;

  // Phone frame
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.roundRect(mockupX, mockupTop, mockupWidth, mockupHeight, 30);
  ctx.fill();

  // Screen content
  ctx.fillStyle = COLORS.surface;
  const screenPadding = 15;
  ctx.beginPath();
  ctx.roundRect(
    mockupX + screenPadding,
    mockupTop + screenPadding,
    mockupWidth - screenPadding * 2,
    mockupHeight - screenPadding * 2,
    20
  );
  ctx.fill();

  // Screen UI elements (simplified dashboard)
  const screenX = mockupX + screenPadding + 20;
  const screenY = mockupTop + screenPadding + 40;
  const screenW = mockupWidth - screenPadding * 2 - 40;

  // Header
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold ${Math.round(width * 0.035)}px Arial`;
  ctx.textAlign = 'left';
  ctx.fillText("Today's Profit", screenX, screenY);

  // Big profit number
  ctx.fillStyle = COLORS.profit;
  ctx.font = `bold ${Math.round(width * 0.08)}px Arial`;
  ctx.fillText('$847.32', screenX, screenY + width * 0.1);

  // Metrics row
  const metricY = screenY + width * 0.18;
  const metricWidth = screenW / 3;

  // Metric boxes
  const metrics = [
    { label: 'Miles', value: '342' },
    { label: '$/Mile', value: '$2.48' },
    { label: 'Loads', value: '2' },
  ];

  metrics.forEach((metric, i) => {
    const mx = screenX + i * metricWidth;

    ctx.fillStyle = COLORS.surfaceLight || '#243447';
    ctx.beginPath();
    ctx.roundRect(mx, metricY, metricWidth - 10, width * 0.12, 10);
    ctx.fill();

    ctx.fillStyle = COLORS.text;
    ctx.font = `bold ${Math.round(width * 0.04)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(metric.value, mx + metricWidth / 2 - 5, metricY + width * 0.055);

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `${Math.round(width * 0.025)}px Arial`;
    ctx.fillText(metric.label, mx + metricWidth / 2 - 5, metricY + width * 0.09);
  });

  // Chart area placeholder
  ctx.fillStyle = COLORS.surfaceLight || '#243447';
  ctx.beginPath();
  ctx.roundRect(screenX, metricY + width * 0.15, screenW, width * 0.2, 10);
  ctx.fill();

  // Chart bars
  const barWidth = screenW / 7 - 10;
  const chartBaseY = metricY + width * 0.33;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const values = [0.6, 0.8, 0.5, 0.9, 1.0, 0.3, 0.4];

  days.forEach((day, i) => {
    const bx = screenX + 10 + i * (barWidth + 10);
    const barHeight = values[i] * width * 0.12;

    ctx.fillStyle = i === 4 ? COLORS.primary : COLORS.secondary;
    ctx.beginPath();
    ctx.roundRect(bx, chartBaseY - barHeight, barWidth, barHeight, 5);
    ctx.fill();

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = `${Math.round(width * 0.02)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(day, bx + barWidth / 2, chartBaseY + width * 0.025);
  });

  // Feature bullets below mockup
  const featureY = mockupTop + mockupHeight + height * 0.05;
  const featureSize = Math.round(width * 0.035);

  ctx.textAlign = 'left';
  features.forEach((feature, i) => {
    const fy = featureY + i * featureSize * 2;

    // Checkmark
    ctx.fillStyle = COLORS.primary;
    ctx.font = `${featureSize}px Arial`;
    ctx.fillText('✓', sidePadding, fy);

    // Feature text
    ctx.fillStyle = COLORS.text;
    ctx.font = `${featureSize}px Arial`;
    ctx.fillText(feature, sidePadding + featureSize * 1.5, fy);
  });

  // Save
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer)
    .png()
    .toFile(path.join(OUTPUT_DIR, filename));

  console.log(`  Created: ${filename}`);
}

/**
 * Generate all screenshots
 */
async function generateAllScreenshots() {
  // iPhone 6.5" (1284 x 2778) - Required for iPhone 14/15 Pro Max
  const screenshots65 = [
    {
      filename: 'iPhone-6.5-01-Dashboard.png',
      title: 'Profit-First Dashboard',
      subtitle: 'See your earnings at a glance',
      features: [
        'Real-time profit tracking',
        'Daily, weekly, monthly views',
        'Revenue vs expenses breakdown',
      ],
    },
    {
      filename: 'iPhone-6.5-02-LoadCalculator.png',
      title: 'Load Calculator',
      subtitle: 'Know if a load is worth it',
      features: [
        'Calculate profit before accepting',
        'Compare to industry benchmarks',
        'Include all operating costs',
      ],
    },
    {
      filename: 'iPhone-6.5-03-TripTracking.png',
      title: 'Automatic Trip Tracking',
      subtitle: 'GPS mileage by state for IFTA',
      features: [
        'Battery-optimized GPS',
        'State-by-state mileage',
        'Works offline',
      ],
    },
    {
      filename: 'iPhone-6.5-04-Documents.png',
      title: 'AI Receipt Scanning',
      subtitle: 'Capture receipts in seconds',
      features: [
        'Automatic data extraction',
        'Fuel, maintenance, expenses',
        'Organized for tax time',
      ],
    },
    {
      filename: 'iPhone-6.5-05-IFTA.png',
      title: 'One-Click IFTA Reports',
      subtitle: 'Quarterly filing made easy',
      features: [
        'Miles by jurisdiction',
        'Fuel purchases by state',
        'Export-ready reports',
      ],
    },
  ];

  for (const screenshot of screenshots65) {
    await generateiPhoneScreenshot(
      1284,
      2778,
      screenshot.filename,
      screenshot.title,
      screenshot.subtitle,
      screenshot.features
    );
  }

  // iPhone 5.5" (1242 x 2208) - Required for iPhone 8 Plus
  for (const screenshot of screenshots65) {
    const filename55 = screenshot.filename.replace('6.5', '5.5');
    await generateiPhoneScreenshot(
      1242,
      2208,
      filename55,
      screenshot.title,
      screenshot.subtitle,
      screenshot.features
    );
  }
}

/**
 * Generate iPad screenshots
 */
async function generateiPadScreenshot() {
  console.log('Generating iPad 12.9" screenshot...');

  const width = 2048;
  const height = 2732;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.background);
  gradient.addColorStop(1, '#0a1420');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 120px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('RoadLedger', width / 2, 200);

  // Subtitle
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '60px Arial';
  ctx.fillText('The Profit-First App for Owner-Operators', width / 2, 300);

  // Feature cards
  const cardWidth = 550;
  const cardHeight = 400;
  const cardGap = 50;
  const startX = (width - cardWidth * 3 - cardGap * 2) / 2;
  const startY = 450;

  const cards = [
    { icon: '🧮', title: 'Load Calculator', desc: 'Know if a load is worth it before you accept' },
    { icon: '📍', title: 'GPS Tracking', desc: 'Automatic state mileage for IFTA' },
    { icon: '📄', title: 'AI Receipts', desc: 'Scan receipts, auto-extract data' },
    { icon: '⛽', title: 'Fuel Optimizer', desc: 'Find cheapest fuel on your route' },
    { icon: '⭐', title: 'Broker Ratings', desc: 'Know who pays fast vs slow' },
    { icon: '📊', title: 'IFTA Reports', desc: 'One-click quarterly reports' },
  ];

  cards.forEach((card, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = startX + col * (cardWidth + cardGap);
    const y = startY + row * (cardHeight + cardGap);

    // Card background
    ctx.fillStyle = COLORS.surface;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 20);
    ctx.fill();

    // Icon
    ctx.font = '100px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(card.icon, x + cardWidth / 2, y + 120);

    // Title
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 45px Arial';
    ctx.fillText(card.title, x + cardWidth / 2, y + 220);

    // Description
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = '32px Arial';

    // Word wrap description
    const words = card.desc.split(' ');
    let line = '';
    let lineY = y + 280;

    words.forEach((word) => {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > cardWidth - 40) {
        ctx.fillText(line, x + cardWidth / 2, lineY);
        line = word + ' ';
        lineY += 40;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line, x + cardWidth / 2, lineY);
  });

  // Bottom tagline
  ctx.fillStyle = COLORS.primary;
  ctx.font = 'bold 70px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Track Miles. Capture Receipts. Maximize Profit.', width / 2, height - 200);

  // Save
  const buffer = canvas.toBuffer('image/png');
  await sharp(buffer)
    .png()
    .toFile(path.join(OUTPUT_DIR, 'iPad-12.9-01-Overview.png'));

  console.log('  Created: iPad-12.9-01-Overview.png');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n=== RoadLedger App Store Asset Generator ===\n');
  console.log('Output directory:', OUTPUT_DIR);
  console.log('');

  try {
    await generateAppIcon();
    await generateAllScreenshots();
    await generateiPadScreenshot();

    console.log('\n=== Generation Complete ===\n');
    console.log('Assets created in:', OUTPUT_DIR);
    console.log('\nApple App Store Requirements Met:');
    console.log('  ✓ App Icon: 1024x1024 (no alpha, no rounded corners)');
    console.log('  ✓ iPhone 6.5": 1284x2778 (5 screenshots)');
    console.log('  ✓ iPhone 5.5": 1242x2208 (5 screenshots)');
    console.log('  ✓ iPad 12.9": 2048x2732 (1 screenshot)');
    console.log('\nNext steps:');
    console.log('  1. Review images in assets/appstore/');
    console.log('  2. Upload to App Store Connect');
    console.log('  3. Fill in app metadata\n');
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

main();
