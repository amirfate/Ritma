package app.ritma.android.testing

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description

/**
 * Swaps `Dispatchers.Main` for an [UnconfinedTestDispatcher] so a
 * `ViewModel`'s `viewModelScope.launch { ... }` runs eagerly against fakes
 * that never actually suspend, without needing Robolectric. [dispatcher] is
 * exposed so a test can also pass it to `runTest(dispatcher)` when it needs
 * to collect a `SharedFlow` the `ViewModel` emits to (e.g. a one-shot
 * navigation event) on the same virtual-time scheduler.
 */
class MainDispatcherRule(val dispatcher: TestDispatcher = UnconfinedTestDispatcher()) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
