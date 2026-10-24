/*
 * Geometry for the landing-page "journey network" illustration (viewBox 640 × 520).
 *
 * Purely illustrative: the points and lines are a fixed abstract composition, not patients,
 * rooms, or live hospital data. Elements marked `extra` are hidden on small screens so the
 * phone version stays light without changing the story.
 *
 * Each patient point has a small "wander" offset (wx, wy) used while the network looks busy,
 * and queue indicators have a "scatter" offset (sx, sy, sr) before they line up.
 */

export const VIEWBOX = { width: 640, height: 520 };

// Departments and places. `stage` links a labelled destination to a step of the journey.
export const PLACES = [
  { id: 'entrance', x: 64, y: 452, kind: 'start' },
  { id: 'registration', x: 132, y: 326, kind: 'destination', stage: 'find', labelKey: 'home.journey.places.registration', labelSide: 'left' },
  { id: 'opd', x: 392, y: 182, kind: 'destination', stage: 'queue', labelKey: 'home.journey.places.opd', labelSide: 'top' },
  { id: 'assistance', x: 504, y: 362, kind: 'destination', stage: 'help', labelKey: 'home.journey.places.assistance', labelSide: 'right' },
  { id: 'deptA', x: 252, y: 104, kind: 'department' },
  { id: 'deptB', x: 548, y: 96, kind: 'department' },
  { id: 'deptC', x: 248, y: 438, kind: 'department', extra: true },
  { id: 'deptD', x: 600, y: 236, kind: 'department', extra: true },
];

export const PATIENTS = [
  { id: 'p1', x: 44, y: 96, wx: 10, wy: 6 },
  { id: 'p2', x: 102, y: 178, wx: -8, wy: 10 },
  { id: 'p3', x: 168, y: 58, wx: 12, wy: -4 },
  { id: 'p4', x: 206, y: 196, wx: -10, wy: -8, extra: true },
  { id: 'p5', x: 316, y: 54, wx: 8, wy: 9 },
  { id: 'p6', x: 330, y: 318, wx: -12, wy: 6 },
  { id: 'p7', x: 364, y: 416, wx: 10, wy: -10 },
  { id: 'p8', x: 428, y: 470, wx: -6, wy: -9, extra: true },
  { id: 'p9', x: 560, y: 196, wx: -10, wy: 8 },
  { id: 'p10', x: 604, y: 318, wx: -8, wy: -10, extra: true },
  { id: 'p11', x: 588, y: 452, wx: -12, wy: -6 },
  { id: 'p12', x: 462, y: 112, wx: 9, wy: 10 },
  { id: 'p13', x: 196, y: 372, wx: 11, wy: -9 },
  { id: 'p14', x: 84, y: 248, wx: 12, wy: 8, extra: true },
  { id: 'p15', x: 300, y: 488, wx: -9, wy: -12, extra: true },
  { id: 'p16', x: 512, y: 480, wx: 10, wy: -8 },
  { id: 'p17', x: 452, y: 300, wx: -14, wy: 4, extra: true },
  { id: 'p18', x: 300, y: 236, wx: 14, wy: 10 },
  { id: 'p19', x: 156, y: 470, wx: 8, wy: -12, extra: true },
  { id: 'p20', x: 618, y: 150, wx: -12, wy: 8, extra: true },
];

const POINTS = Object.fromEntries([...PLACES, ...PATIENTS].map((point) => [point.id, point]));
export const pointOf = (id) => POINTS[id];

// Thin lines between places and points. `breaks` lines come apart while the network looks
// busy, then settle back quietly.
export const LINKS = [
  { from: 'registration', to: 'deptA' },
  { from: 'deptA', to: 'opd', breaks: true },
  { from: 'opd', to: 'deptB' },
  { from: 'deptB', to: 'assistance', breaks: true },
  { from: 'registration', to: 'deptC', extra: true },
  { from: 'deptC', to: 'assistance', breaks: true, extra: true },
  { from: 'deptA', to: 'deptB', breaks: true },
  { from: 'deptD', to: 'assistance', extra: true },
  { from: 'deptB', to: 'deptD', extra: true },
  { from: 'p2', to: 'registration' },
  { from: 'p3', to: 'deptA' },
  { from: 'p5', to: 'deptA', breaks: true },
  { from: 'p6', to: 'opd' },
  { from: 'p9', to: 'deptB' },
  { from: 'p12', to: 'opd', breaks: true },
  { from: 'p13', to: 'registration', breaks: true },
  { from: 'p7', to: 'assistance' },
  { from: 'p11', to: 'assistance', breaks: true },
  { from: 'p18', to: 'opd', extra: true },
  { from: 'p14', to: 'registration', extra: true },
  { from: 'p15', to: 'deptC', extra: true },
  { from: 'p20', to: 'deptB', extra: true },
];

// The clear route: entrance → registration → OPD (find your way), then OPD → assistance.
export const ROUTE = {
  find: 'M64 452 C 84 404, 104 366, 132 326 C 172 282, 214 280, 252 268 C 312 252, 344 214, 392 182',
  help: 'M392 182 C 440 210, 462 240, 470 272 C 480 304, 490 334, 504 362',
};
export const FULL_ROUTE = `${ROUTE.find} ${ROUTE.help.replace(/^M[\d. ]+/, '')}`;

// Queue indicators gathering at the OPD and lining up once the route is clear.
export const QUEUE = [
  { x: 360, y: 222, sx: -26, sy: 18, sr: -24 },
  { x: 376, y: 222, sx: 14, sy: 30, sr: 18 },
  { x: 392, y: 222, sx: -6, sy: -38, sr: 40 },
  { x: 408, y: 222, sx: 30, sy: 12, sr: -12 },
  { x: 424, y: 222, sx: 18, sy: 40, sr: 28, extra: true },
  { x: 440, y: 222, sx: -34, sy: 44, sr: -36, extra: true },
];

// Journey steps shown beside the illustration; each highlights part of it.
export const STAGES = [
  { id: 'find', labelKey: 'home.journey.stages.find', descriptionKey: 'home.journey.stages.findDescription' },
  { id: 'queue', labelKey: 'home.journey.stages.queue', descriptionKey: 'home.journey.stages.queueDescription' },
  { id: 'help', labelKey: 'home.journey.stages.help', descriptionKey: 'home.journey.stages.helpDescription' },
];
