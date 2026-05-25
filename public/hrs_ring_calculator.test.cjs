const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('hrs_ring_calculator.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);

if (!scriptMatch) {
  throw new Error('No inline script found in hrs_ring_calculator.html');
}

[
  'id="guideBushID"',
  'id="rgGap"',
  'id="rgLen"',
  'id="nu"',
  'id="guideL"',
  'guideL:num',
  'p.guideL',
  'c.guideL',
  'L<sub>guide</sub>',
  'id="devGuideBushIDLow"',
  'id="devGuideBushIDHigh"',
  'rodGuideLeakM3s',
  'guideLeakSealed'
].forEach((removedText) => {
  if (html.includes(removedText)) {
    throw new Error(`Removed guide-bushing gap content is still present: ${removedText}`);
  }
});

if (!html.includes('id="guideFitL"')) {
  throw new Error('Guide fit length input id="guideFitL" is missing');
}

function parseInputs(overrides = {}) {
  const inputs = {};
  const inputRe = /<input\b[^>]*\bid="([^"]+)"[^>]*>/g;
  let match;

  while ((match = inputRe.exec(html))) {
    const tag = match[0];
    const id = match[1];
    const valueMatch = tag.match(/\bvalue="([^"]*)"/);
    inputs[id] = {
      value: Object.prototype.hasOwnProperty.call(overrides, id)
        ? String(overrides[id])
        : (valueMatch ? valueMatch[1] : ''),
      innerHTML: '',
      addEventListener() {},
      getContext() {
        return {};
      },
      offsetWidth: 700,
      offsetHeight: 290
    };
  }

  return inputs;
}

function buildDataWith(overrides) {
  const elements = parseInputs(overrides);
  const context = {
    console,
    Math,
    Number,
    Infinity,
    document: {
      getElementById(id) {
        if (!elements[id]) {
          elements[id] = {
            value: '',
            innerHTML: '',
            addEventListener() {},
            getContext() {
              return {};
            },
            offsetWidth: 700,
            offsetHeight: 290
          };
        }
        return elements[id];
      }
    },
    window: {
      devicePixelRatio: 1,
      addEventListener() {}
    }
  };

  vm.createContext(context);
  vm.runInContext(
    `${scriptMatch[1]}\nglobalThis.__buildData = buildData;`,
    context
  );
  return context.__buildData();
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function targetSignature(data) {
  return data.series[0].points
    .map((point) => Math.round(point.force * 1000))
    .reduce((sum, force) => sum + force, 0);
}

function assertCurveChanges(overrides, message) {
  const base = buildDataWith({});
  const changed = buildDataWith(overrides);
  if (targetSignature(base) === targetSignature(changed)) {
    throw new Error(`${message}: target curve did not change`);
  }
}

const defaultData = buildDataWith({ tubeL: 52 });
const longerData = buildDataWith({ tubeL: 62 });
const defaultTube = defaultData.p;
const longerTube = longerData.p;
const defaultNear60 = defaultData.series[0].points.reduce((best, point) =>
  Math.abs(point.s - 60) < Math.abs(best.s - 60) ? point : best
);
const longerNear60 = longerData.series[0].points.reduce((best, point) =>
  Math.abs(point.s - 60) < Math.abs(best.s - 60) ? point : best
);

assertEqual(defaultTube.entryToGuide, 45, 'default sleeve entry-to-guide distance');
assertEqual(longerTube.entryToGuide, 55, 'longer sleeve entry-to-guide distance');
assertEqual(defaultTube.sOn, 60, 'tubeL=52 should set HRS entry displacement from sleeve geometry');
assertEqual(longerTube.sOn, 50, 'tubeL=62 should move HRS entry displacement earlier');
assertEqual(defaultNear60.force, 0, 'tubeL=52 should just be entering HRS near s=60');
if (!(longerNear60.force > 0)) {
  throw new Error(`tubeL=62 should have entered HRS near s=60, got force ${longerNear60.force}`);
}

assertCurveChanges({ entryID: 60 }, 'entry diameter should affect the generated curve');
assertCurveChanges({ tubeRz: 99 }, 'tube roughness should affect the generated curve');
assertCurveChanges({ hrsVolL: 5000 }, 'effective chamber length should affect the generated curve');
assertCurveChanges({ bulkMPa: 1 }, 'effective bulk modulus should affect the generated curve');
assertCurveChanges({ transientGain: 0 }, 'transient gain should affect the generated curve');
assertCurveChanges({ transientDecay: 3 }, 'transient decay length should affect the generated curve');

const transientData = buildDataWith({});
const transientEnd = transientData.series[0].points.at(-1);
if (!(transientData.target.s < transientEnd.s - 1)) {
  throw new Error(`constant-speed transient peak should occur before stroke end, got peak s=${transientData.target.s}`);
}
if (!(transientData.target.force > transientEnd.force * 1.1)) {
  throw new Error(`constant-speed transient peak should fall by end, peak=${transientData.target.force}, end=${transientEnd.force}`);
}

console.log('hrs_ring_calculator geometry tests passed');
