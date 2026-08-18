import { config } from 'dotenv';

// Unit tests that construct services directly (not through AppModule)
// never trigger @nestjs/config's own .env loading, so load it here. CI
// sets DATABASE_URL/REDIS_URL/etc. at the job level; dotenv does not
// override variables already present in the environment.
config({ path: `${__dirname}/../.env.test` });
