module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    mocha: true,
    node: true,
  },
  extends: 'eslint:recommended',
  overrides: [
    {
      files: ['samples/*.js'],
      rules: {
        'no-console': ['off'],
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    camelcase: ['error'],
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-async-promise-executor': ['error'],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-empty': ['error'],
    'no-ex-assign': ['error'],
    'no-inner-declarations': ['error'],
    'no-loss-of-precision': ['error'],
    'no-prototype-builtins': ['error'],
    'no-redeclare': ['error'],
    'no-undef': ['error'],
    'no-unused-vars': ['error'],
    'no-useless-catch': ['error'],
    'no-useless-escape': ['error'],
    'no-var': ['error'],
    'prefer-const': ['error'],
  },
};
