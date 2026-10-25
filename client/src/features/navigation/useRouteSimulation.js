import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SIMULATION_CONFIG, buildSimulationTrack, createSimulationController } from './routeSimulation';

/**
 * Simulated navigation for `route` (see routeSimulation.js). A new route — a new destination,
 * start, or stairs option — disposes the previous controller, so an old simulation never keeps
 * running or reports into the new one. Nothing starts until `start()` is called, so React Strict
 * Mode's extra mount creates no animation loop.
 *
 * Returns `{ snapshot, track, controls }`; `snapshot` is null without a route.
 */
export function useRouteSimulation(route) {
  const track = useMemo(() => (route ? buildSimulationTrack(route) : null), [route]);
  const [rate, setRate] = useState(SIMULATION_CONFIG.defaultPlaybackRate);
  const rateRef = useRef(rate);
  const controllerRef = useRef(null);
  // Tagged with its track, so a snapshot from a previous route is never shown for a new one.
  const [state, setState] = useState({ track: null, snapshot: null });

  useEffect(() => {
    if (!track) return undefined;
    const controller = createSimulationController({
      track,
      rate: rateRef.current,
      onUpdate: (snapshot) => setState({ track, snapshot }),
    });
    controllerRef.current = controller;
    setState({ track, snapshot: controller.getSnapshot() });
    return () => {
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [track]);

  const changeRate = useCallback((next) => {
    rateRef.current = next;
    setRate(next);
    controllerRef.current?.setRate(next);
  }, []);

  const controls = useMemo(
    () => ({
      start: () => controllerRef.current?.start(),
      pause: () => controllerRef.current?.pause(),
      resume: () => controllerRef.current?.resume(),
      restart: () => controllerRef.current?.restart(),
      stop: () => controllerRef.current?.stop(),
      setRate: changeRate,
    }),
    [changeRate],
  );

  const snapshot = track && state.track === track ? state.snapshot : null;
  return { snapshot, track, rate, controls };
}
