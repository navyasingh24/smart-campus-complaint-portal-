// Creates the first administrator account.
//
// There is deliberately no default admin user with a known password. Run
// this command once, on your own machine, with the details supplied through
// environment variables so the password never appears in source code:
//
//   read -rs -p "Admin password: " ADMIN_PASSWORD; export ADMIN_PASSWORD; echo
//   ADMIN_NAME="Campus Admin" ADMIN_EMAIL=admin@example.edu npm run create-admin
//   unset ADMIN_PASSWORD
//
// It writes to whichever database is configured (DB_DRIVER, AWS_REGION, ...).

const { loadConfig } = require('../src/config');
const { createStore } = require('../src/db');
const { createAdmin } = require('./adminService');

async function main() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD environment variables first.');
    process.exit(1);
  }

  // The admin script only needs database settings; a JWT secret is not used.
  const config = loadConfig({ ...process.env, JWT_SECRET: process.env.JWT_SECRET || 'x'.repeat(32) });
  const store = createStore(config.db);
  console.log(`Using database driver: ${store.driver}`);

  try {
    const admin = await createAdmin(store, {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    console.log(`Administrator created: ${admin.email} (id ${admin.userId})`);
  } catch (error) {
    const reason = error.details ? JSON.stringify(error.details) : error.message;
    console.error(`Could not create administrator: ${reason}`);
    process.exit(1);
  }
}

main();
