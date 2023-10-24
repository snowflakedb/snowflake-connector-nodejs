module.exports = {
  'env': {
    'browser': true,
    'commonjs': true,
    'es2021': true,
    'mocha': true,
    'node': true
  },
  'extends': 'eslint:recommended',
  'overrides': [],
  'parserOptions': {
    'ecmaVersion': 'latest'
  },
  'rules': {
    'array-bracket-spacing': ['warn'],
    'arrow-spacing': ['warn'],
    'block-spacing': ['warn'],
    'brace-style': ['warn', '1tbs'],
    'camelcase': ['warn'],
    'comma-spacing': ['warn'],
    'curly': ['warn', 'all'],
    'eqeqeq': ['warn'],
    'indent': ['warn', 2],
    'key-spacing': ['warn'],
    'keyword-spacing': ['warn'],
    'linebreak-style': ['warn', 'unix'],
    'no-async-promise-executor': ['warn'],
    'no-console': ['warn', { 'allow': ['warn', 'error'] }],
    'no-empty': ['warn'],
    'no-ex-assign': ['warn'],
    'no-extra-semi': ['warn'],
    'no-inner-declarations': ['warn'],
    'no-loss-of-precision': ['warn'],
    'no-mixed-spaces-and-tabs': ['error'],
    'no-prototype-builtins': ['warn'],
    'no-redeclare': ['warn'],
    'no-undef': ['warn'],
    'no-unused-vars': ['warn'],
    'no-useless-catch': ['warn'],
    'no-useless-escape': ['warn'],
    'no-var': ['warn'],
    'object-curly-spacing': ['warn', 'always'],
    'prefer-const': ['warn'],
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'always'],
    'semi-spacing': ['warn'],
    'space-before-function-paren': ['warn', {
      'anonymous': 'always',
      'named': 'never',
      'asyncArrow': 'always',
    }],
    'space-infix-ops': ['warn'],
  }
};
