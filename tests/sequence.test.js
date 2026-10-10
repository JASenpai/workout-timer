// Verifies the workout-timer app actually renders a block-based workouts.json.
// Loads the real index.html in jsdom with stubbed fetch/AudioContext, then
// drives the timer and asserts on real DOM text.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = require('path').resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const workoutsRaw = fs.readFileSync(path.join(ROOT, 'workouts.json'), 'utf8');

let failures = 0;
const checks = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  checks.push(`${ok ? 'PASS' : 'FAIL'}  ${name}\n        got: ${JSON.stringify(actual)}${ok ? '' : `\n        exp: ${JSON.stringify(expected)}`}`);
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/index.html',
  beforeParse(window) {
    window.fetch = (url) => {
      if (String(url).includes('workouts.json')) {
        return Promise.resolve({ json: () => Promise.resolve(JSON.parse(workoutsRaw)) });
      }
      return Promise.reject(new Error('unexpected fetch ' + url));
    };
    window.AudioContext = class {
      constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
      resume() {}
      createOscillator() { return { connect() {}, start() {}, stop() {}, type: '', frequency: { value: 0 } }; }
      createGain() { return { connect() {}, gain: { setValueAtTime() {} } }; }
    };
    window.navigator.vibrate = () => {};
    window.navigator.wakeLock = { request: () => Promise.resolve({ release() {} }) };
    window.console.warn = () => {};
  }
});

const { window } = dom;
const doc = window.document;
const text = (id) => String(doc.getElementById(id).innerText);

setTimeout(() => {
  // --- initial render: first step of first block ---
  check('progressIndicator (initial)', text('progressIndicator'), 'Step 1 of 26');
  check('badge (superset)', text('blockBadge'), 'Superset · 4 rounds');
  check('blockName', text('blockName'), 'Pair A1');
  check('instructions present', text('instructions').startsWith('Alternate one set'), true);
  check('exName', text('exName'), 'Goblet Squat');
  check('exNotes', text('exNotes'), 'Keep chest up; control the descent');
  check('exMuscle', text('exMuscle'), 'Legs / Glutes');
  check('exLoad', text('exLoad'), '10 kg');
  check('reps input value', doc.getElementById('editReps').value, '10–15 reps');
  check('editSets', text('editSets'), '4');
  check('setIndicator', text('setIndicator'), 'Exercise 1/2 · Set 1/4');
  check('roundIndicator', text('roundIndicator'), 'Round 1/4');
  check('timerLabel (rest between ex)', text('timerLabel'), 'Ready · rest 30s');
  check('timerDisplay', text('timerDisplay'), '00:30');
  check('start button', doc.getElementById('startBtn').innerText, 'Start Rest');
  check('image shown', doc.getElementById('exImage').style.display, 'block');
  check('list rows (5 heads + 8 ex)', doc.getElementById('workoutList').children.length, 13);

  // --- start rest and let it run the 30s countdown -> next set in same round ---
  window.toggleTimer();
  check('running: label', text('timerLabel'), 'Rest period');
  check('running: pause button', doc.getElementById('startBtn').innerText, 'Pause');
  for (let i = 0; i < 30; i++) window.tick();   // drive ticks deterministically
  check('after 30s -> step 2', text('progressIndicator'), 'Step 2 of 26');
  check('after 30s -> row ex', text('exName'), 'One-Arm Dumbbell Row');
  check('after 30s -> last of round rest', text('timerLabel'), 'Ready · rest 60s');
  check('after 30s -> set index', text('setIndicator'), 'Exercise 2/2 · Set 1/4');

  // --- run round 1 out: next step is round 2, exercise 1 ---
  window.toggleTimer();
  for (let i = 0; i < 60; i++) window.tick();
  check('round 2 back to first exercise', text('exName'), 'Goblet Squat');
  check('round 2 indicator', text('roundIndicator'), 'Round 2/4');
  check('round 2 step', text('progressIndicator'), 'Step 3 of 26');

  // --- jump into the single block by clicking its list row ---
  const heads = doc.getElementById('workoutList').querySelectorAll('.block-head');
  check('list has 5 block heads (workout A)', heads.length, 5);
  // block index 2 = single "Romanian Deadlift — Extra Set"
  heads[2].click();
  check('single block badge', text('blockBadge'), 'Single · 1 set');
  check('single block name', text('blockName'), 'Romanian Deadlift — Extra Set');
  check('single block row', text('exName'), 'Romanian Deadlift');
  check('single block set indicator', text('setIndicator'), 'Set 1 / 1');
  check('single block round indicator hidden', text('roundIndicator'), '');
  check('single block after_round rest', text('timerLabel'), 'Ready · rest 60s');

  // --- adjustSets on the single block: 1 -> 2 sets, sequence grows ---
  window.adjustSets(1);
  check('single block sets after +1', text('editSets'), '2');
  check('total steps after +1 (26 -> 27)', text('progressIndicator'), 'Step 15 of 27');

  // --- superset sets edit moves all members together ---
  heads[0].click();
  window.adjustSets(1);
  check('superset sets 4 -> 5', text('editSets'), '5');
  check('superset badge rounds updated', text('blockBadge'), 'Superset · 5 rounds');
  check('superset 4->5 rounds adds 2 steps (27 -> 29)', text('progressIndicator'), 'Step 1 of 29');
  window.adjustSets(-1);
  check('superset sets back to 4', text('editSets'), '4');
  check('superset steps back', text('progressIndicator'), 'Step 1 of 27');

  // --- updateReps writes back to the model ---
  window.updateReps('12-15 reps');
  check('reps edit persisted in model', window.eval("workouts.A[0].exercises[0].reps"), '12-15 reps');
  check('reps edit reflected in list', doc.getElementById('workoutList').querySelector('.ex-item .ex-item-details').textContent.includes('12-15 reps'), true);
  check('sets still in sync (model)', window.eval("workouts.A[0].exercises[0].sets"), 4);
  check('block rounds still in sync (model)', window.eval("workouts.A[0].rounds"), 4);

  // --- workout B builds its own sequence ---
  window.switchWorkout('B');
  check('workout B first block', text('blockName'), 'Pair B1');
  check('workout B step 1', text('progressIndicator'), 'Step 1 of 26');
  check('workout B list heads', doc.getElementById('workoutList').querySelectorAll('.block-head').length, 6);
  check('workout B rest between', text('timerLabel'), 'Ready · rest 20s');

  // --- walk to the very end -> summary screen ---
  let guard = 0;
  while (text('progressIndicator') !== 'Step 26 of 26' && guard++ < 100) window.nextStep();
  check('reached last step', text('progressIndicator'), 'Step 26 of 26');
  window.nextStep();
  check('summary visible', doc.getElementById('summaryScreen').style.display, 'flex');
  check('summary text format', /^Total time: \d\d:\d\d$/.test(text('summaryText')), true);

  console.log(checks.join('\n'));
  console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
  process.exit(failures ? 1 : 0);
}, 150);
