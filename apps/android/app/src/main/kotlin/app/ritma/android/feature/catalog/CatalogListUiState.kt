package app.ritma.android.feature.catalog

import app.ritma.android.data.catalog.CatalogResult
import app.ritma.android.data.catalog.PaginatedResponse

/**
 * Screen-level state for a single catalog list section, shared by every
 * catalog screen (Home's tabs, an Artist's albums, an Album's tracks).
 * Unlike [CatalogResult], this has an explicit `Loading` variant — that is
 * a UI concern the repository layer deliberately does not model. An empty
 * successful result is [Loaded] with an empty list, not a separate case;
 * screens decide how to render that.
 */
sealed interface CatalogListUiState<out T> {
    data object Loading : CatalogListUiState<Nothing>

    data class Loaded<T>(val items: List<T>) : CatalogListUiState<T>

    data class Error(val message: String) : CatalogListUiState<Nothing>
}

fun <T> CatalogResult<PaginatedResponse<T>>.toListUiState(): CatalogListUiState<T> =
    when (this) {
        is CatalogResult.Success -> CatalogListUiState.Loaded(data.items)
        is CatalogResult.Failed -> CatalogListUiState.Error(message)
    }
