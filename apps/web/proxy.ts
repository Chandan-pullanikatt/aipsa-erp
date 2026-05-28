import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/accept-invite', '/join', '/student-join', '/change-password'];

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/aipsa',
  SCHOOL_ADMIN: '/school',
  TEACHER: '/teacher',
  STUDENT: '/student',
  PARENT: '/parent',
};

const ROLE_PREFIX: Record<string, string> = {
  SUPER_ADMIN: '/aipsa',
  SCHOOL_ADMIN: '/school',
  TEACHER: '/teacher',
  STUDENT: '/student',
  PARENT: '/parent',
};

export function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('token')?.value;
    const userRaw = request.cookies.get('user')?.value;

    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(p + '/'),
    );

    if (!token) {
      if (!isPublic) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }

    let role: string | null = null;
    if (userRaw) {
      try {
        role = JSON.parse(userRaw).role ?? null;
      } catch {
        // corrupted cookie — ignore
      }
    }

    if (isPublic && role) {
      return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url));
    }

    if (role) {
      const isCrossRole = Object.entries(ROLE_PREFIX).some(
        ([r, prefix]) => r !== role && pathname.startsWith(prefix + '/'),
      );
      if (isCrossRole) {
        return NextResponse.redirect(new URL(ROLE_HOME[role] ?? '/login', request.url));
      }
    }

    return NextResponse.next();
  } catch (err) {
    console.error('middleware error:', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
};
