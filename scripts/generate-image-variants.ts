import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const sizes = [
  { width: 36, name: 'crown-of-technology-36.webp' },
  { width: 48, name: 'crown-of-technology-48.webp' },
  { width: 64, name: 'crown-of-technology-64.webp' },
  { width: 128, name: 'crown-of-technology-128.webp' }, // 2x for 64px
];

async function generateImageVariants() {
  const inputPath = path.join(process.cwd(), 'public', 'crown-of-technology.webp');
  const outputDir = path.join(process.cwd(), 'public');

  console.log('🖼️  Generating responsive image variants...\n');

  // Verify input file exists
  try {
    await fs.access(inputPath);
  } catch (error) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Get original image info
  const metadata = await sharp(inputPath).metadata();
  console.log(`📊 Original image: ${metadata.width}x${metadata.height}, ${(metadata.size! / 1024).toFixed(2)} KB\n`);

  let totalSaved = 0;
  const originalSize = metadata.size!;

  for (const size of sizes) {
    const outputPath = path.join(outputDir, size.name);

    await sharp(inputPath)
      .resize(size.width, size.width, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 90 })
      .toFile(outputPath);

    const stats = await fs.stat(outputPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    console.log(`✅ Generated ${size.name.padEnd(35)} ${size.width}x${size.width}  ${sizeKB} KB`);

    totalSaved += (originalSize - stats.size);
  }

  console.log(`\n📦 Total bandwidth saved per page load: ${(totalSaved / 1024).toFixed(2)} KB`);
  console.log('✨ Image variants generated successfully!');
}

generateImageVariants().catch(console.error);
