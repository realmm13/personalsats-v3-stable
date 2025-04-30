/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: "node",
  rootDir: '.',
  moduleNameMapper: {
    '^@/email/templates/.*$': '<rootDir>/src/__mocks__/fileMock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testRegex: '/src/.*\\.(test|spec)\\.ts$',
  testPathIgnorePatterns: [
     "/node_modules/",
     "/.next/"
  ],
  // globals: { // Not strictly needed if tsconfig is specified in transform
  //   'ts-jest': {
  //     tsconfig: 'tsconfig.json',
  //   }
  // }
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};