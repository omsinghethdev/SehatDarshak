/*
 * SVG layers drawn on a floor map in the floor's own map units: walkways (corridors and graph
 * connections) under the rooms, and the route with its markers above them. Purely visual
 * (aria-hidden): the route is also given as a text list of steps beside the map.
 */

export const ROUTE_COLOURS = Object.freeze({
  route: '#1d4ed8',
  current: '#172554',
  start: '#15803d',
  end: '#b91c1c',
  walkway: '#cbd5e1',
  link: '#94a3b8',
  simulated: '#2563eb',
});

const toPoints = (points) => points.map((p) => `${p.x},${p.y}`).join(' ');

/** Corridor areas and the walkable connections between doors and junctions. */
export function WalkwaysLayer({ walkways }) {
  if (!walkways) return null;
  const nodes = new Map(walkways.nodes.map((node) => [node.id, node]));
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {walkways.corridors.map((corridor) => (
        <rect key={corridor.id} x={corridor.x} y={corridor.y} width={corridor.width} height={corridor.height} fill={ROUTE_COLOURS.walkway} />
      ))}
      {walkways.edges.map((edge) => {
        const a = nodes.get(edge.from);
        const b = nodes.get(edge.to);
        if (!a || !b) return null;
        return (
          <line
            key={`${edge.from}-${edge.to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={ROUTE_COLOURS.link}
            strokeWidth="2.5"
            strokeDasharray={edge.kind === 'door' ? '3 5' : '8 8'}
            strokeLinecap="round"
          />
        );
      })}
      {walkways.nodes
        .filter((node) => node.kind === 'junction')
        .map((node) => (
          <circle key={node.id} cx={node.x} cy={node.y} r="4" fill={ROUTE_COLOURS.link} />
        ))}
    </g>
  );
}

function StartMarker({ point }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r="17" fill={ROUTE_COLOURS.start} stroke="white" strokeWidth="5" />
      <circle cx={point.x} cy={point.y} r="5" fill="white" />
    </g>
  );
}

function DestinationPin({ point }) {
  // Teardrop pin whose tip touches the destination door.
  const { x, y } = point;
  return (
    <g>
      <path
        d={`M ${x} ${y} C ${x - 6} ${y - 14}, ${x - 20} ${y - 22}, ${x - 20} ${y - 38} A 20 20 0 1 1 ${x + 20} ${y - 38} C ${x + 20} ${y - 22}, ${x + 6} ${y - 14}, ${x} ${y} Z`}
        fill={ROUTE_COLOURS.end}
        stroke="white"
        strokeWidth="4"
      />
      <circle cx={x} cy={y - 38} r="7" fill="white" />
    </g>
  );
}

function TransitionMarker({ transition, label, floorWidth }) {
  const { x, y } = transition.point;
  const arrow = transition.direction === 'down' ? '▼' : '▲';
  const width = Math.max(120, label.length * 10 + 46);
  // The label sits above the lift/stairs door, inside the floor.
  const left = Math.max(24, Math.min(x - width / 2, floorWidth - 24 - width));
  return (
    <g>
      <rect x={x - 15} y={y - 15} width="30" height="30" rx="6" fill={ROUTE_COLOURS.route} stroke="white" strokeWidth="4" />
      <text x={x} y={y + 6} textAnchor="middle" fontSize="16" fontWeight="700" fill="white">
        {arrow}
      </text>
      <rect x={left} y={y - 66} width={width} height="34" rx="8" fill="white" stroke={ROUTE_COLOURS.route} strokeWidth="2.5" />
      <text x={left + width / 2} y={y - 43} textAnchor="middle" fontSize="17" fontWeight="700" fill={ROUTE_COLOURS.current}>
        {label}
      </text>
    </g>
  );
}

/**
 * The simulated position: a blue dot with a soft halo, drawn above everything else. While in a
 * lift or on the stairs it shows an up/down arrow instead of the centre dot.
 */
function SimulatedMarker({ marker }) {
  const { x, y } = marker.point;
  const arrow = marker.transition ? (marker.transition.direction === 'down' ? '▼' : '▲') : null;
  return (
    <g>
      <circle cx={x} cy={y} r="30" fill={ROUTE_COLOURS.simulated} fillOpacity="0.22" />
      <circle cx={x} cy={y} r="15" fill={ROUTE_COLOURS.simulated} stroke="white" strokeWidth="5" />
      {arrow ? (
        <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">
          {arrow}
        </text>
      ) : (
        <circle cx={x} cy={y} r="4.5" fill="white" />
      )}
    </g>
  );
}

/**
 * The route on this floor (`view` from routeOnFloor). While navigating, `activePoints` (the
 * current step on this floor) is drawn darker on top and the rest of the route is lighter.
 * `marker` ({ point, transition }) is the simulated position when it is on this floor.
 */
export function RouteLayer({ view, activePoints, transitionLabel, floorWidth, marker = null }) {
  if (!view) return null;
  const navigating = Boolean(activePoints);
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {view.lines.map((points, index) => (
        <g key={index}>
          <polyline points={toPoints(points)} fill="none" stroke="white" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
          <polyline
            points={toPoints(points)}
            fill="none"
            stroke={ROUTE_COLOURS.route}
            strokeOpacity={navigating ? 0.45 : 1}
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      {activePoints?.length > 1 && (
        <polyline points={toPoints(activePoints)} fill="none" stroke={ROUTE_COLOURS.current} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {view.transitions.map((transition, index) => (
        <TransitionMarker key={index} transition={transition} label={transitionLabel(transition)} floorWidth={floorWidth} />
      ))}
      {view.start && <StartMarker point={view.start} />}
      {view.end && <DestinationPin point={view.end} />}
      {marker && <SimulatedMarker marker={marker} />}
    </g>
  );
}

/** Legend for the route symbols, so they are not explained by colour alone. */
export function RouteLegend({ t, showRoute, showMarker = false }) {
  const item = 'flex items-center gap-2';
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
      <li className={item}>
        <svg aria-hidden="true" viewBox="0 0 40 12" className="h-3 w-10">
          <line x1="2" y1="6" x2="38" y2="6" stroke={ROUTE_COLOURS.link} strokeWidth="3" strokeDasharray="6 5" />
        </svg>
        {t('directions.map.legendWalkway')}
      </li>
      {showRoute && (
        <>
          <li className={item}>
            <svg aria-hidden="true" viewBox="0 0 40 12" className="h-3 w-10">
              <line x1="2" y1="6" x2="38" y2="6" stroke={ROUTE_COLOURS.route} strokeWidth="6" strokeLinecap="round" />
            </svg>
            {t('directions.map.legendRoute')}
          </li>
          <li className={item}>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5">
              <circle cx="10" cy="10" r="8" fill={ROUTE_COLOURS.start} />
              <circle cx="10" cy="10" r="3" fill="white" />
            </svg>
            {t('directions.map.legendStart')}
          </li>
          <li className={item}>
            <svg aria-hidden="true" viewBox="0 0 20 24" className="h-6 w-5">
              <path d="M10 23 C7 17 2 14 2 9 A8 8 0 1 1 18 9 C18 14 13 17 10 23 Z" fill={ROUTE_COLOURS.end} />
              <circle cx="10" cy="9" r="3" fill="white" />
            </svg>
            {t('directions.map.legendEnd')}
          </li>
          {showMarker && (
            <li className={item}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
                <circle cx="12" cy="12" r="11" fill={ROUTE_COLOURS.simulated} fillOpacity="0.22" />
                <circle cx="12" cy="12" r="6" fill={ROUTE_COLOURS.simulated} stroke="white" strokeWidth="2" />
              </svg>
              {t('directions.simulation.legendMarker')}
            </li>
          )}
        </>
      )}
    </ul>
  );
}
