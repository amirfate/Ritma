import base from '@ritma/tooling/eslint/base';

export default [...base, { ignores: ['.next/**', 'next-env.d.ts'] }];
