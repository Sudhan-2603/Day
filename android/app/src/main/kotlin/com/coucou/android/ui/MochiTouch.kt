package com.Day.android.ui

import android.os.Handler
import android.os.Looper
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import com.Day.android.Day.BotEmote
import com.Day.android.Day.BotState
import com.Day.android.Day.DayEngine
import com.Day.android.Day.SoundSink

/**
 * What a finger does to Day, as on the computer: a tap is a slap (three quick ones make him dizzy
 * for a few seconds), a long press is a pet (hearts). The sounds go through [sound], so the sound
 * switch in Settings silences them too.
 */
class DayTouch(
    private val engine: DayEngine,
    private val sound: SoundSink,
    private val stateNow: () -> BotState,
) {
    private val main = Handler(Looper.getMainLooper())

    /** While true the screen must not reset Day's state: he is dizzy on purpose. */
    var dizzy = false
        private set

    init {
        engine.onDizzy = {
            dizzy = true
            engine.setState(BotState.DIZZY, force = true)
            sound.play("dizzy")
            main.postDelayed({
                dizzy = false
                engine.setState(stateNow(), force = true)
            }, DIZZY_MS)
        }
    }

    val modifier: Modifier = Modifier.pointerInput(engine) {
        detectTapGestures(
            onTap = { if (!dizzy) engine.slap() },
            onLongPress = {
                if (!dizzy) {
                    engine.triggerEmote(BotEmote.LOVE)
                    sound.play("love")
                }
            },
        )
    }

    private companion object { const val DIZZY_MS = 3_300L }
}
