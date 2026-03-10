import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location') || 'Unknown Location';
    const niche = searchParams.get('niche') || 'Business';

    // Mocking Google Places API response because no API key is provided
    const mockBusinesses = [
        {
            id: '1',
            name: `Premium ${niche} of ${location}`,
            rating: 4.8,
            website: 'https://intercom.com', // Tech-heavy site for testing
            phone: '(555) 123-4567',
            address: `123 Main St, ${location}`,
        },
        {
            id: '2',
            name: `Legacy ${niche} Services`,
            rating: 4.2,
            website: 'http://info.cern.ch/', // First website ever (very legacy)
            phone: '(555) 987-6543',
            address: `456 Oak St, ${location}`,
        },
        {
            id: '3',
            name: `Downtown ${niche} Clinic`,
            rating: 3.5,
            website: null, // No website - perfect lead
            phone: '(555) 555-5555',
            address: `789 Pine St, ${location}`,
        }
    ];

    // Simulating network delay to show off UI loading states
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({ results: mockBusinesses });
}
