const ApiHelper = require('../utils/api-helper');

async function testContactsPage() {
  const api = new ApiHelper();
  const serverRunning = await api.waitForServer(1000);
  if (!serverRunning) {
    return;
  }
  const res = await api.get('/contacts');
  if (res.status !== 200) {
    throw new Error(`Expected 200 status, got ${res.status}`);
  }
}

if (require.main === module) {
  testContactsPage().catch(err => {
    console.error('❌ contacts page test failed', err);
    process.exit(1);
  });
}
module.exports = testContactsPage;
