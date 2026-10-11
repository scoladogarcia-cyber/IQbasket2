/**
 * @fileoverview Pure recovery checks for partially synchronized live captures.
 * @description A remote capture can only be treated as the prefix of a local
 * durable snapshot when every persisted server event exposes the same client
 * event key in the same order. This proves capture lineage without trusting
 * mutable labels, scores or player/action fields that may have been corrected
 * locally after an earlier snapshot reached the server.
 */

function key(value) {
  return String(value ?? "").trim();
}

/**
 * Returns true only when the server event log is a non-empty exact identity
 * prefix of the local full snapshot.
 *
 * Server V59 stores the browser event id in client_event_key; database event
 * ids are intentionally different and must never be compared to local ids.
 */
export function isRemoteCapturePrefix(remoteSnapshot = {}, localPayload = {}) {
  const remoteEvents = Array.isArray(remoteSnapshot?.events) ? remoteSnapshot.events : [];
  const localEvents = Array.isArray(localPayload?.events) ? localPayload.events : [];

  if (!remoteEvents.length || remoteEvents.length > localEvents.length) return false;

  return remoteEvents.every((remoteEvent, index) => {
    const remoteKey = key(remoteEvent?.client_event_key);
    const localEvent = localEvents[index] || {};
    const localKey = key(localEvent?.id || localEvent?.client_event_key);
    return Boolean(remoteKey && localKey && remoteKey === localKey);
  });
}

export default isRemoteCapturePrefix;
