module.exports = {
  root: true,
  env: { node: true, es2023: true, browser: true },
  parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
  extends: [
    'eslint:recommended'
  ],
  ignorePatterns: [ 'public/', '.next/', 'out/' ],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['off'],
    'prefer-const': ['warn'],
    'no-var': ['error']
  },
  overrides: [
    {
      files: ['**/*.tsx','**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [ 'plugin:@typescript-eslint/recommended' ],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
      }
    }
  ]
};
