import { promises as fs } from 'fs';
import path from 'path';

interface ImageVariant {
  name: string;
  expectedSize: number;
  tolerance: number; // bytes
}

const variants: ImageVariant[] = [
  { name: 'crown-of-technology-36.webp', expectedSize: 590, tolerance: 50 },
  { name: 'crown-of-technology-48.webp', expectedSize: 792, tolerance: 50 },
  { name: 'crown-of-technology-64.webp', expectedSize: 974, tolerance: 50 },
  { name: 'crown-of-technology-128.webp', expectedSize: 1800, tolerance: 100 },
];

async function verifyImageVariants() {
  console.log('🔍 Verifying image variants...\n');

  let allPassed = true;

  for (const variant of variants) {
    const imagePath = path.join(process.cwd(), 'public', variant.name);

    try {
      const stats = await fs.stat(imagePath);
      const actualSize = stats.size;
      const sizeDiff = Math.abs(actualSize - variant.expectedSize);

      if (sizeDiff <= variant.tolerance) {
        console.log(`✅ ${variant.name.padEnd(35)} ${actualSize} bytes (expected ~${variant.expectedSize})`);
      } else {
        console.log(`⚠️  ${variant.name.padEnd(35)} ${actualSize} bytes (expected ~${variant.expectedSize}, diff: ${sizeDiff})`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ${variant.name.padEnd(35)} NOT FOUND`);
      allPassed = false;
    }
  }

  console.log('\n');

  if (allPassed) {
    console.log('✨ All image variants verified successfully!');
  } else {
    console.log('⚠️  Some variants have issues. Please review above.');
    process.exit(1);
  }
}

verifyImageVariants().catch(console.error);
