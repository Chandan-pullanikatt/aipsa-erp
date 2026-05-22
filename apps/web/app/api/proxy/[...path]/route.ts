import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000/api';

type Params = { path: string[] };

async function handler(
  request: NextRequest,
  context: { params: Params | Promise<Params> },
) {
  const { path } = await Promise.resolve(context.params);
  const cookieStore = await Promise.resolve(cookies());
  const token = cookieStore.get('token')?.value;

  const url = new URL(request.url);
  const targetUrl = `${API_BASE}/${path.join('/')}${url.search}`;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  if (token) headers['authorization'] = `Bearer ${token}`;

  const body = !['GET', 'HEAD'].includes(request.method)
    ? await request.text()
    : undefined;

  let apiRes: Response;
  try {
    apiRes = await fetch(targetUrl, { method: request.method, headers, body });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const text = await apiRes.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return new NextResponse(text, {
      status: apiRes.status,
      headers: { 'content-type': 'text/plain' },
    });
  }

  // When Express returns a JWT in the response body, strip it out and store it
  // as an httpOnly cookie so JavaScript on the page can never read the token.
  if (data && typeof data === 'object' && 'token' in data) {
    const { token: jwt, ...rest } = data as Record<string, unknown>;
    const res = NextResponse.json(rest, { status: apiRes.status });
    if (typeof jwt === 'string') {
      res.cookies.set('token', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
    }
    return res;
  }

  return NextResponse.json(data, { status: apiRes.status });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
