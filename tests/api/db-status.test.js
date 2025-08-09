const ApiHelper = require('../utils/api-helper');

async function testDbStatus() {
  const api = new ApiHelper();
  const serverRunning = await api.waitForServer();
  if (!serverRunning) {
    return;
  }
  const res = await api.get('/api/db-status');
  if (!res.ok) throw new Error('Request failed');
  const data = res.data;
  if (!data || (data.status !== 'ok' && data.status !== 'error')) {
    throw new Error('Invalid response');
  }
}

if (require.main === module) {
  testDbStatus().catch(err => {
    console.error('❌ db-status API test failed', err);
    process.exit(1);
  });
}
module.exports = testDbStatus;
