/**
 * An Array of routes that are accessible to the public
 * These routes do not require authentication
 * @type {string[]}
 */

export const publicRoutes: string[] = ["/login"];

/**
 * An Array of routes that are protected
 * These routes require authentication
 * @type {string[]}
 */

export const protectedRoutes: string[] = ["/", "/dashboard"];

/**
 * An Array of routes that are accessible to the public
 * Routes that start with this (/api/auth) prefix do not require authentication
 * @type {string[]}
 */

export const authRoutes: string[] = [
  "/login", // Added leading slash
];

/**
 * An Array of routes that are accessible to the public
 * Routes that start with this (/api/auth) prefix do not require authentication
 * @type {string}
 */

export const apiAuthPrefix: string = "/api/auth";

export const DEFAULT_LOGIN_REDIRECT = "/"; // Changed to redirect to home page after login

export const landingPageRoute = "/";






// import { auth } from "@/lib/auth";
// import {
//   apiAuthPrefix,
//   authRoutes,
//   DEFAULT_LOGIN_REDIRECT,
//   landingPageRoute,
//   publicRoutes,
// } from "@/routes";

// export default auth((req) => {
//   const { nextUrl } = req;
//   console.log(nextUrl.pathname)
//   console.log("req", req.auth)
//   const isLoggedIn = !!req.auth;
//   // const isProfileComplete = req.auth?.user.profileComplete;

//   const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);

//   const isPublicRoute = publicRoutes.includes(nextUrl.pathname);

//   const isAuthRoute = authRoutes.includes(nextUrl.pathname);

//   const isLandingRoute = nextUrl.pathname == landingPageRoute;

//   // const isOnboardingRoute = nextUrl.pathname == "/onboarding";

//   if (isLandingRoute) return null;

//   if (isApiAuthRoute) {
//     return null;
//   }

//   if (isAuthRoute) {
//     if (isLoggedIn) {
//       return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
//     }
//     return null;
//   }

//   if (!isLoggedIn && !isPublicRoute) {
//     return Response.redirect(new URL("/login", nextUrl));
//   }

// //   if (isLoggedIn && !isProfileComplete && !isOnboardingRoute) {
// //     return Response.redirect(new URL("/onboarding", nextUrl));
// //   }

//   if (isLoggedIn /* && isProfileComplete &&  isOnboardingRoute */) {
//     return Response.redirect(new URL("/dashboard", nextUrl));
//   }

//   return null;
// });

// export const config = {
//   // copied from clerk
//   matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
// };




// middileware.ts
// import NextAuth from "next-auth";
// import authConfig from "./lib/auth.config";
// import {
//   DEFAULT_LOGIN_REDIRECT,
//   apiAuthPrefix,
//   authRoutes,
//   publicRoutes,
//   protectedRoutes,
// } from "./routes";

// const { auth } = NextAuth(authConfig);

// export default auth((req) => {
//   const { nextUrl } = req;
//   const isLoggedIn = !!req.auth;

//   const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
//   const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
//   const isAuthRoute = authRoutes.includes(nextUrl.pathname);
//   const isProtectedRoute = protectedRoutes.includes(nextUrl.pathname);

//   // Allow API auth routes
//   if (isApiAuthRoute) {
//     return;
//   }

//   // Handle auth routes (login, signup, etc)
//   if (isAuthRoute) {
//     if (isLoggedIn) {
//       return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
//     }
//     return;
//   }

//   // Handle protected routes
//   if (isProtectedRoute || nextUrl.pathname.startsWith("/dashboard")) {
//     if (!isLoggedIn) {
//       return Response.redirect(new URL("/login", nextUrl));
//     }
//     return;
//   }

//   // Handle public routes
//   if (isPublicRoute) {
//     return;
//   }
// });

// export const config = {
//   matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
// };