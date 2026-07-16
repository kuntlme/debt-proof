import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "http://localhost:8080";

/**
 * POST /api/payment/verify
 * After Razorpay checkout success, proxies signature verification
 * and loan activation to the Express server.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get JWT from internal endpoint
    const jwtRes = await fetch(`${API_URL}/users/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.id }),
    });
    if (!jwtRes.ok) {
      return NextResponse.json({ error: "Failed to get auth token" }, { status: 500 });
    }
    const { token } = await jwtRes.json();

    const body = await req.json();

    const res = await fetch(`${API_URL}/payments/verify-and-activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[api/payment/verify]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
