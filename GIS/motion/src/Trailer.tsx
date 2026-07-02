import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {
  AppFrame, DashboardView, GISWorkspace, AssetPanel,
  KPIS, KpiCard, CompositionCard, MaterialsCard, AgeCard, ReservoirCard, FLOW, CORAL,
} from './AppUI';

const fps = 30;
const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 16, duration - 16, duration], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
const sp = (frame: number, delay = 0, cfg: {damping?: number; stiffness?: number} = {}) =>
  spring({frame: frame - delay, fps, config: {damping: 20, stiffness: 80, ...cfg}});

const LOGO_MARK = staticFile('audio/Aquawise-mark-blue.png');
const LOGO_LOCKUP = staticFile('audio/Aquawise-lockup-blue.png');

const Caption: React.FC<{children: React.ReactNode; dark?: boolean}> = ({children, dark}) => {
  const frame = useCurrentFrame();
  const p = sp(frame, 0, {damping: 18, stiffness: 120});
  return (
    <div className={`caption ${dark ? 'caption-dark' : ''}`} style={{opacity: p, transform: `translateX(-50%) translateY(${20 - p * 20}px)`}}>
      <span>{children}</span>
    </div>
  );
};

// One consistent entrance for the app window so every UI scene is the SAME size.
const AppStage: React.FC<{frame: number; flush?: boolean; children: React.ReactNode}> = ({frame, flush, children}) => {
  const p = sp(frame, 6);
  return (
    <div className={`app-stage${flush ? ' flush' : ''}`} style={{opacity: p, transform: `scale(${0.96 + p * 0.04}) translateY(${24 - p * 24}px)`}}>
      {children}
    </div>
  );
};

/* ── 1 · Visibility hook (0:00–0:07) ── */
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = sp(frame, 8, {damping: 14, stiffness: 90});
  const out = interpolate(frame, [150, 200], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill className="scene white" style={{opacity: fade(frame, 210)}}>
      <div className="water-orbit" style={{transform: `translate(-50%,-50%) scale(${0.3 + pulse * 1.1})`, opacity: 0.9 * out}}/>
      <div className="opening-mark" style={{opacity: out, transform: `translate(-50%,-50%) scale(${0.85 + pulse * 0.15})`}}>
        <Img src={LOGO_MARK} className="logo-mark" alt="AquaWise"/>
      </div>
      {frame > 80 && <Caption dark>Make every part of your network visible.</Caption>}
    </AbsoluteFill>
  );
};

/* ── 2 · Unify the data (0:07–0:17) ── */
const Unify: React.FC = () => {
  const frame = useCurrentFrame();
  const chips = interpolate(frame, [10, 80], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill className="scene navy" style={{opacity: fade(frame, 300)}}>
      <div className="brand-intro"><Img src={LOGO_LOCKUP} className="logo-lockup" alt="AquaWise"/><span>One platform for the whole network.</span></div>
      <div className="upload-chips" style={{opacity: chips}}><span>Asset records</span><span>GIS data</span><span>Maintenance</span><span>Hydraulic models</span><b>Unified ✓</b></div>
      <AppStage frame={frame}><AppFrame active="dashboard" title="Operations Dashboard" sub="Riverton Water Network · 3,233 segments · 716 km"><DashboardView/></AppFrame></AppStage>
      {frame > 110 && <Caption>Bring it all together — instantly.</Caption>}
    </AbsoluteFill>
  );
};

