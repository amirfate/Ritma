package app.ritma.android

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AppContextTest {

    @Test
    fun packageName_matchesApplicationId() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        // Debug builds append the ".debug" applicationIdSuffix.
        assertTrue(appContext.packageName.startsWith("app.ritma.android"))
    }
}
