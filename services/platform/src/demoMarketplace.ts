import type { Express, Response } from 'express';
import type { Pool } from 'pg';
import type * as C from '@7even/contracts';
export function mountDemoMarketplace(_app: Express, _pool: Pool, _actor: (res: Response) => C.SessionUser): void {}
