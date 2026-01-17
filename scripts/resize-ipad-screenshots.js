const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// iPad 13" display requirement: 2064 x 2752 px (portrait)
const TARGET_WIDTH = 2064;
const TARGET_HEIGHT = 2752;

const sourceDir = 'C:/Users/maito/roadledger/assets/appstore/screenshots';
const outputDir = 'C:/Users/maito/roadledger/assets/appstore/ipad-screenshots';

async function resizeForIPad() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get all iPhone screenshots
  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.png'));

  console.log(`Resizing ${files.length} screenshots for iPad 13" (${TARGET_WIDTH}x${TARGET_HEIGHT}px)...\n`);

  for (const file of files) {
    const inputPath = path.join(sourceDir, file);
    const outputFilename = file.replace('1284x2778', `ipad-${TARGET_WIDTH}x${TARGET_HEIGHT}`);
    const outputPath = path.join(outputDir, outputFilename);

    try {
      // Get original image dimensions
      const metadata = await sharp(inputPath).metadata();

      // Calculate scaling to fit iPad aspect ratio while covering
      await sharp(inputPath)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: 'cover',
          position: 'top'  // Keep top of image (status bar area)
        })
        .png({ quality: 100 })
        .toFile(outputPath);

      console.log(`✓ ${file} → ${outputFilename}`);
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
    }
  }

  console.log(`\nDone! iPad screenshots saved to: ${outputDir}`);
  console.log(`\nUpload these to App Store Connect → Screenshots → 13" Display`);
}

resizeForIPad().catch(console.error);