/* ── 3 · Manage every asset — cards individually (0:17–0:27) ── */
const AssetManagement: React.FC = () => {
  const frame = useCurrentFrame();
  const cards = [<CompositionCard key="c"/>, <MaterialsCard key="m"/>, <AgeCard key="a"/>, <ReservoirCard key="r"/>];
  const phase = 78;
  const idx = Math.min(cards.length - 1, Math.max(0, Math.floor((frame - 150) / phase)));
  const local = frame - 150 - idx * phase;
  const cin = sp(local, 0, {damping: 18, stiffness: 90});
  const cout = interpolate(local, [phase - 16, phase], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const showCards = frame >= 150;
  return (
    <AbsoluteFill className="scene navy" style={{opacity: fade(frame, 300)}}>
      <div className="beat-eyebrow">ASSET MANAGEMENT</div>
      {!showCards && (
        <div className="kpi-spot-grid">
          {KPIS.map((k, i) => {
            const e = sp(frame, 12 + i * 12);
            return <div key={k.label} style={{opacity: e, transform: `translateY(${28 - e * 28}px) scale(${0.9 + e * 0.1})`}}><KpiCard k={k}/></div>;
          })}
        </div>
      )}
      {showCards && (
        <div className="spot" style={{width: 860, opacity: cin * cout, transform: `translate(-50%,-50%) translateY(${40 - cin * 40}px) scale(${0.97 + cin * 0.04})`}}>{cards[idx]}</div>
      )}
      {frame > 40 && <Caption>Manage every pipe, valve, pump, tank and meter.</Caption>}
    </AbsoluteFill>
  );
};

/* ── 4 · See condition — network to single asset (0:27–0:38) ── */
const SeeNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const panel = sp(frame, 150, {damping: 18, stiffness: 95});
  return (
    <AbsoluteFill className="scene navy" style={{opacity: fade(frame, 330)}}>
      <AppStage frame={frame} flush><AppFrame active="gis" title="GIS Map" sub="Riverton Water Supply Network · live operational view" flush><GISWorkspace dash={frame * 4}/></AppFrame></AppStage>
      <div className="float-card" style={{opacity: panel, transform: `translateX(${80 - panel * 80}px)`}}><AssetPanel/></div>
      {frame > 60 && <Caption>From the whole network down to one critical asset.</Caption>}
    </AbsoluteFill>
  );
};

/* ── 5 · Non-revenue water (0:38–0:49) ── */
const NRW: React.FC = () => {
  const frame = useCurrentFrame();
  const mini = sp(frame, 150, {damping: 18, stiffness: 90});
  const leakPulse = (frame % 36) / 36;
  const measured = interpolate(frame, [60, 150], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill className="scene navy" style={{opacity: fade(frame, 330)}}>
      <AppStage frame={frame} flush><AppFrame active="nrw" title="Non-Revenue Water" sub="Expected vs measured flow · loss localisation" flush><GISWorkspace dash={frame * 5} leak leakPulse={leakPulse}/></AppFrame></AppStage>
      <div className="nrw-mini" style={{opacity: mini, transform: `translateY(${60 - mini * 60}px)`}}>
        <div className="lg"><span><i style={{background: FLOW}}/>Expected flow</span><span><i style={{background: CORAL}}/>Measured flow</span></div>
        <svg viewBox="0 0 480 150" style={{width: '100%'}}>
          <path d="M6 120 C90 110 110 60 170 72 S300 110 360 66 470 40 474 52" fill="none" stroke={FLOW} strokeWidth="7"/>
          <path d="M6 120 C90 110 110 60 170 72 S300 130 360 126 470 120 474 132" fill="none" stroke={CORAL} strokeWidth="7" strokeDasharray="14 10" strokeDashoffset={(1 - measured) * 600} opacity={measured}/>
        </svg>
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 12}}>
          <div><div style={{color: '#94a3b8', fontSize: 13}}>Flow variance</div><strong style={{fontSize: 22, color: CORAL}}>Investigate</strong></div>
          <div style={{textAlign: 'right'}}><div style={{color: '#94a3b8', fontSize: 13}}>Estimated NRW</div><strong style={{fontSize: 22}}>22.5%</strong></div>
        </div>
      </div>
      {frame > 60 && <Caption>Detect anomalies. Uncover non-revenue water.</Caption>}
    </AbsoluteFill>
  );
};

/* ── 6 · Run hydraulic simulations (0:49–1:01) ── */
const Simulate: React.FC = () => {
  const frame = useCurrentFrame();
  const sim = frame < 120 ? 'Ready to run' : frame < 230 ? 'Running…' : 'Simulation successful';
  const wave = interpolate(frame, [120, 230], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill className="scene navy" style={{opacity: fade(frame, 360)}}>
      <div className="beat-eyebrow">HYDRAULIC MODEL</div>
      <AppStage frame={frame} flush>
        <AppFrame active="gis" title="GIS Map · Simulation" sub="Hazen-Williams · pressure-driven hydraulic run" flush><GISWorkspace dash={frame * (3 + wave * 7)} sim={sim}/></AppFrame>
        <div className="sim-wave" style={{opacity: sim === 'Running…' ? 0.9 : 0, transform: `scale(${0.2 + wave * 2.4})`}}/>
      </AppStage>
      {frame > 70 && <Caption>Test interventions before teams enter the field.</Caption>}
    </AbsoluteFill>
  );
};

