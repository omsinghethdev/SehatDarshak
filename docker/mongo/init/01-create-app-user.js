// Runs in mongosh ONLY when the MongoDB data volume is empty (official mongo image behaviour);
// it never runs again for an existing database. It creates the least-privilege account the API
// uses: read/write on the application database only. The root account (MONGO_INITDB_ROOT_*) is
// for database administration and is not given to the API. Values come from the environment and
// are never printed.

const dbName = process.env.MONGO_INITDB_DATABASE;
const user = process.env.MONGO_APP_USERNAME;
const pwd = process.env.MONGO_APP_PASSWORD;

if (!dbName || !user || !pwd) {
  throw new Error('MONGO_INITDB_DATABASE, MONGO_APP_USERNAME, and MONGO_APP_PASSWORD are required.');
}

db.getSiblingDB(dbName).createUser({ user, pwd, roles: [{ role: 'readWrite', db: dbName }] });
print(`Created the application database user for "${dbName}".`);
