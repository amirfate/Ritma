package app.ritma.android.feature.home

import org.junit.Assert.assertEquals
import org.junit.Test

class HomeViewModelTest {

    @Test
    fun `initial ui state exposes the app identity`() {
        val viewModel = HomeViewModel()

        val state = viewModel.uiState.value

        assertEquals("Ritma", state.title)
        assertEquals("Feel the rhythm.", state.tagline)
    }
}
