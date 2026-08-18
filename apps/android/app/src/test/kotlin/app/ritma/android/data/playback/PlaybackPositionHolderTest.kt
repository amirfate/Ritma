package app.ritma.android.data.playback

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class PlaybackPositionHolderTest {

    @Test
    fun `starts at zero before any publish`() {
        val holder = PlaybackPositionHolder()

        assertEquals(0L, holder.positionMs.value)
    }

    @Test
    fun `publish updates the latest position`() {
        val holder = PlaybackPositionHolder()

        holder.publish(5_000L)

        assertEquals(5_000L, holder.positionMs.value)
    }

    @Test
    fun `a new subscriber immediately receives the latest published position`() = runTest {
        val holder = PlaybackPositionHolder()
        holder.publish(12_345L)

        val received = holder.positionMs.first()

        assertEquals(12_345L, received)
    }

    @Test
    fun `multiple updates are all reflected, latest wins`() {
        val holder = PlaybackPositionHolder()

        holder.publish(1_000L)
        holder.publish(2_000L)
        holder.publish(3_000L)

        assertEquals(3_000L, holder.positionMs.value)
    }
}
