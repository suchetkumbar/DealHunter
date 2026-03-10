const https = require('https');

// Array of common chatbot/AI automation script domains and keywords
const AI_INDICATORS = [
    'intercom.io',
    'drift.com',
    'botpress',
    'chatbase',
    'crisp.chat',
    'zendesk',
    'tidio',
    'tawk.to',
    'hubspot.com/conversations',
    'livechat',
    'openai',
    'anthropic'
];

function analyzeWebsite(url) {
    console.log(`Analyzing ${url} for AI maturity...`);
    
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            let data = '';
            
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`Redirected to ${res.headers.location}`);
                return analyzeWebsite(res.headers.location).then(resolve).catch(reject);
            }

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const lowerData = data.toLowerCase();
                const foundIndicators = AI_INDICATORS.filter(indicator => lowerData.includes(indicator));
                
                let score = 0;
                if (foundIndicators.length === 0) {
                    score = 0; // 0/10 AI Maturity - Excellent Lead!
                    console.log(`[RESULT] EXCELLENT LEAD: No AI indicators found.`);
                } else if (foundIndicators.length <= 2) {
                    score = 4;
                    console.log(`[RESULT] MODERATE LEAD: Found minor automation: ${foundIndicators.join(', ')}`);
                } else {
                    score = 8;
                    console.log(`[RESULT] POOR LEAD: High automation detected: ${foundIndicators.join(', ')}`);
                }
                
                resolve({
                    url,
                    score,
                    indicators: foundIndicators,
                    htmlLength: data.length
                });
            });
        });

        req.on('error', (e) => {
            console.error(`Error fetching ${url}: ${e.message}`);
            // If website is down or doesn't exist, it's a prime lead
            resolve({ url, score: 0, indicators: [], error: e.message, status: 'No Website or Offline' });
        });
        
        req.end();
    });
}

async function runTests() {
    const testUrls = [
        'https://intercom.com', // Expected to have heavy AI/chat tools
        'https://example.com'   // Expected to have no AI tools
    ];
    
    for (const url of testUrls) {
        await analyzeWebsite(url);
        console.log('-----------------------------------');
    }
}

runTests();
