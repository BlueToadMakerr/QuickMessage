package app.quickmessage.chat

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** After the phone starts (only if someone is signed in): fetches what arrived while it was off and notifies for the unread, then restarts the notification listener. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (i.action == Intent.ACTION_BOOT_COMPLETED || i.action == "android.intent.action.QUICKBOOT_POWERON") NotifyService.boot(c)
        NotifyService.start(c)
    }
}
