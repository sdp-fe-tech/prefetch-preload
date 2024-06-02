module.exports = {
    transform: {
      '^.+\\.ts$': 'ts-jest',
      '^.+\\.js$': 'babel-jest',
      '.*\\.(vue)$': 'vue-jest'
    },
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js', 'vue']
  };
  