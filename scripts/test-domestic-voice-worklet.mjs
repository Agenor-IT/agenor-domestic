import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(new URL('../public/domestic-voice-worklet.js', import.meta.url), 'utf8');
function capture(rate, value) {
  let Capture;
  const frames = [];
  class Processor { port = { postMessage(buffer) { frames.push(new Int16Array(buffer)); } }; }
  runInNewContext(source, {
    sampleRate: rate, AudioWorkletProcessor: Processor,
    registerProcessor(name, implementation) { assert.equal(name, 'domestic-voice-capture'); Capture = implementation; }
  });
  const processor = new Capture();
  const samples = rate / 10;
  for (let start = 0; start < samples; start += 128) processor.process([[new Float32Array(Math.min(128, samples - start)).fill(value)]]);
  return frames;
}

for (const rate of [48000, 44100, 16000]) {
  test(`100ms at ${rate}Hz yields exactly five 20ms PCM16 frames`, () => {
    const frames = capture(rate, 0.5);
    assert.equal(frames.length, 5);
    // A single PCM least-significant bit of rounding is acceptable at fractional ratios.
    assert.ok(frames.every(frame => frame.length === 320 && frame.every(value => Math.abs(value - 16384) <= 1)));
  });
}
test('silence and clipping stay within signed PCM16 bounds', () => {
  for (const [input, output] of [[0, 0], [2, 32767], [-2, -32768]]) {
    assert.ok(capture(48000, input).every(frame => frame.every(value => value === output)));
  }
});
