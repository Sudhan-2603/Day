package com.Day.android

import org.junit.Assert.assertEquals
import org.junit.Test

class AttributionTest {
    @Test fun nameAndRepoMatchPermission() {
        assertEquals("Day for Android", Attribution.APP_NAME)
        assertEquals("https://github.com/Sudhan-2603/Day", Attribution.REPO_URL)
    }
}
