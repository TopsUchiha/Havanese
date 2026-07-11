
// Safe Runtime Fix: Adds the delivery_address column only if it doesn't exist
if (db && typeof db.serialize === 'function') {
  db.serialize(() => {
    db.all("PRAGMA table_info(applications)", (err, rows) => {
      if (!err && rows) {
        const hasAddressColumn = rows.some(row => row.name === 'delivery_address');
        if (!hasAddressColumn) {
          db.run("ALTER TABLE applications ADD COLUMN delivery_address TEXT;");
        }
      }
    });
  });
}
