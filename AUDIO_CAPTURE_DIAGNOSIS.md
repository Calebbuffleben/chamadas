# Audio Capture Diagnosis and Fix

## Problem Summary

The Chrome extension was attempting to capture Google Meet's audio using `chrome.tabCapture` API, but was receiving **silent audio streams** (RMS levels of -Infinity to -45 dBFS, indicating no real speech).

## Root Cause

**Google Meet's WebRTC audio streams are isolated and not accessible via standard Tab Capture API.**

- Google Meet uses peer-to-peer WebRTC connections for audio
- These audio streams run in isolated contexts that `tabCapture` cannot access
- Tab Capture was returning an empty/silent audio stream
- This caused Hume API to consistently return "No speech detected"

## Evidence

From frontend logs:
```
[audio-capture] Live RMS: -Infinity dBFS  (total silence)
[audio-capture] Live RMS: -45.3 dBFS      (barely audible noise floor)
```

From backend logs:
```
[Hume][AUDIO] RMS: -Infinity dBFS (isFinite=true, speech=NO)
```

## Implemented Fix

**Changed `audio-capture.js` to capture user's microphone directly instead of tab audio.**

### What Changed
- Replaced `tabCapture` constraints with `getUserMedia` microphone capture
- Added proper audio processing flags: echo cancellation, noise suppression, auto gain control
- Added clear console warnings explaining the limitation

### What This Means
- ✅ **You can now analyze YOUR OWN voice** during the meeting
- ✅ The audio pipeline will receive real speech data from your microphone
- ✅ Hume AI will return emotional analysis for your speech
- ❌ **Other participants' voices are NOT captured** (only yours)

## Testing Steps

1. **Reload the extension** in Chrome (`chrome://extensions` → Reload)
2. **Refresh the Google Meet page**
3. **Start a meeting and speak into your microphone**
4. **Grant microphone permissions** when prompted
5. **Check console logs** for:
   - `✅ Microphone access granted`
   - `Live RMS: -20 to -10 dBFS` (indicates real speech)
   - Backend logs showing emotion analysis from Hume

## Long-Term Solutions

### Option 1: User Microphone Only (Current Implementation)
- **Pros**: Simple, works reliably, analyzes user's own emotional state
- **Cons**: Only captures local user, not other participants
- **Best for**: Personal emotional awareness, self-coaching

### Option 2: LiveKit Server-Side Egress (Recommended)
- **Pros**: Captures ALL participants, server-side processing, very reliable
- **Cons**: Requires LiveKit integration (you already have this!)
- **Best for**: Full meeting analysis, coaching hosts based on all participants
- **Implementation**: Use LiveKit's RoomComposite egress to record meeting audio server-side

### Option 3: WebRTC Stream Injection (Not Recommended)
- **Pros**: Could theoretically capture all participant audio in the browser
- **Cons**: 
  - Extremely fragile (breaks with Google Meet updates)
  - Requires reverse-engineering Meet's internal APIs
  - High maintenance burden
  - May violate Meet's terms of service
- **Best for**: Nothing - don't use this approach

## Recommendation

**Use LiveKit server-side egress for production.**

Your backend already has LiveKit integration (`livekit-egress.service.ts`). You can:

1. Record the entire meeting audio server-side using LiveKit
2. Process it through Hume AI on the backend (already implemented in `hume-stream.service.ts`)
3. Send real-time feedback to all participants via WebSocket (already implemented in `feedback-overlay.js`)

This approach:
- ✅ Captures ALL participants
- ✅ More reliable than browser-based capture
- ✅ Works with your existing architecture
- ✅ No browser extension required (optional: use extension only for feedback display)

## Next Steps

1. **Test the current microphone capture fix** to validate the entire pipeline works
2. **If successful**, consider migrating to LiveKit server-side recording for production
3. **Update the extension** to only display feedback, not capture audio

---

**Status**: ✅ Fix applied. Ready for testing.

**Files Modified**:
- `apps/chrome-extension/audio-capture.js` - Changed from tabCapture to getUserMedia

**Expected Outcome**:
- Hume API should now receive real speech data
- Emotional analysis should return valid results
- Feedback should appear in the Google Meet UI

