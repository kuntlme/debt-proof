import NextAuth from "next-auth";
import authConfig from "./auth.config";
import prisma from "@repo/db";
import { PrismaAdapter } from "@repo/db";
import { getAccountByUserId, getUserById } from "@/feature/auth/actions";

export const { auth, handlers, signIn, signOut } = NextAuth({
    callbacks: {
        //

        async signIn({ user, account }) {
            if (!user || !account) return false;

            // Optional: block users without email
            if (!user.email) return false;

            return true;
        },

        async jwt({ token }) {
            if (!token.sub) return token;
            const existingUser = await getUserById(token.sub);

            if (!existingUser) return token;

            await getAccountByUserId(existingUser.id);

            token.name = existingUser.name;
            token.email = existingUser.email;
            token.onboardingComplete = (existingUser as any).onboardingComplete ?? false;
            token.username = (existingUser as any).username ?? null;
            token.walletAddress = (existingUser as any).walletAddress ?? null;
            return token;
        },

        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
                (session.user as any).onboardingComplete = token.onboardingComplete ?? false;
                (session.user as any).username = token.username ?? null;
                (session.user as any).walletAddress = token.walletAddress ?? null;
            }

            return session;
        },
    },
    pages: {
        signIn: "/login"
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
    adapter: PrismaAdapter(prisma as any),
    session: { strategy: "jwt" },
    ...authConfig,
})