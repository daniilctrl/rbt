/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testTimeout: 60000,
  moduleNameMapper: {
    '^@app/contracts$': '<rootDir>/../../../packages/contracts/src',
    '^@app/contracts/(.*)$': '<rootDir>/../../../packages/contracts/src/$1',
  },
};
