import { type Invitation } from '@prisma/client';

export interface InvitationResponse {
  id: string;
  code: string;
  status: Invitation['status'];
  inviteePhoneNumber: string | null;
  createdAt: Date;
  redeemedAt: Date | null;
}

export function toInvitationResponse(invitation: Invitation): InvitationResponse {
  return {
    id: invitation.id,
    code: invitation.code,
    status: invitation.status,
    inviteePhoneNumber: invitation.inviteePhoneNumber,
    createdAt: invitation.createdAt,
    redeemedAt: invitation.redeemedAt,
  };
}
