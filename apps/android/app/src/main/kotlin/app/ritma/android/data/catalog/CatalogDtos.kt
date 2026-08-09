package app.ritma.android.data.catalog

import kotlinx.serialization.Serializable

// Hand-authored Kotlin mirrors of packages/api-contracts/src/catalog.ts.
// This repository has no TS-to-Kotlin codegen pipeline, so these must be
// kept in sync manually with the TypeScript contracts and the NestJS
// response shapes they describe.

@Serializable
enum class Genre { POP, TRADITIONAL, ROCK, RAP, ELECTRONIC, CLASSICAL, FUSION }

@Serializable enum class TrackType { FREE, PAID }

/** Shared paginated response envelope for every catalog list endpoint. */
@Serializable
data class PaginatedResponse<T>(val items: List<T>, val page: Int, val pageSize: Int, val total: Int)

/** `GET /artists`, `GET /artists/:id` response shape. Active artists only. */
@Serializable data class PublicArtist(val id: String, val name: String, val bio: String? = null)

/**
 * `GET /albums`, `GET /albums/:id` response shape. Published albums only.
 * `artistId` is a bare foreign key, not a nested [PublicArtist] — the
 * audited API never embeds related entities. Resolving the artist's name
 * requires a separate `getArtist(artistId)` call. `releasedAt` is an ISO
 * 8601 date-time string as sent over JSON.
 */
@Serializable
data class PublicAlbum(
    val id: String,
    val artistId: String,
    val title: String,
    val coverImageUrl: String,
    val releasedAt: String? = null,
)

/**
 * `GET /tracks`, `GET /tracks/:id` response shape. Published tracks only.
 * `artistId`/`albumId` are bare foreign keys, not nested objects — same as
 * [PublicAlbum]. Deliberately excludes `flacFileUrl`/`status` (the public
 * catalog is metadata only; see the playback module for how a track is
 * actually streamed). `price` is a decimal string, not a number, matching
 * how the API serializes it.
 */
@Serializable
data class PublicTrack(
    val id: String,
    val artistId: String,
    val albumId: String? = null,
    val title: String,
    val genre: Genre,
    val durationSeconds: Int,
    val type: TrackType,
    val price: String? = null,
    val coverImageUrl: String,
    val credits: String? = null,
    val story: String? = null,
)
