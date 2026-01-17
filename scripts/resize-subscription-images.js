const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// App Store subscription image requirement: 1024 x 1024
const TARGET_SIZE = 1024;

const sourceDir = 'C:/Users/maito/Downloads';
const outputDir = 'C:/Users/maito/roadledger/assets/appstore/subscriptions';

// Map source files to proper labels
const imageMap = [
  { source: 'IMG_5034.jpg', output: 'pro-monthly-1024x1024.png', label: 'Pro Monthly' },
  { source: 'IMG_5032.jpg', output: 'pro-yearly-1024x1024.png', label: 'Pro Yearly' },
  { source: 'IMG_5035.jpg', output: 'premium-monthly-1024x1024.png', label: 'Premium Monthly' },
  { source: 'IMG_5033.jpg', output: 'premium-yearly-1024x1024.png', label: 'Premium Yearly' },
];

async function resizeImages() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Resizing subscription images to ${TARGET_SIZE}x${TARGET_SIZE}px...\n`);

  for (const img of imageMap) {
    const inputPath = path.join(sourceDir, img.source);
    const outputPath = path.join(outputDir, img.output);

    try {
      await sharp(inputPath)
        .resize(TARGET_SIZE, TARGET_SIZE, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 100 })
        .toFile(outputPath);

      console.log(`✓ ${img.label}: ${img.source} → ${img.output}`);
    } catch (error) {
      console.error(`✗ Error processing ${img.source}:`, error.message);
    }
  }

  console.log(`\nDone! Images saved to: ${outputDir}`);
  console.log(`\nUpload to App Store Connect → Subscriptions → Each product → Promotional Image`);
}

resizeImages().catch(console.error);
