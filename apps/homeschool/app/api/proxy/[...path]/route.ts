import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

function getApiBase(): string {
  const base =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:5000/api';
  return base.replace(/\/$/, '');
}

type Params = { path: string[] };

async function handler(
  request: NextRequest,
  context: { params: Params | Promise<Params> },
) {
  try {
    const { path } = await Promise.resolve(context.params);
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    const apiBase = getApiBase();
    const url = new URL(request.url);
    const targetUrl = `${apiBase}/${path.join('/')}${url.search}`;

    const headers: Record<string, string> = {};
    const contentType = request.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    if (token) headers['authorization'] = `Bearer ${token}`;

    const body = !['GET', 'HEAD'].includes(request.method)
      ? Buffer.from(await request.arrayBuffer())
      : undefined;

    let apiRes: Response;
    try {
      apiRes = await fetch(targetUrl, { method: request.method, headers, body, cache: 'no-store' });
    } catch (err) {
      console.error('API fetch failed:', targetUrl, err);
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const text = await apiRes.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return new NextResponse(text, {
        status: apiRes.status,
        headers: { 'content-type': apiRes.headers.get('content-type') || 'text/plain' },
      });
    }

    // Login/signup responses carry a JWT — strip it and set as httpOnly cookie.
    if (data && typeof data === 'object' && 'token' in data) {
      const { token: jwt, ...rest } = data as Record<string, unknown>;
      const res = NextResponse.json(rest, { status: apiRes.status });
      if (typeof jwt === 'string') {
        res.cookies.set('token', jwt, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });
      }
      return res;
    }

    return NextResponse.json(data, { status: apiRes.status });
  } catch (err) {
    console.error('proxy handler error:', err);
    return NextResponse.json({ error: 'Internal proxy error' }, { status: 500 });
  }
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
