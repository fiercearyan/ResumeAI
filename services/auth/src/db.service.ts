import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  async onModuleInit() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Wait until DB is reachable (migrations may still be running in orchestrator on first boot).
    for (let i = 0; i < 30; i++) {
      try {
        await this.pool.query('SELECT 1');
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error('Postgres not reachable after 30s');
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  query<T extends QueryResultRow = any>(text: string, params?: any[]) {
    return this.pool.query<T>(text, params);
  }
}
