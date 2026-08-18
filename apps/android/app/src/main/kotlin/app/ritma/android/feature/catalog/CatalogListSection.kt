package app.ritma.android.feature.catalog

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier

/**
 * Renders a [CatalogListUiState] as loading / error / empty / a scrollable
 * list — the one place every catalog screen (Home's tabs, an artist's
 * albums, an album's tracks) implements this so each doesn't repeat the
 * same `when`.
 */
@Composable
fun <T> CatalogListSection(
    state: CatalogListUiState<T>,
    itemKey: (T) -> Any,
    modifier: Modifier = Modifier,
    itemContent: @Composable (T) -> Unit,
) {
    when (state) {
        is CatalogListUiState.Loading -> {
            Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
        is CatalogListUiState.Error -> {
            Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = "Couldn't load this: ${state.message}", style = MaterialTheme.typography.bodyMedium)
            }
        }
        is CatalogListUiState.Loaded -> {
            if (state.items.isEmpty()) {
                Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(text = "Nothing here yet.", style = MaterialTheme.typography.bodyMedium)
                }
            } else {
                LazyColumn(modifier = modifier.fillMaxSize()) {
                    items(items = state.items, key = itemKey) { item -> itemContent(item) }
                }
            }
        }
    }
}
