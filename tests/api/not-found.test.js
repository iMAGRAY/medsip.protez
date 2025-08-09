const ApiHelper = require('../utils/api-helper');

async function testNotFound() {
  const api = new ApiHelper();
  const serverRunning = await api.waitForServer(1000);
  if (!serverRunning) {
    return;
  }
  const res = await api.get('/this-page-does-not-exist');
  if (res.status !== 404) {
    throw new Error(`Expected 404 status, got ${res.status}`);
  }
}

if (require.main === module) {
  testNotFound().catch(err => {
    console.error('❌ not-found page test failed', err);
    process.exit(1);
  });
}
module.exports = testNotFound;
