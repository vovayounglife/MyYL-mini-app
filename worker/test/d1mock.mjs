import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...p) { const s = new Stmt(this.db, this.sql); s.params = p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v)); return s; }
  _run() {
    const st = this.db.prepare(this.sql);
    if (/^\s*(SELECT|WITH)/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) return { results: st.all(...this.params), success: true };
    const r = st.run(...this.params); return { results: [], success: true, meta: { changes: r.changes } };
  }
  async all() { return this._run(); }
  async run() { return this._run(); }
  async first(col) { const r = this._run().results[0]; return r == null ? null : col ? r[col] : r; }
}
export function makeD1(schemaPath) {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try { const out = stmts.map((s) => s._run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
