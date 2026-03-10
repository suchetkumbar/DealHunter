import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const AI_INDICATORS = [
    'intercom.io', 'drift.com', 'botpress', 'chatbase', 'crisp.chat',
    'zendesk', 'tidio', 'tawk.to', 'hubspot.com/conversations', 'livechat'
];

export async function POST(req: Request) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({
                score: 0,
                reason: 'Business has no website. This is extreme digital immaturity and a prime lead.',
                isPrimeLead: true,
                detectedTools: []
            });
        }

        // Launch headless browser to process JavaScript
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Set user agent to avoid basic bot blocks
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        // Network idle 2 ensures most async scripts (like chatbots) have loaded
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
            console.log(`Timeout or error loading ${url}, proceeding with what we have.`);
        });

        const html = await page.content();
        await browser.close();

        const lowerHtml = html.toLowerCase();
        const foundIndicators = AI_INDICATORS.filter(indicator => lowerHtml.includes(indicator));

        let score = 0;
        let reason = '';

        if (foundIndicators.length === 0) {
            // Here we could also pass the HTML text to OpenAI for deeper analysis
            // $ = cheerio.load(html);
            // const text = $('body').text();
            score = 2; // 2/10 AI Maturity
            reason = 'No modern chatbot or AI automation widgets detected in the source code.';
        } else {
            score = 8; // 8/10 AI Maturity
            reason = `Detected customer service / automation tools: ${foundIndicators.join(', ')}.`;
        }

        return NextResponse.json({
            score,
            reason,
            isPrimeLead: score <= 3,
            detectedTools: foundIndicators
        });

    } catch (error: any) {
        console.error("Scraping error:", error);
        return NextResponse.json({
            score: 0,
            reason: 'Website is broken or offline. High probability they need technical help.',
            isPrimeLead: true,
            detectedTools: []
        });
    }
}
