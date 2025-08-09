const ApiHelper = require('../utils/api-helper');

async function testSiteSettingsAPI() {
  const api = new ApiHelper();
  const serverRunning = await api.waitForServer();
  if (!serverRunning) {
    return;
  }
  const res = await api.get('/api/site-settings');
  if (!res.ok) throw new Error('Request failed');
  const data = res.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Expected site settings object');
  }
}

if (require.main === module) {
  testSiteSettingsAPI().catch(err => {
    console.error('❌ site-settings API test failed', err);
    process.exit(1);
  });
}
module.exports = testSiteSettingsAPI;
