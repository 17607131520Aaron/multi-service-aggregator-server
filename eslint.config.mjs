import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      // 基础规则
      '@typescript-eslint/no-explicit-any': 'warn', // 改为 warn，避免过于严格
      '@typescript-eslint/explicit-module-boundary-types': 'off', // NestJS 中很多地方可以推断类型
      '@typescript-eslint/explicit-member-accessibility': [
        'warn',
        {
          accessibility: 'explicit',
          overrides: {
            constructors: 'no-public', // NestJS 构造函数通常不需要 public
            accessors: 'explicit',
            methods: 'explicit',
            properties: 'explicit',
            parameterProperties: 'explicit',
          },
        },
      ],

      // 变量声明相关
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-var': 'error',
      'prefer-const': 'error',

      // 类型检查相关
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: {
            constructors: 'no-public',
          },
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],

      // Promise 和异步相关
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
        },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn', // 改为 warn，避免过于严格
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'], // NestJS 推荐配置

      // 代码风格相关
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          prefix: ['I'],
          filter: {
            regex: '^(I[A-Z]|I[A-Z][a-z])',
            match: true,
          },
        },
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          filter: {
            regex: '^(process|global|__dirname|__filename)$',
            match: false,
          },
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: {
            memberTypes: [
              'signature',
              'public-static-field',
              'protected-static-field',
              'private-static-field',
              'public-instance-field',
              'protected-instance-field',
              'private-instance-field',
              'constructor',
              'public-static-method',
              'protected-static-method',
              'private-static-method',
              'public-instance-method',
              'protected-instance-method',
              'private-instance-method',
            ],
          },
        },
      ],

      // NestJS 特定规则
      '@typescript-eslint/no-empty-function': [
        'warn',
        { allow: ['constructors'] },
      ],
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // 代码质量规则
      'no-console': ['warn', { allow: ['warn', 'error'] }], // 允许 console.warn 和 console.error
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',

      // 复杂度控制
      'max-lines-per-function': [
        'warn',
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
      'max-params': ['warn', { max: 5 }], // NestJS 中依赖注入可能超过 4 个
      complexity: ['warn', { max: 15 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines': [
        'warn',
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  eslintConfigPrettier,
);
