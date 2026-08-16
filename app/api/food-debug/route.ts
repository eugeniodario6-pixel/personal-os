import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.FATSECRET_CLIENT_ID || '91f84c88db6949f6b9f59c7a426721e6';
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET || 'bf8f48b599aa4a68974c280c58fb121b';
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&scope=basic',
    });
    const tokenStatus = tokenRes.status;
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    const searchRes = await fetch(
      `https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=beef&format=json&max_results=3`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchStatus = searchRes.status;
    const searchData = await searchRes.json();

    return NextResponse.json({ tokenStatus, hasToken: !!token, searchStatus, searchData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
