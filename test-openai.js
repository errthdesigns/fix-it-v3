// Quick test script to verify OpenAI API key
const fetch = require('node-fetch');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_KEY_HERE';

async function testOpenAI() {
  try {
    console.log('Testing OpenAI API key...');
    console.log('Key starts with:', OPENAI_API_KEY.substring(0, 10) + '...');

    // Test basic API access
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', response.status, error);
      return;
    }

    const data = await response.json();
    console.log('✅ API Key is valid!');
    console.log('Available models:', data.data.length);

    // Check for GPT-4o (needed for vision)
    const hasGPT4o = data.data.some(m => m.id === 'gpt-4o');
    console.log('Has gpt-4o access:', hasGPT4o ? '✅ Yes' : '❌ No');

    if (!hasGPT4o) {
      console.warn('⚠️  Your account may not have access to gpt-4o (Vision API)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testOpenAI();
