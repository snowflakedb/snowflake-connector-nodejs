module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
    'mocha': true,
    'node': true
  },
  'extends': 'eslint:recommended',
  'overrides': [
    {
      'files': ['samples/*.js'],
      'rules': {
        'no-console': ['warn'],
      }
    }
  ],
  'parserOptions': {
    'ecmaVersion': 'latest'
  },
  'rules': {
    'array-bracket-spacing': ['error'],
    'arrow-spacing': ['error'],
    'block-spacing': ['error'],
    'brace-style': ['error', '1tbs'],
    'camelcase': ['error'],
    'comma-spacing': ['error'],
    'curly': ['error', 'all'],
    'eqeqeq': ['error', 'always', { 'null': 'ignore' }],
    'indent': ['error', 2],
    'key-spacing': ['error'],
    'keyword-spacing': ['error'],
    'linebreak-style': ['error', 'unix'],
    'no-async-promise-executor': ['error'],
    'no-console': ['error', { 'allow': ['warn', 'error'] }],
    'no-empty': ['error'],
    'no-ex-assign': ['error'],
    'no-extra-semi': ['error'],
    'no-inner-declarations': ['error'],
    'no-loss-of-precision': ['error'],
    'no-mixed-spaces-and-tabs': ['error'],
    'no-prototype-builtins': ['error'],
    'no-redeclare': ['error'],
    'no-undef': ['error'],
    'no-unused-vars': ['warn'],
    'no-useless-catch': ['error'],
    'no-useless-escape': ['error'],
    'no-var': ['warn'],
    'object-curly-spacing': ['error', 'always'],
    'prefer-const': ['error'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'semi-spacing': ['error'],
    'space-before-function-paren': ['error', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always',
    }],
    'space-infix-ops': ['error'],
  }
};
