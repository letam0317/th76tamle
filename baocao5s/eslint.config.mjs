// Cấu hình ESLint (flat config) cho bộ script Node + Puppeteer.
// Khai báo cả globals trình duyệt vì nhiều file nhúng code chạy trong trang
// qua page.evaluate()/evaluateOnNewDocument() (window, document, XMLHttpRequest...).
export default [
  { ignores: ['node_modules/**', 'kiemsoatkho/**', 'public/**', '.wms-session/**', '**/edge-profile/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        // Node
        console: 'readonly', process: 'readonly', Buffer: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly',
        fetch: 'readonly', FormData: 'readonly', Blob: 'readonly',
        AbortController: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly',
        atob: 'readonly', btoa: 'readonly', structuredClone: 'readonly',
        // Trình duyệt (trong callback page.evaluate)
        window: 'readonly', document: 'readonly', location: 'readonly',
        navigator: 'readonly', XMLHttpRequest: 'readonly', localStorage: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-dupe-else-if': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-cond-assign': 'error',
      'no-func-assign': 'error',
      'no-redeclare': 'error',
      'no-self-assign': 'error',
      'no-sparse-arrays': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-fallthrough': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-async-promise-executor': 'error',
      'no-compare-neg-zero': 'error',
      'no-import-assign': 'error',
      'no-setter-return': 'error',
      'no-loss-of-precision': 'error',
    },
  },
];
