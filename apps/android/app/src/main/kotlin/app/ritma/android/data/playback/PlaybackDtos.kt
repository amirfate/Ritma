package app.ritma.android.data.playback

import kotlinx.serialization.Serializable

// Hand-authored Kotlin mirrors of packages/api-contracts/src/playback.ts.
// This repository has no TS-to-Kotlin codegen pipeline, so these must be
// kept in sync manually with the TypeScript contracts and the NestJS
// response shapes they describe.

/**
 * How much of the track this session is authorized to stream. Determined
 * entirely by the server at session-creation time — the client has no
 * right to compute or override this. `PREVIEW` sessions are capped to the
 * first 30 seconds server-side (see the M5 audit); the client must not
 * additionally enforce that boundary itself.
 */
@Serializable enum class PlaybackAccessType { PREVIEW, FULL_FREE, FULL_PURCHASED }

@Serializable data class CreateSessionRequest(val trackId: String)

/** `201` response shape for `POST /playback/sessions`. */
@Serializable data class PlaybackSessionResponse(val id: String, val accessType: PlaybackAccessType)

/** Shared error body for `403` / `404` / `409` responses on session creation. */
@Serializable data class PlaybackErrorBody(val message: String)
