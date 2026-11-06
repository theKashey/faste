import { withTestSelection } from '@variance-authority/sense/jest';

export default withTestSelection(
  {
    // withTestSelection reads this object before jest resolves a preset, so ts-jest is named here
    // and tests compile to es2020: es5 turns a method into a load-time assignment, so the record reads every method as run
    transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { target: 'es2020' } }] },
    // sources import `./x.js` so the published code and declarations resolve; jest needs `./x.ts`
    moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  },
  { suite: 'unit' }
);
