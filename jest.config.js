module.exports = {
  preset: 'ts-jest',
  // sources import `./x.js` so the published code and declarations resolve; jest needs `./x.ts`
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
