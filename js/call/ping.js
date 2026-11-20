// Ping (round-trip time) to each person in a call, read from the connection WebRTC is actually using. No extra traffic: it only reads
// what the browser already measures (the selected candidate pair's currentRoundTripTime).

/** Milliseconds, or null when the browser has no measurement yet. */
export async function measureRtt(pc) {
  if (!pc || pc.connectionState === "closed" || typeof pc.getStats !== "function") return null;
  let stats; try { stats = await pc.getStats(); } catch (_) { return null; }
  let pair = null, selId = null;
  stats.forEach(r => { if (r.type === "transport" && r.selectedCandidatePairId) selId = r.selectedCandidatePairId; });
  if (selId) pair = stats.get(selId);
  if (!pair) stats.forEach(r => { if (r.type === "candidate-pair" && (r.selected || (r.nominated && r.state === "succeeded"))) pair = r; });   // Firefox
  const s = pair && pair.currentRoundTripTime;
  return typeof s === "number" && s > 0 ? Math.round(s * 1000) : null;
}

/** Ping above these is shown yellow / red. */
export const PING_WARN = 150, PING_BAD = 300;
export const pingTone = ms => ms == null ? "" : ms >= PING_BAD ? "bad" : ms >= PING_WARN ? "warn" : "";

/** Account → "Show ping on videos" (this device). */
export const pingOn = () => { try { return localStorage.getItem("qm-show-ping") === "1"; } catch (_) { return false; } };
