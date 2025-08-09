const ApiHelper = require('../utils/api-helper');

async function testManufacturersAPI() {
  const api = new ApiHelper();
  const serverRunning = await api.waitForServer();
  if (!serverRunning) {
    return;
  }
  const res = await api.get('/api/manufacturers');
  if (!res.ok) throw new Error('Request failed');
  const data = res.data;

  if (!data || !data.success || !Array.isArray(data.data)) {
    throw new Error('Expected {success: true, data: [...]} format');
  }
}

if (require.main === module) {
  testManufacturersAPI().catch(err => {
    console.error('❌ manufacturers API test failed', err);
    process.exit(1);
  });
}
module.exports = testManufacturersAPI;
