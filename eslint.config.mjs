import eslint from '@eslint/js';
import stylisticJs from '@stylistic/eslint-plugin';
import { globalIgnores } from 'eslint/config';
import importsPlugin from 'eslint-plugin-import';
import noNullPlugin from 'eslint-plugin-no-null';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

// Inlined from @mytonwallet/eslint-config (common + the non-React parts of
// frontend), since that package is not published. Deviations are commented.
export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylistic,
  stylisticJs.configs.customize({
    semi: true,
    arrowParens: 'always',
    braceStyle: '1tbs',
    quoteProps: 'as-needed',
  }),
  {
    name: 'lovely-chart/recommended',
    files: ['**/*.{js,mjs,cjs,ts}'],
    rules: {
      // Dataset values arrive as `null` in raw JSON data; the comparisons
      // handling them carry targeted eslint-disable comments.
      'no-null/no-null': 'error',
      'no-console': 'error',
      'no-template-curly-in-string': 'error',
      'object-shorthand': 'error',
      eqeqeq: 'error',
      curly: ['error', 'multi-line'],
      'no-prototype-builtins': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      // Functions are ordered top-down by call hierarchy
      '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
      '@stylistic/max-len': ['error', {
        code: 120,
        ignoreComments: true,
        ignorePattern: '\\sd=".+"', // Ignore lines with "d" attribute
      }],
      '@stylistic/indent': ['error', 2, {
        SwitchCase: 1,
        flatTernaryExpressions: false,
      }],
      '@stylistic/multiline-ternary': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/prefer-for-of': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'none',
          caughtErrors: 'none',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'unused-imports/no-unused-imports': 'error',
      // Import groups adapted from the frontend config, minus the
      // React/teact/hooks/components entries that do not apply here.
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effect imports
            ['^\\u0000'],
            // Lib and global imports
            ['^@?\\w'],
            // Type imports
            [
              '^(\\.+/)+.+\\u0000$',
              '^(\\.+/|\\w+/)+(types)(/.*|$)',
              '^(\\.+/|\\w+/)+(types)\\u0000',
            ],
            // Config, utils, helpers
            [
              '^(\\.+/)+config',
              '^(\\.+/)+(util)(/.*|$)',
              '^\\.\\.(?!/?$)',
              '^\\.\\./?$',
              '^\\./(?=.*/)(?!/?$)',
              '^\\.(?!/?$)',
              '^\\./?$',
            ],
            // Styles
            ['^.+\\.s?css$'],
          ],
        },
      ],
    },
    plugins: {
      'no-null': noNullPlugin,
      'simple-import-sort': simpleImportSortPlugin,
      import: importsPlugin,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    name: 'lovely-chart/node-scripts',
    files: ['test/**', 'vite.config.js'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores([
    'dist',
    'docs',
    'node_modules',
  ]),
);
