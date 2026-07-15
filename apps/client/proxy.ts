import { auth } from "@/lib/auth";
import {
  apiAuthPrefix,
  authRoutes,
  DEFAULT_LOGIN_REDIRECT,
  landingPageRoute,
  publicRoutes,
} from "@/routes";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const session = req.auth;

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = authRoutes.includes(nextUrl.pathname);
  const isLandingRoute = nextUrl.pathname === landingPageRoute;
  const isOnboardingRoute = nextUrl.pathname === "/onboarding";
  const isDashboardRoute = nextUrl.pathname.startsWith("/dashboard");

  if (isLandingRoute) return null;

  // Allow API auth routes (NextAuth endpoints)
  if (isApiAuthRoute) {
    return null;
  }

  // Handle auth routes (login page)
  if (isAuthRoute) {
    if (isLoggedIn) {
      const onboardingComplete = (session?.user as any)?.onboardingComplete ?? false;
      if (!onboardingComplete) {
        return Response.redirect(new URL("/onboarding", nextUrl));
      }
      return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
    }
    return null;
  }

  // Handle public routes
  if (isPublicRoute) {
    return null;
  }

  // Protect all other routes - redirect to login if not authenticated
  if (!isLoggedIn) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  // Authenticated: enforce onboarding before dashboard
  if (isLoggedIn && isDashboardRoute) {
    const onboardingComplete = (session?.user as any)?.onboardingComplete ?? false;
    if (!onboardingComplete) {
      return Response.redirect(new URL("/onboarding", nextUrl));
    }
  }

  // Authenticated and onboarding done: don't let them re-visit onboarding
  if (isLoggedIn && isOnboardingRoute) {
    const onboardingComplete = (session?.user as any)?.onboardingComplete ?? false;
    if (onboardingComplete) {
      return Response.redirect(new URL("/dashboard", nextUrl));
    }
  }

  return null;
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};