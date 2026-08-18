import { API_ROUTES, type SendCodeRequest } from '@ritma/api-contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { getRitmaApiBaseUrl } from '../../../../lib/server/env';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const phoneNumber =
    typeof body === 'object' && body !== null && 'phoneNumber' in body
      ? body.phoneNumber
      : undefined;

  if (typeof phoneNumber !== 'string') {
    return NextResponse.json({ message: 'phoneNumber is required.' }, { status: 400 });
  }

  const payload: SendCodeRequest = { phoneNumber };

  const upstream = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.authSendCode}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const upstreamBody: unknown = await upstream.json().catch(() => null);
  return NextResponse.json(upstreamBody, { status: upstream.status });
}
