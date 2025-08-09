const fetch = require('node-fetch');

async function verifySiteSettingsAPI() {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://medsip-protez.ru/api'
    : 'http://localhost:3000/api';
  const testData = {
    siteName: 'Test Site Name',
    siteDescription: 'Test Description',
    heroTitle: 'Test Hero Title',
    contactEmail: 'test@example.com',
    contactPhone: '+7 (999) 123-45-67'
  };

  try {
    // Test 1: GET method
    const getResponse = await fetch(`${baseUrl}/site-settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log('   📊 Response keys:', Object.keys(data));
    } else {
      const errorText = await getResponse.text();
      console.log('   ❌ GET failed:', errorText.substring(0, 200));
    }
    // Test 2: OPTIONS method
    const optionsResponse = await fetch(`${baseUrl}/site-settings`, {
      method: 'OPTIONS',
    });
    const allowedMethods = optionsResponse.headers.get('Access-Control-Allow-Methods');
    // Test 3: PUT method
    const putResponse = await fetch(`${baseUrl}/site-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    if (putResponse.ok) {
      const data = await putResponse.json();
    } else {
      const errorText = await putResponse.text();
      console.log('   ❌ PUT failed:', errorText.substring(0, 200));
    }
    // Test 4: POST method (fallback)
    const postResponse = await fetch(`${baseUrl}/site-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    if (postResponse.ok) {
      const data = await postResponse.json();
    } else {
      const errorText = await postResponse.text();
      console.log('   ❌ POST failed:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('💥 Verification failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the verification
verifySiteSettingsAPI();