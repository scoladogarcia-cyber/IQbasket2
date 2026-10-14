import assert from 'node:assert/strict';
import { resolveParticipantMinutes, normalizeParticipantOverride, accruedTrainingMinutes,
  cloneTrainingParticipants } from '../domain/player360/TrainingParticipantMinutes.js';

assert.equal(resolveParticipantMinutes(90, null), 90);
assert.equal(resolveParticipantMinutes(90, 60), 60);
assert.equal(resolveParticipantMinutes(90, 0), 0);
assert.equal(normalizeParticipantOverride(90, 90), null);
assert.equal(normalizeParticipantOverride(90, 60), 60);
assert.equal(accruedTrainingMinutes({sessionMinutes:90,attendanceStatus:'PLANNED',sessionValidated:true}),0);
assert.equal(accruedTrainingMinutes({sessionMinutes:90,attendanceStatus:'PRESENT',sessionValidated:false}),0);
assert.equal(accruedTrainingMinutes({sessionMinutes:90,overrideMinutes:50,attendanceStatus:'PARTIAL',sessionValidated:true}),50);
assert.throws(()=>resolveParticipantMinutes(90, 100),/TRAINING_PARTICIPANT_EXCEEDS_SESSION/);
assert.throws(()=>resolveParticipantMinutes(90, -5),/TRAINING_MINUTES_INVALID/);
assert.deepEqual(cloneTrainingParticipants([{player_id:'a',participated_minutes:60}]),[{
  player_id:'a',duration_override_minutes:60,attendance_status:'PLANNED',participated_minutes:null,rpe:null,notes:null
}]);
console.log('Training participant minute rules: PASS');
