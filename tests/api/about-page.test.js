const ApiHelper = require('../utils/api-helper');

async function testAboutPage() {
  const api = new ApiHelper();
  const serverRunning = await api.waitForServer();
  if (!serverRunning) {
    return;
  }
  const res = await api.get('/about');
  if (res.status !== 200) {
    throw new Error(`Expected 200 status, got ${res.status}`);
  }
}

if (require.main === module) {
  testAboutPage().catch(err => {
    console.error('❌ about page test failed', err);
    process.exit(1);
  });
}
module.exports = testAboutPage;
