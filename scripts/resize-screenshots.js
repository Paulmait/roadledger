const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// App Store required dimensions for 6.7" display (iPhone 14 Pro Max)
const TARGET_WIDTH = 1284;
const TARGET_HEIGHT = 2778;

const sourceDir = 'C:/Users/maito/Downloads';
const outputDir = 'C:/Users/maito/roadledger/assets/appstore/screenshots';

const screenshots = [
  'IMG_5021.PNG',
  'IMG_5022.PNG',
  'IMG_5023.PNG',
  'IMG_5024.PNG',
  'IMG_5025.PNG',
  'IMG_5026.PNG',
  'IMG_5027.PNG',
  'IMG_5028.PNG',
  'IMG_5029.PNG'
];

async function resizeScreenshots() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Resizing screenshots to ${TARGET_WIDTH}x${TARGET_HEIGHT}px...\n`);

  for (let i = 0; i < screenshots.length; i++) {
    const filename = screenshots[i];
    const inputPath = path.join(sourceDir, filename);
    const outputFilename = `screenshot-${String(i + 1).padStart(2, '0')}-${TARGET_WIDTH}x${TARGET_HEIGHT}.png`;
    const outputPath = path.join(outputDir, outputFilename);

    try {
      await sharp(inputPath)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 100 })
        .toFile(outputPath);

      console.log(`✓ ${filename} → ${outputFilename}`);
    } catch (error) {
      console.error(`✗ Error processing ${filename}:`, error.message);
    }
  }

  console.log(`\nDone! Screenshots saved to: ${outputDir}`);
  console.log(`\nApp Store requirements met:`);
  console.log(`- iPhone 6.7" (1284 x 2778px) ✓`);
}

resizeScreenshots().catch(console.error);
