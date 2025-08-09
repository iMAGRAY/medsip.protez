const DatabaseHelper = require('../utils/db-helper');

async function testDatabaseConnection() {
  const db = new DatabaseHelper();
  const ok = await db.testConnection();
  if (ok) {
  } else {
  }
  await db.close();
}

if (require.main === module) {
  testDatabaseConnection().catch(err => {
    console.error('❌ database test failed', err);
    process.exit(1);
  });
}
module.exports = testDatabaseConnection;
