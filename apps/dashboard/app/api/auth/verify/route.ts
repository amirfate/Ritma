import { API_ROUTES, type VerifyRequest, type VerifyResponse } from '@ritma/api-contracts';
import { NextResponse, type NextRequest } from 'next/server';

import { setAuthCookies } from '../../../../lib/server/cookies';
import { getRitmaApiBaseUrl } from '../../../../lib/server/env';

interface VerifyRequestBody {
  phoneNumber: unknown;
  code: unknown;
  deviceFingerprint: unknown;
  deviceLabel?: unknown;
  invitationCode?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as VerifyRequestBody | null;

  if (
    typeof body?.phoneNumber !== 'string' ||
    typeof body.code !== 'string' ||
    typeof body.deviceFingerprint !== 'string'
  ) {
    return NextResponse.json(
      { message: 'phoneNumber, code, and deviceFingerprint are required.' },
      { status: 400 },
    );
  }

  const payload: VerifyRequest = {
    phoneNumber: body.phoneNumber,
    code: body.code,
    deviceFingerprint: body.deviceFingerprint,
    devicePlatform: 'web',
    ...(typeof body.deviceLabel === 'string' ? { deviceLabel: body.deviceLabel } : {}),
    ...(typeof body.invitationCode === 'string' ? { invitationCode: body.invitationCode } : {}),
  };

  const upstream = await fetch(`${getRitmaApiBaseUrl()}/${API_ROUTES.authVerify}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const upstreamBody: unknown = await upstream.json().catch(() => null);

  if (!upstream.ok || upstreamBody === null) {
    return NextResponse.json(upstreamBody ?? { message: 'Verification failed.' }, {
      status: upstream.ok ? 502 : upstream.status,
    });
  }

  const result = upstreamBody as VerifyResponse;
  await setAuthCookies({ accessToken: result.accessToken, refreshToken: result.refreshToken });

  // The token pair never leaves this response body — only `user` does.
  return NextResponse.json({ user: result.user });
}
