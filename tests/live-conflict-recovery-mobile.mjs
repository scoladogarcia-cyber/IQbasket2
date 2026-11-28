import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { installBrowserNetworkStubs } from "./browser-test-support.mjs";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await installBrowserNetworkStubs(page);
  await page.goto(process.env.LIVE_QA_BASE_URL || "http://127.0.0.1:4173/");
  const result = await page.evaluate(async () => {
    const { LiveScoreHUDViewV58 } = await import("/views/LiveScoreHUDViewV58.js");
    const makeHud = () => {
      const hud = new LiveScoreHUDViewV58(null, "game-test");
      hud.isExistingGame = true;
      hud.roster = [{ id: "p1", name: "Player", isConvoked: true }];
      hud._updateSyncStatusDom = () => {};
      return hud;
    };
    const recovered = {
      remoteRevision: 8, safeRebase: false,
      pending: [{ baseRevision: 7, payload: {
        teamScore: 2, opponentScore: 0, starterIds: ["p1"],
        events: [{ client_event_key: "local-1", points: 2, action_type: "fg2_made", player_id: "p1", period: 1 }]
      } }]
    };
    const hud = makeHud();
    const staged = [];
    let flushes = 0;
    hud._liveSync = () => ({
      stage: async (_id, payload, options) => staged.push({ ids: payload.events.map(event => event.id), options }),
      offlineStore: { pendingCount: async () => 2 },
      flush: async () => {
        flushes++;
        return flushes === 1 ? { conflict: true, pending: 2 } : { synced: true, revision: 9, pending: 0 };
      }
    });
    hud._applyPendingRecovery(recovered);
    const recoveredScore = hud.teamScore;
    const recoveredStarter = hud.roster[0].isStarter;
    hud.playByPlayEvents.push({ id: "local-2", period: "Q1", points: 2, action_type: "fg2_made" });
    hud._scheduleLiveSync();
    await hud.liveStagePromise;
    const automaticFlushes = flushes;
    const stillConflicted = (await hud._flushLiveSync()).conflict;
    const resolved = (await hud._flushLiveSync()).synced;

    const missingDraft = makeHud();
    missingDraft._liveSync = () => { throw new Error("An unreadable conflict must not stage or flush"); };
    missingDraft._applyPendingRecovery({ ...recovered, pending: [{ baseRevision: 7 }] });
    missingDraft._scheduleLiveSync();
    const blocked = await missingDraft._flushLiveSync();
    return { staged, recoveredScore, recoveredStarter, automaticFlushes, stillConflicted, resolved,
      recoveredRevision: hud.liveCaptureRevision, blocked: blocked.conflict };
  });
  assert.deepEqual(result, {
    staged: [{ ids: ["local-1", "local-2"], options: { baseRevision: 7 } }],
    recoveredScore: 2, recoveredStarter: true, automaticFlushes: 0,
    stillConflicted: true, resolved: true, recoveredRevision: 9, blocked: true
  });
  console.log("PASS mobile live conflict recovery and guarded retry");
} finally {
  await browser.close();
}
