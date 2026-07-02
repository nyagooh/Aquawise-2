import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {EdgeTTS} from 'node-edge-tts';

const outputDirectory = resolve('public/audio');
await mkdir(outputDirectory, {recursive: true});

const lines = [
  'Every day, water moves through thousands of connected assets. AquaWise makes every part of that network visible.',
  'Bring asset records, GIS data, maintenance information, and hydraulic models together — instantly.',
  'Manage every pipe, valve, pump, tank, meter, and connection from one intelligent platform.',
  'See asset condition, pressure, maintenance, and flow — from the entire network down to one critical asset.',
  'Compare expected and measured flow. Detect anomalies faster. Locate risk and uncover potential non-revenue water.',
  'Run hydraulic simulations, test interventions, understand their impact, and choose the right action before teams enter the field.',
  'Act sooner. Extend asset life. Improve operations. Protect water — and protect revenue.',
  'AquaWise. Manage every asset. Understand every flow. Reduce non-revenue water. See it. Simulate it. Act.',
];

// Positive, energetic, persuasive Kenyan-English female voice (advertisement style).
const tts = new EdgeTTS({
  voice: 'en-KE-AsiliaNeural',
  lang: 'en-KE',
  outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
  pitch: '+1%',
  rate: '+7%',
  volume: '+0%',
  timeout: 30000,
});

for (const [index, line] of lines.entries()) {
  const filename = `voiceover-${String(index + 1).padStart(2, '0')}.mp3`;
  await tts.ttsPromise(line, resolve(outputDirectory, filename));
  process.stdout.write(`Created ${filename}\n`);
}
