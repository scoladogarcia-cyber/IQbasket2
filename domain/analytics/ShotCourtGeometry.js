/** Geometry shared by the heatmap court drawing and spatial zone counts. */
const width = 500;
const height = 470;
const rimX = 250;
const rimY = 52;
const radius = 235;
const left = 30;
const right = width - left;
const cornerEnd = rimY + Math.sqrt(radius ** 2 - (rimX - left) ** 2);

export const shotCourtThreePointPath = `M ${left} 0 V ${cornerEnd} A ${radius} ${radius} 0 0 0 ${right} ${cornerEnd} V 0`;

export function classifyShotCourtZone(shot) {
  const x = shot.coord_x * width / 100;
  const y = shot.coord_y * height / 100;
  if (y <= cornerEnd) {
    if (x < left) return "leftCorner";
    if (x > right) return "rightCorner";
  } else if (Math.hypot(x - rimX, y - rimY) > radius) {
    return "arc";
  }
  return x >= 170 && x <= 330 && y <= 190 ? "paint" : "mid";
}

export function shotCourtDistance(zone) {
  return zone === "paint" || zone === "mid" ? zone : "three";
}
