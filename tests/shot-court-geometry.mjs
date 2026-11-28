import assert from "node:assert/strict";
import { classifyShotCourtZone, shotCourtDistance } from "../domain/analytics/ShotCourtGeometry.js";

const shot = (x, y) => ({ coord_x: x / 5, coord_y: y / 4.7 });
for (const [x, y, zone] of [
  [250, 110, "paint"],
  [250, 230, "mid"],
  [35, 110, "mid"],
  [15, 110, "leftCorner"],
  [485, 110, "rightCorner"],
  [250, 310, "arc"],
  [45, 185, "arc"],
  [455, 185, "arc"]
]) assert.equal(classifyShotCourtZone(shot(x, y)), zone, `${x},${y}`);

for (const zone of ["arc", "leftCorner", "rightCorner"]) assert.equal(shotCourtDistance(zone), "three");
console.log("PASS shared shot court geometry");
