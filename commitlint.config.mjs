export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'android',
        'api',
        'dashboard',
        'shared',
        'api-contracts',
        'design-system',
        'tooling',
        'config',
        'logger',
        'database',
        'infra',
        'ci',
        'docs',
        'scripts',
        'repo',
        'deps',
      ],
    ],
  },
};
