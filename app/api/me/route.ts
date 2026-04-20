import { NextResponse } from "next/server";

import { authErrorResponse, requireAuthenticatedUser } from "@/lib/auth-server";

export async function GET(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);

    return NextResponse.json({
      user: {
        id: auth.userId,
        email: auth.email,
        role: auth.role,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
