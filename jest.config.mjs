import { withTestSelection } from '@variance-authority/sense/jest';

export default withTestSelection({
  // withTestSelection reads this object before jest resolves a preset, so ts-jest is named here
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  // sources import `./x.js` so the published code and declarations resolve; jest needs `./x.ts`
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
});
