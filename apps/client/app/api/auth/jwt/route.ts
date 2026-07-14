import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * GET /api/auth/jwt
 * Returns a JWT token for the current session user,
 * issued by the Express backend, for use with the API.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${process.env.API_URL || "http://localhost:8080"}/users/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to get token" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
