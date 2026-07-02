import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

/**
 * Synthesizes a cinematic background-music bed for the AquaWise trailer —
 * pure Node, no external assets. Builds a warm pad chord progression
 * (Am–F–C–G), a soft plucked arpeggio, a sub-bass, a half-time cinematic
 * kick, gentle hats in the back half, and white-noise risers + impacts on
 * scene boundaries. Mixed low so the voiceover always sits on top.
 */
const sampleRate = 44100;
const durationSeconds = 75;
const sampleCount = sampleRate * durationSeconds;
const data = Buffer.alloc(sampleCount * 2);

const BPM = 86;
const secPerBeat = 60 / BPM;
const barLen = secPerBeat * 4;

// Chord progression (vi–IV–I–V in C / A-minor) — uplifting but credible.
const CH = {
  Am: {bass: 110.0, tones: [220.0, 261.63, 329.63]},
  F: {bass: 87.31, tones: [174.61, 261.63, 349.23]},
  C: {bass: 130.81, tones: [196.0, 261.63, 329.63]},
  G: {bass: 98.0, tones: [196.0, 246.94, 293.66]},
};
const PROG = [CH.Am, CH.F, CH.C, CH.G];

const sceneHits = [0, 7, 17, 27, 38, 49, 61, 69];

let noiseState = 1729;
const random = () => {
  noiseState = (noiseState * 1664525 + 1013904223) >>> 0;
  return noiseState / 4294967296;
};

const sine = (t, f) => Math.sin(t * Math.PI * 2 * f);

for (let index = 0; index < sampleCount; index++) {
  const time = index / sampleRate;
  const fadeIn = Math.min(1, time / 2.5);
  const fadeOut = Math.min(1, (durationSeconds - time) / 4);

  const chord = PROG[Math.floor(time / barLen) % PROG.length];

  // Warm pad — chord tones with slow chorus/vibrato, gentle swell per bar.
  const barPhase = (time % barLen) / barLen;
  const swell = 0.55 + 0.45 * Math.sin(barPhase * Math.PI);
  let pad = 0;
  for (const f of chord.tones) {
    pad += sine(time, f * (1 + Math.sin(time * 0.6) * 0.0015));
    pad += sine(time, f * 2) * 0.25;
  }
  pad *= 0.018 * swell;

  // Sub-bass — chord root, soft.
  const bass = sine(time, chord.bass) * 0.05 + sine(time, chord.bass / 2) * 0.03;

  // Plucked arpeggio (8th notes) — comes in after the intro.
  const noteLen = secPerBeat / 2;
  const noteIdx = Math.floor(time / noteLen);
  const inNote = time - noteIdx * noteLen;
  const arpPattern = [0, 1, 2, 1, 0, 2, 1, 2];
  const arpTone = chord.tones[arpPattern[noteIdx % arpPattern.length] % chord.tones.length] * 2;
  const arpEnv = Math.exp(-inNote * 7);
  const arpGain = Math.min(1, Math.max(0, (time - 16) / 4)) * (time > 70 ? Math.max(0, (74 - time) / 4) : 1);
  const arp = (sine(inNote, arpTone) + sine(inNote, arpTone * 2) * 0.3) * arpEnv * 0.05 * arpGain;

  // Half-time cinematic kick on beats 1 & 3, after 10s.
  const beatIdx = Math.floor(time / secPerBeat);
  const inBeat = time - beatIdx * secPerBeat;
  let kick = 0;
  if (time > 10 && beatIdx % 2 === 0) {
    const pitch = 120 * Math.exp(-inBeat * 22) + 45;
    kick = Math.sin(inBeat * Math.PI * 2 * pitch) * Math.exp(-inBeat * 7) * 0.55;
  }

  // Soft hats on offbeats in the energetic back half (38s+).
  let hat = 0;
  if (time > 38) {
    const inHalf = time - (Math.floor(time / (secPerBeat / 2)) * (secPerBeat / 2));
    if (Math.floor(time / (secPerBeat / 2)) % 2 === 1) {
      hat = (random() * 2 - 1) * Math.exp(-inHalf * 60) * 0.04;
    }
  }

  // Scene-boundary risers (noise swell into the hit) + low impact.
  let riser = 0;
  let impact = 0;
  for (const s of sceneHits) {
    const pre = s - time;
    if (pre > 0 && pre < 1.2) riser += (random() * 2 - 1) * (1 - pre / 1.2) ** 2 * 0.06;
    const post = time - s;
    if (post >= 0 && post < 1.6) impact += Math.sin(post * Math.PI * 2 * 70) * Math.exp(-post * 3.8) * 0.12;
  }

  const mix = (pad + bass + arp + kick + hat + riser + impact) * 0.62 * fadeIn * fadeOut;
  const value = Math.max(-1, Math.min(1, mix));
  data.writeInt16LE(Math.round(value * 32767), index * 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

const outputDirectory = resolve('public/audio');
await mkdir(outputDirectory, {recursive: true});
await writeFile(resolve(outputDirectory, 'ambient.wav'), Buffer.concat([header, data]));
process.stdout.write('Created ambient.wav (cinematic music bed)\n');
