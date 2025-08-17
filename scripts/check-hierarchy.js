const http = require('http');

http.get('http://localhost:3000/api/categories', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    const cats = result.data || [];
    
    console.log('=== CATEGORY HIERARCHY CHECK ===\n');
    console.log('Total root categories:', cats.length);
    
    let totalChildren = 0;
    let maxDepth = 1;
    
    // Функция для проверки глубины
    function checkDepth(category, currentDepth = 1) {
      if (currentDepth > maxDepth) maxDepth = currentDepth;
      if (category.children && category.children.length > 0) {
        category.children.forEach(child => {
          checkDepth(child, currentDepth + 1);
        });
      }
    }
    
    // Проверяем каждую категорию
    const withChildren = [];
    const withoutChildren = [];
    
    cats.forEach(cat => {
      checkDepth(cat);
      
      if (cat.children && cat.children.length > 0) {
        withChildren.push(cat);
        totalChildren += cat.children.length;
      } else {
        withoutChildren.push(cat);
      }
    });
    
    console.log('\n=== CATEGORIES WITH CHILDREN ===');
    withChildren.forEach(cat => {
      console.log(`\n${cat.name} (${cat.children.length} children):`);
      cat.children.forEach(child => {
        console.log(`  └─ ${child.name}`);
        if (child.children && child.children.length > 0) {
          child.children.forEach(subchild => {
            console.log(`     └─ ${subchild.name}`);
          });
        }
      });
    });
    
    console.log('\n=== CATEGORIES WITHOUT CHILDREN ===');
    withoutChildren.forEach(cat => {
      console.log(`- ${cat.name}`);
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Root categories: ${cats.length}`);
    console.log(`Categories with children: ${withChildren.length}`);
    console.log(`Categories without children: ${withoutChildren.length}`);
    console.log(`Total children: ${totalChildren}`);
    console.log(`Maximum depth: ${maxDepth} levels`);
    
    // Проверяем проблему
    if (maxDepth === 1) {
      console.log('\n⚠️ WARNING: No nested children found! Hierarchy might be broken.');
    } else {
      console.log('\n✅ Hierarchy structure is working correctly.');
    }
  });
}).on('error', err => {
  console.error('Error:', err.message);
});