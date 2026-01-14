/**
 * RoadLedger Asset Generator
 * Generates app icons and splash screens for iOS, Android, and Web
 *
 * Run: node scripts/generate-assets.js
 */

const { createCanvas, registerFont } = require('canvas');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Ensure assets directory exists
const assetsDir = path.join(__dirname, '..', 'assets', 'images');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Brand colors
const COLORS = {
  primary: '#1E3A5F',      // Deep navy blue - trust, professionalism
  secondary: '#2ECC71',    // Green - profit, money
  accent: '#F39C12',       // Orange/Gold - premium, attention
  white: '#FFFFFF',
  dark: '#0D1B2A',
  lightBg: '#F8FAFC',
};

/**
 * Generate App Icon
 */
async function generateAppIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient (simulated with solid color)
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, 0, size, size);

  // Add subtle gradient effect
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, COLORS.primary);
  gradient.addColorStop(1, COLORS.dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Draw road/truck icon stylized
  const centerX = size / 2;
  const centerY = size / 2;
  const iconScale = size / 1024;

  // Dollar sign circle (profit-first focus)
  ctx.beginPath();
  ctx.arc(centerX, centerY - 50 * iconScale, 200 * iconScale, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.secondary;
  ctx.fill();

  // Dollar sign
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${280 * iconScale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', centerX, centerY - 40 * iconScale);

  // Road beneath (stylized)
  ctx.beginPath();
  ctx.moveTo(centerX - 180 * iconScale, centerY + 180 * iconScale);
  ctx.lineTo(centerX - 80 * iconScale, centerY + 100 * iconScale);
  ctx.lineTo(centerX + 80 * iconScale, centerY + 100 * iconScale);
  ctx.lineTo(centerX + 180 * iconScale, centerY + 180 * iconScale);
  ctx.lineTo(centerX + 250 * iconScale, centerY + 280 * iconScale);
  ctx.lineTo(centerX - 250 * iconScale, centerY + 280 * iconScale);
  ctx.closePath();
  ctx.fillStyle = '#374151';
  ctx.fill();

  // Road center line
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 8 * iconScale;
  ctx.setLineDash([20 * iconScale, 15 * iconScale]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + 100 * iconScale);
  ctx.lineTo(centerX, centerY + 280 * iconScale);
  ctx.stroke();
  ctx.setLineDash([]);

  // "RL" text at bottom
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${100 * iconScale}px Arial`;
  ctx.fillText('RL', centerX, centerY + 380 * iconScale);

  // Save as PNG
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(assetsDir, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${filename} (${size}x${size})`);

  return outputPath;
}

/**
 * Generate Adaptive Icon (Android) - Foreground only
 */
async function generateAdaptiveIconForeground(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;
  const iconScale = size / 1024;

  // Safe zone is 66% of the icon (Android adaptive icon spec)
  const safeZoneRadius = size * 0.33;

  // Dollar sign circle
  ctx.beginPath();
  ctx.arc(centerX, centerY - 30 * iconScale, 160 * iconScale, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.secondary;
  ctx.fill();

  // Dollar sign
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${220 * iconScale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', centerX, centerY - 20 * iconScale);

  // Road
  ctx.beginPath();
  ctx.moveTo(centerX - 120 * iconScale, centerY + 140 * iconScale);
  ctx.lineTo(centerX - 60 * iconScale, centerY + 80 * iconScale);
  ctx.lineTo(centerX + 60 * iconScale, centerY + 80 * iconScale);
  ctx.lineTo(centerX + 120 * iconScale, centerY + 140 * iconScale);
  ctx.lineTo(centerX + 160 * iconScale, centerY + 200 * iconScale);
  ctx.lineTo(centerX - 160 * iconScale, centerY + 200 * iconScale);
  ctx.closePath();
  ctx.fillStyle = '#374151';
  ctx.fill();

  // Road center line
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 6 * iconScale;
  ctx.setLineDash([15 * iconScale, 10 * iconScale]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + 80 * iconScale);
  ctx.lineTo(centerX, centerY + 200 * iconScale);
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(assetsDir, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${filename} (${size}x${size})`);

  return outputPath;
}

/**
 * Generate Splash Screen
 */
async function generateSplashScreen(width, height, filename) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, COLORS.primary);
  gradient.addColorStop(0.5, COLORS.dark);
  gradient.addColorStop(1, '#050A10');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) / 1000;

  // Animated road lines (static representation)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const y = height * 0.3 + (i * height * 0.08);
    const x1 = centerX - 100 * scale - (i * 30 * scale);
    const x2 = centerX + 100 * scale + (i * 30 * scale);
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  // Main logo circle
  ctx.beginPath();
  ctx.arc(centerX, centerY - 100 * scale, 150 * scale, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.secondary;
  ctx.shadowColor = COLORS.secondary;
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Dollar sign
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${200 * scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', centerX, centerY - 90 * scale);

  // App name
  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${80 * scale}px Arial`;
  ctx.fillText('RoadLedger', centerX, centerY + 100 * scale);

  // Tagline
  ctx.fillStyle = COLORS.secondary;
  ctx.font = `${32 * scale}px Arial`;
  ctx.fillText('Know Your Profit. Every Mile.', centerX, centerY + 170 * scale);

  // Bottom decoration - profit metrics preview
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(centerX - 200 * scale, centerY + 250 * scale, 400 * scale, 80 * scale);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = `${24 * scale}px Arial`;
  ctx.fillText('$/mile  ·  $/load  ·  $/day', centerX, centerY + 295 * scale);

  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(assetsDir, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${filename} (${width}x${height})`);

  return outputPath;
}

/**
 * Generate Favicon for web
 */
async function generateFavicon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Simple favicon - just the dollar sign in green circle
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, 0, size, size);

  const centerX = size / 2;
  const centerY = size / 2;
  const iconScale = size / 64;

  ctx.beginPath();
  ctx.arc(centerX, centerY, 24 * iconScale, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.secondary;
  ctx.fill();

  ctx.fillStyle = COLORS.white;
  ctx.font = `bold ${32 * iconScale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', centerX, centerY + 2 * iconScale);

  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(assetsDir, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${filename} (${size}x${size})`);

  return outputPath;
}

/**
 * Generate all required assets
 */
async function generateAllAssets() {
  console.log('🚀 RoadLedger Asset Generator\n');
  console.log('Generating app icons...');

  // App icons for various platforms
  await generateAppIcon(1024, 'icon.png');           // Main icon
  await generateAppIcon(512, 'icon-512.png');        // Web
  await generateAppIcon(192, 'icon-192.png');        // PWA
  await generateAdaptiveIconForeground(1024, 'adaptive-icon.png');  // Android adaptive

  console.log('\nGenerating splash screens...');

  // Splash screens
  await generateSplashScreen(1284, 2778, 'splash.png');           // iPhone 13 Pro Max
  await generateSplashScreen(1170, 2532, 'splash-iphone12.png');  // iPhone 12
  await generateSplashScreen(1080, 1920, 'splash-android.png');   // Android FHD
  await generateSplashScreen(2048, 2732, 'splash-tablet.png');    // iPad Pro

  console.log('\nGenerating web assets...');

  // Favicon
  await generateFavicon(64, 'favicon.png');
  await generateFavicon(32, 'favicon-32.png');

  console.log('\n✅ All assets generated successfully!');
  console.log(`📁 Output directory: ${assetsDir}`);
}

// Run the generator
generateAllAssets().catch(console.error);