/* ── 7 · Outcome (1:01–1:09) ── */
const OUTCOMES = [
  {value: '−31%', label: 'Non-revenue water', sub: 'projected reduction'},
  {value: '+0.6 bar', label: 'Pressure restored', sub: 'across affected zones'},
  {value: '1,240', label: 'Customers protected', sub: 'from supply loss'},
];
const Outcome: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="scene navy" style={{opacity: fade(frame, 240)}}>
      <div className="beat-eyebrow">THE OUTCOME</div>
      <div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 28}}>
        {OUTCOMES.map((o, i) => {
          const e = sp(frame, 18 + i * 16);
          return (
            <div key={o.label} style={{width: 360, padding: '40px 34px', borderRadius: 24, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', textAlign: 'center', opacity: e, transform: `translateY(${40 - e * 40}px) scale(${0.94 + e * 0.06})`}}>
              <div style={{fontSize: 64, fontWeight: 800, letterSpacing: '-2px', color: '#fff'}}>{o.value}</div>
              <div style={{fontSize: 22, fontWeight: 700, color: '#cfe0ff', marginTop: 8}}>{o.label}</div>
              <div style={{fontSize: 15, color: '#8ea3c2', marginTop: 4}}>{o.sub}</div>
            </div>
          );
        })}
      </div>
      {frame > 60 && <Caption>Act sooner. Protect water — and revenue.</Caption>}
    </AbsoluteFill>
  );
};

/* ── 8 · Lockup (1:09–1:15) ── */
const Lockup: React.FC = () => {
  const frame = useCurrentFrame();
  const p = sp(frame, 16, {damping: 18, stiffness: 75});
  return (
    <AbsoluteFill className="scene lockup" style={{background: '#f4f7fc'}}>
      <div className="halo" style={{transform: `translate(-50%,-50%) scale(${0.7 + p * 0.5})`, opacity: 0.6}}/>
      <div className="lockup-logo" style={{opacity: p, transform: `translate(-50%,-50%) scale(${0.85 + p * 0.15})`}}>
        <Img src={LOGO_LOCKUP} className="logo-lockup" alt="AquaWise"/>
        <p>Manage every asset. Understand every flow.<br/>Reduce non-revenue water.</p>
        <strong>See it. Simulate it. Act.</strong>
      </div>
    </AbsoluteFill>
  );
};

const FilmGrade: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame % 240, [0, 240], [-30, 130]);
  const g = (frame * 53) % 100;
  return (
    <AbsoluteFill className="film-grade" style={{pointerEvents: 'none'}}>
      <div className="film-vignette"/>
      <div className="film-sweep" style={{transform: `translateX(${sweep}%) skewX(-18deg)`}}/>
      <div className="film-grain" style={{backgroundPosition: `${g}px ${(g * 1.7) % 100}px`}}/>
      <div className="film-bar film-bar-top"/>
      <div className="film-bar film-bar-bottom"/>
    </AbsoluteFill>
  );
};

const VO: React.FC<{from: number; n: string}> = ({from, n}) => (
  <Sequence from={from}><Audio src={staticFile(`audio/voiceover-${n}.mp3`)} volume={1}/></Sequence>
);

export const AquaWiseTrailer: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => (
  <AbsoluteFill className="trailer">
    {withAudio && <>
      <Audio src={staticFile('audio/ambient.wav')} volume={0.32}/>
      <VO from={4} n="01"/>
      <VO from={214} n="02"/>
      <VO from={514} n="03"/>
      <VO from={814} n="04"/>
      <VO from={1144} n="05"/>
      <VO from={1474} n="06"/>
      <VO from={1834} n="07"/>
      <VO from={2074} n="08"/>
    </>}
    <Sequence from={0} durationInFrames={210}><Hook/></Sequence>
    <Sequence from={210} durationInFrames={300}><Unify/></Sequence>
    <Sequence from={510} durationInFrames={300}><AssetManagement/></Sequence>
    <Sequence from={810} durationInFrames={330}><SeeNetwork/></Sequence>
    <Sequence from={1140} durationInFrames={330}><NRW/></Sequence>
    <Sequence from={1470} durationInFrames={360}><Simulate/></Sequence>
    <Sequence from={1830} durationInFrames={240}><Outcome/></Sequence>
    <Sequence from={2070} durationInFrames={180}><Lockup/></Sequence>
    <FilmGrade/>
  </AbsoluteFill>
);
