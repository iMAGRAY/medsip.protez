const fs = require('fs');
const path = require('path');

// Список файлов для исправления
const files = [
  'app/api/variants/[id]/tags/route.ts',
  'app/api/products/[id]/characteristics/route.ts',
  'app/api/products/[id]/characteristics-simple/route.ts',
  'app/api/product-sizes/[id]/route.ts',
  'app/api/products/[id]/characteristics-templates/route.ts',
  'app/api/admin/products/[id]/sizes/route.ts',
  'app/api/products/[id]/selection-tables/route.ts',
  'app/api/products/[id]/variant/route.ts',
  'app/api/v2/product-variants/[id]/route.ts',
  'app/api/product-variants/[id]/characteristics/route.ts',
  'app/api/products/[id]/selection-tables/existing/route.ts',
  'app/api/products/[id]/selection-tables/new/route.ts',
  'app/api/warehouse/sections/[id]/route.ts',
  'app/api/variants/[id]/warehouse-stock/route.ts',
  'app/api/products/[id]/warehouse-stock/route.ts',
  'app/api/products/[id]/sizes/route.ts',
  'app/api/products/[id]/configurable-characteristics/route.ts',
  'app/api/products/[id]/images/route.ts',
  'app/api/product-variants/[id]/characteristics-simple/route.ts',
  'app/api/product-variants/[id]/route.ts',
  'app/api/product-specifications/[id]/route.ts',
  'app/api/orders/[id]/route.ts',
  'app/api/model-lines/[id]/products/route.ts',
  'app/api/model-lines/[id]/route.ts',
  'app/api/manufacturers/[id]/model-lines/route.ts',
  'app/api/manufacturers/[id]/route.ts',
  'app/api/form-templates/[id]/route.ts',
  'app/api/catalog-files/[id]/route.ts',
  'app/api/admin/characteristic-templates/[id]/route.ts',
  'app/api/admin/roles/[id]/route.ts',
  'app/api/admin/users/[id]/route.ts',
  'app/api/catalog-files/[id]/download/route.ts'
];

let fixedCount = 0;
let errorCount = 0;

console.log('Starting async params fix...\n');

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️ File not found: ${filePath}`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Pattern 1: { params }: { params: { id: string } }
    const pattern1 = /\{ params \}: \{ params: \{ id: string \} \}/g;
    const replacement1 = '{ params }: { params: Promise<{ id: string }> }';
    
    // Pattern 2: params.id direct usage
    const pattern2 = /const (\w+) = parseInt\(params\.id\)/g;
    const replacement2 = 'const { id } = await params\n    const $1 = parseInt(id)';
    
    let modified = false;
    
    if (content.includes('{ params }: { params: { id: string } }')) {
      content = content.replace(pattern1, replacement1);
      modified = true;
    }
    
    if (content.includes('parseInt(params.id)')) {
      content = content.replace(pattern2, replacement2);
      modified = true;
    }
    
    // Handle other params.id patterns
    if (content.includes('params.id') && !content.includes('await params')) {
      content = content.replace(/params\.id/g, '(await params).id');
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      fixedCount++;
    } else {
      console.log(`ℹ️ No changes needed: ${filePath}`);
    }
    
  } catch (error) {
    console.log(`❌ Error processing ${filePath}:`, error.message);
    errorCount++;
  }
});

console.log(`\n=== SUMMARY ===`);
console.log(`Fixed: ${fixedCount} files`);
console.log(`Errors: ${errorCount} files`);
console.log(`Total processed: ${files.length} files`);