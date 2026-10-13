/**
 * Decorative water backdrop for marketing surfaces: two flat, tone-on-tone wave
 * shapes sitting still behind the content. Colour comes from `currentColor` on
 * the wrapper, so the same art works grey on white and white on blue.
 */
export default function WaveBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`wv ${className}`} aria-hidden="true">
      <svg className="wv-layer wv-back" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path d="M0 150 C 220 70, 420 70, 640 130 S 1060 220, 1260 140 C 1340 110, 1400 105, 1440 110 V 320 H 0 Z" />
      </svg>
      <svg className="wv-layer wv-front" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path d="M0 230 C 260 170, 500 190, 760 225 S 1180 260, 1440 200 V 320 H 0 Z" />
      </svg>
    </div>
  );
}
