export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'android',
        'backend',
        'shared',
        'api-contracts',
        'design-system',
        'configs',
        'docker',
        'ci',
        'docs',
        'scripts',
        'repo',
        'deps',
      ],
    ],
  },
};
