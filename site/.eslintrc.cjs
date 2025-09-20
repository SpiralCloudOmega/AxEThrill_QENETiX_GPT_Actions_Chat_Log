module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  ignorePatterns: [
    'node_modules/',
    'out/',
    '.next/',
    'logs/',
    'public/',
    'site/public/',
    'scripts/ingest.mjs'
  ],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': 'off',
    // Relax high-noise rules for legacy placeholder blocks & exploratory scripts
    'no-empty': ['warn', { allowEmptyCatch: true }],
    '@typescript-eslint/no-explicit-any': 'off',
    'prefer-const': 'warn',
    'no-constant-condition': ['warn', { checkLoops: false }]
  }
};
