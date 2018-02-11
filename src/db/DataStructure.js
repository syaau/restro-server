class DataStructure {
  constructor(db, name) {
    this.db = db;
    this.name = name;

    this.listeners = {
      insert: [],
      update: [],
      delete: [],
    };
  }

  addListener(type, listener) {
    const list = this.listeners[type];
    list.push(listener);

    // return a remove method
    return () => {
      const idx = list.indexOf(listener);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    };
  }

  fireListeners(type, ...args) {
    const list = this.listeners[type];
    list.forEach(l => l(...args));
  }

  async findOne(criteria) {
    const args = {};
    const condition = Object.keys(criteria).map((key) => {
      args[`:${key}`] = criteria[key];
      return `[${key}]=:${key}`;
    }).join(' AND ');

    const sql = `SELECT * FROM [${this.name}] WHERE ${condition}`;
    console.log(sql);
    const res = await this.db.get(sql, args);
    return res;
  }

  async all(filter, ...filterArgs) {
    const res = await this.db.all(`SELECT * FROM [${this.name}]${filter ? ` WHERE ${filter}` : ''}`, ...filterArgs);
    return res;
  }

  async get(id) {
    const res = await this.db.get(`SELECT * FROM [${this.name}] WHERE id = ?`, id);
    return res;
  }

  async insert(object) {
    const fields = Object.keys(object);
    const values = fields.map(f => object[f]);

    const fieldNames = fields.map(f => `[${f}]`).join(',');
    const qs = fields.map(() => '?').join(',');

    const sql = `INSERT INTO [${this.name}] (${fieldNames}) VALUES(${qs})`;
    const res = this.db.run(sql, ...values);

    const record = Object.assign({}, object, { id: res.lastID });

    // Fire up all the insert listeners with the new record
    this.fireListeners('insert', record);

    return record;
  }

  async update(object, id) {
    const setters = Object.keys(object).map(f => `[${f}]=:${f}`).join(',');
    const values = Object.keys(object).reduce((res, f) => {
      res[`:${f}`] = object[f];
      return res;
    }, { ':sourceId': id });

    // Get the original record, to let the listener know of the changes
    const original = await this.db.get(`SELECT * FROM [${this.name}] WHERE id=?`, id);

    // Update the record
    await this.db.run(`UPDATE [${this.name}] SET ${setters} WHERE id = :sourceId`, values);

    // Fire up all the update listeners with the new changes and the original values
    this.fireListeners(
      'update',
      Object.assign({}, { id }, object),
      Object.assign({}, original, { id })
    );

    // Return the final id of the record (if the id was also changed)
    return values[':id'] || id;
  }

  async delete(id) {
    const original = await this.db.get(`SELECT * FROM [${this.name}] WHERE id=?`, id);
    const res = await this.db.run(`DELETE FROM [${this.name}] WHERE id=?`, id);

    // Fire up all the delete listeners with the original record data
    this.fireListeners('delete', original);
    return res;
  }
}

module.exports = DataStructure;
