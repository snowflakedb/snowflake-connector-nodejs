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
    'brace-style': ['warn', '1tbs'],
    'curly': ['warn', 'all'],
    'indent': ['warn', 2],
    'linebreak-style': ['warn', 'unix'],
    'no-async-promise-executor': ['warn'],
    'no-console': ['warn'],
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
    'prefer-const': ['warn'],
    'quotes': ['warn', 'single'],
    'semi': ['warn', 'always']
  }
};
