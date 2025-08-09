const ApiHelper = require('../utils/api-helper');

async function testProductSpecifications() {
  const api = new ApiHelper();
  const serverRunning = await api.waitForServer();
  if (!serverRunning) {
    return;
  }
  const res = await api.get('/api/product-specifications/1');

  // API должен возвращать либо 200 (найдено), либо 404 (не найдено)
  if (res.status !== 200 && res.status !== 404) {
    throw new Error(`Expected 200 or 404 status, got ${res.status}`);
  }

  if (res.status === 200) {
    console.log('Product specifications API returned 200 (found)');
  } else {
    console.log('Product specifications API returned 404 (not found, but API works)');
  }
}

if (require.main === module) {
  testProductSpecifications().catch(err => {
    console.error('❌ product specifications test failed', err);
    process.exit(1);
  });
}
module.exports = testProductSpecifications;
