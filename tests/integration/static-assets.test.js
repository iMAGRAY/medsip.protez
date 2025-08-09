const fs = require('fs');
const path = require('path');

async function testStaticAssets() {
  const gitignorePath = path.join(__dirname, '../../public/.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    throw new Error('Missing public/.gitignore');
  }
  const content = fs.readFileSync(gitignorePath, 'utf8');
  if (!content.includes('*.webp')) {
    throw new Error('public/.gitignore must exclude images');
  }

  // Ensure example env has hero image variable and contact info
  const envPath = path.join(__dirname, '../../.env.example');
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (!envContent.includes('NEXT_PUBLIC_HERO_IMAGE_URL')) {
    throw new Error('Missing NEXT_PUBLIC_HERO_IMAGE_URL in .env.example');
  }
  if (!envContent.includes('NEXT_PUBLIC_HERO_TITLE')) {
    throw new Error('Missing NEXT_PUBLIC_HERO_TITLE in .env.example');
  }
  if (!envContent.includes('NEXT_PUBLIC_HERO_SUBTITLE')) {
    throw new Error('Missing NEXT_PUBLIC_HERO_SUBTITLE in .env.example');
  }
  if (!envContent.includes('NEXT_PUBLIC_CONTACT_PHONE')) {
    throw new Error('Missing NEXT_PUBLIC_CONTACT_PHONE in .env.example');
  }
  if (!envContent.includes('NEXT_PUBLIC_CONTACT_EMAIL')) {
    throw new Error('Missing NEXT_PUBLIC_CONTACT_EMAIL in .env.example');
  }
  if (!envContent.includes('NEXT_PUBLIC_CONTACT_ADDRESS')) {
    throw new Error('Missing NEXT_PUBLIC_CONTACT_ADDRESS in .env.example');
  }
  if (!envContent.includes('NEXT_PUBLIC_S3_ENDPOINT')) {
    throw new Error('Missing NEXT_PUBLIC_S3_ENDPOINT in .env.example');
  }

  const errorPagePath = path.join(__dirname, '../../app/error.tsx');
  if (!fs.existsSync(errorPagePath)) {
    throw new Error('Missing global error page');
  }
}

if (require.main === module) {
  testStaticAssets().catch(err => {
    console.error('❌ static assets test failed', err);
    process.exit(1);
  });
}
module.exports = testStaticAssets;
