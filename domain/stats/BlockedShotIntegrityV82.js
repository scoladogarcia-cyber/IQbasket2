/**
 * @fileoverview Validates blocked shots received without rewriting the acta.
 * @description FIBA: a shot blocked by the opponent is also an unsuccessful FGA.
 * Historical mismatches are preserved only if neither received blocks nor
 * failed field goals were changed by this operation. No automatic inference.
 */
function count(row, snake, camel) {
  const value=row?.[snake] ?? row?.[camel] ?? 0;
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0)throw new Error(
    "El contador "+snake+" debe ser un entero no negativo."
  );
  return number;
}

export function blockedShotsIntegrityV82(current = {}, previous = null) {
  const received=count(current,"blocks_received","blocksReceived");
  const fg2m=count(current,"fg2_made","fg2Made"),fg2a=count(current,"fg2_attempted","fg2Attempted");
  const fg3m=count(current,"fg3_made","fg3Made"),fg3a=count(current,"fg3_attempted","fg3Attempted");
  if(fg2m>fg2a || fg3m>fg3a){
    throw new Error("Los tiros de campo anotados no pueden superar los intentados.");
  }
  const missed=fg2a-fg2m+fg3a-fg3m;
  const valid=received<=missed;
  if(valid)return {valid:true,legacyUnresolved:false,received,missed};
  if(previous) {
    const oldReceived=count(previous,"blocks_received","blocksReceived");
    const oldMissed=
      count(previous,"fg2_attempted","fg2Attempted")-count(previous,"fg2_made","fg2Made")
      +count(previous,"fg3_attempted","fg3Attempted")-count(previous,"fg3_made","fg3Made");
    if(received===oldReceived && missed===oldMissed && oldReceived>oldMissed){
      return {valid:false,legacyUnresolved:true,received,missed};
    }
  }
  throw new Error(
    "Un tapón recibido requiere un tiro de campo fallado (T2 o T3). Registra el tiro fallado una sola vez; " +
    "no añadas un tapón sin el correspondiente intento."
  );
}
