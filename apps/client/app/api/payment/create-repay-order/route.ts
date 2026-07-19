import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/utils";

const API_URL = getApiUrl();

/**
 * POST /api/payment/create-repay-order
 * Proxies the request to the Express server to create a Razorpay repayment order.
 * Attaches the borrower's JWT for server auth.
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

    const res = await fetch(`${API_URL}/payments/create-repay-order`, {
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
    console.error("[api/payment/create-repay-order]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
