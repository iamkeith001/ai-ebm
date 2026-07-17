import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('./app.js', import.meta.url), 'utf8');

test('free-text PICO extraction never routes through a teaching preset', () => {
    assert.doesNotMatch(appSource, /matchedPreset/);
    assert.doesNotMatch(appSource, /text\.includes\('COPD'\)/);
});

test('clinical recommendation is gated by evidence appraisal and EtD', () => {
    assert.match(appSource, /function getEvidenceReadiness\(\)/);
    assert.match(appSource, /function getEtDCompletion\(\)/);
    assert.match(appSource, /if \(!readiness\.readyForCertainty\)/);
    assert.match(appSource, /if \(!etd\.complete\)/);
    assert.match(appSource, /hasEvidenceProfile/);
    assert.match(appSource, /grade-effect-estimate/);
});

test('hard-coded clinical claims and automatic strong recommendations are absent', () => {
    assert.doesNotMatch(appSource, /32 公尺/);
    assert.doesNotMatch(appSource, /Strong Recommendation/);
    assert.match(appSource, /評讀完成（非數值評分）/);
});
