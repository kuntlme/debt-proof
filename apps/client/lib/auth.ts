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

            const existingAccount = await getAccountByUserId(existingUser.id);

            token.name = existingUser.name;
            token.email = existingUser.email;
            // token.profileComplete = existingUser.profileComplete;
            // if (existingUser.username) {
            //     token.username = existingUser.username;
            // }
            return token;
        },

        async session({ session, token }) {
            // Attach the user ID from the token to the session
            if (token.sub && session.user) {
                session.user.id = token.sub;
                // session.user.profileComplete = token.profileComplete as boolean;
            }

            return session;
        },
    },
    pages: {
        signIn: "/login"
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    ...authConfig,
})