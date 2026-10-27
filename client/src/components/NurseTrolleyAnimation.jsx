import { useEffect, useRef } from "react";
import { Heart } from "lucide-react";
import "./NurseTrolleyAnimation.css";

export const NURSE_IMAGE_SRC = "/images/nurse-patient-3d.webp";

// One heartbeat every 200 units. The monitor shows 1200 units; one extra beat lets the trace
// scroll left by a full beat and loop seamlessly. Keep the shape in sync with @keyframes ecgPen.
const ECG_PATH = Array.from({ length: 7 }, (_, i) => {
  const x = i * 200;
  return `L${x + 80} 50 L${x + 90} 42 L${x + 100} 50 L${x + 110} 50 L${x + 118} 14 L${x + 126} 86 L${x + 134} 50 L${x + 150} 50 L${x + 160} 43 L${x + 170} 50 L${x + 200} 50`;
}).join(" ");

/**
 * A hospital corridor with a nurse pushing a patient on a stretcher. The walk itself is
 * driven by IntroAnimation through `walkerRef`, so the nurse and the page reveal stay in
 * step; this component only draws the scene and the in-place motion (steps, hearts, ECG).
 */
export default function NurseTrolleyAnimation({ walkerRef, onImageLoad, onImageError }) {
  const imageRef = useRef(null);

  // A cached (or preloaded) image can finish before React is listening for its load event.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) onImageLoad?.();
  }, [onImageLoad]);

  return (
    <div className="nurse-animation" aria-hidden="true">
      <div className="nurse-wall" />

      {/* Live heart monitor: the trace scrolls left out of a glowing pen, like a real ECG. */}
      <div className="nurse-ecg">
        <svg viewBox="0 0 1200 100" preserveAspectRatio="none">
          <g className="nurse-ecg-trace">
            <path d={`M0 50 ${ECG_PATH}`} />
          </g>
        </svg>
        <span className="nurse-ecg-pen" />
      </div>

      <div className="nurse-floor" />

      <div ref={walkerRef} className="nurse-walker">
        <span className="nurse-shadow" />
        <img
          ref={imageRef}
          src={NURSE_IMAGE_SRC}
          alt=""
          className="nurse-3d-image"
          draggable="false"
          fetchPriority="high"
          onLoad={onImageLoad}
          onError={onImageError}
        />
        {/* Care, rising from the nurse as she walks. */}
        <span className="nurse-hearts">
          <Heart className="nurse-heart" fill="currentColor" strokeWidth={0} />
          <Heart className="nurse-heart" fill="currentColor" strokeWidth={0} />
          <Heart className="nurse-heart" fill="currentColor" strokeWidth={0} />
        </span>
      </div>
    </div>
  );
}
