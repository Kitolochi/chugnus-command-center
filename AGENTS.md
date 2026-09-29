# App updates

- Chris wants only the latest version of Chugnus Command Center running after an update. Build the current source, replace the canonical executable in `release/win-unpacked` and the portable executable in `release`, then launch that updated copy. Do not reopen an older executable or leave an older app instance running alongside it.
- Check for active tasks before restarting. Preserve their sessions and let them finish unless Chris authorizes interrupting them for the update.
- Verify the running executable path and the new build after replacement. Chromium helper processes belong to the same app instance.
- Run automated Electron UI checks with isolated user data and hidden windows so test copies do not interfere with Chris's app.
- Chris wants interrupted Codex work and its queued follow-ups to resume automatically after updates or restarts. Preserve recovery markers when updating; an explicit user Stop or a real error should still pause work. Closing the window to the tray must not stop tasks.
