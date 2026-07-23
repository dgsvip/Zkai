const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'jialejia.db');
let SQL = null;

class DbWrapper {
  constructor() {
    this.db = null;
  }

  async init() {
    SQL = await initSqlJs();
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run('PRAGMA foreign_keys = ON');
    return this;
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  run(sql, params = []) {
    try {
      this.db.run(sql, params);
      this.save();
      return { lastInsertRowid: 0, changes: this.db.getRowsModified() };
    } catch (e) {
      console.error('DB run error:', sql, params, e.message);
      throw e;
    }
  }

  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    } catch (e) {
      console.error('DB get error:', sql, params, e.message);
      throw e;
    }
  }

  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('DB all error:', sql, params, e.message);
      throw e;
    }
  }

  exec(sql) {
    try {
      const results = this.db.exec(sql);
      this.save();
      return results;
    } catch (e) {
      console.error('DB exec error:', e.message);
      throw e;
    }
  }

  transaction(fn) {
    return (...args) => {
      this.db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        this.db.run('COMMIT');
        this.save();
        return result;
      } catch (e) {
        this.db.run('ROLLBACK');
        throw e;
      }
    };
  }

  close() {
    this.save();
    this.db.close();
  }
}

let instance = null;

async function getDb() {
  if (!instance) {
    instance = new DbWrapper();
    await instance.init();
  }
  return instance;
}

module.exports = { getDb, DbWrapper, DB_PATH };