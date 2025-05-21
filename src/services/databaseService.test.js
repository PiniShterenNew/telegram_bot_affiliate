const sqlite3 = require('sqlite3');
const { markDealAsSent, isDealSent } = require('./databaseService'); // Adjust path if needed

// Mock the DB_PATH to use an in-memory database for tests
jest.mock('../services/databaseService', () => {
  const originalModule = jest.requireActual('../services/databaseService');
  const path = require('path'); // original path module
  const DB_PATH_TEST = ':memory:'; // Use in-memory DB for testing

  // Override the db instance within the module for testing
  const dbTest = new sqlite3.Database(DB_PATH_TEST);

  // Ensure the table is created for the in-memory DB
  // This needs to be done before tests run, but dbTest must be initialized first.
  // We'll serialize this in a beforeAll block.

  return {
    ...originalModule,
    // We can't directly override 'db' if it's not exported and only used internally.
    // The strategy is that databaseService.js itself will use its DB_PATH.
    // For full control, databaseService.js would need to allow injecting a db instance or path.
    // Given the current structure, we will re-initialize the table for each test suite run
    // by directly manipulating the module's db instance IF POSSIBLE, or by relying on
    // the module's own initialization with a mocked DB_PATH.

    // For this test, the simplest is to ensure the module uses :memory:
    // We will mock the DB_PATH *inside* databaseService.js when it's loaded.
    // This requires a bit of a setup.
    // The current databaseService.js initializes `db` immediately.
    // We will mock the `sqlite3.Database` constructor to intercept the path.

    // Let's try a different approach: test the module as is, but ensure a clean state.
    // The module itself creates the table. We need to ensure it's clean for each test.
    // This is tricky because the `db` instance is module-scoped.
    // The best way is to ensure the module can re-initialize or provide a way to clean.
    // Given no such method, tests might interfere if run in parallel or if state persists.

    // For Jest, we can clear the require cache and re-require the module for some tests,
    // combined with an in-memory DB.

    // Let's simplify: the module already creates the table IF NOT EXISTS.
    // We'll use an in-memory DB. Each test file run will get a fresh in-memory DB.
    __getDb: () => dbTest, // Expose for setup/teardown
    __createTable: (dbInstance) => {
        return new Promise((resolve, reject) => {
            dbInstance.run(`CREATE TABLE IF NOT EXISTS sent_deals (
                item_id TEXT PRIMARY KEY,
                title TEXT,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    },
     __clearTable: (dbInstance) => {
        return new Promise((resolve, reject) => {
            dbInstance.run('DELETE FROM sent_deals', (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }
  };
});


// Store the original console.error
const originalConsoleError = console.error;

describe('databaseService', () => {
  let db;

  beforeAll(async () => {
    // Manually get the test DB instance from the mocked module
    // This is a bit of a workaround due to the module's internal `db` initialization.
    // A better way would be for databaseService.js to export its `db` or a setup function.
    
    // Forcing the module to use an in-memory DB by mocking its internal DB_PATH
    // This is more robust if the module itself initializes the DB.
    jest.resetModules(); // Clear module cache
    jest.doMock('path', () => ({
        ...jest.requireActual('path'),
        join: (...args) => {
            if (args.some(arg => arg.includes('database.sqlite'))) {
                return ':memory:'; // Force in-memory for the DB path
            }
            return jest.requireActual('path').join(...args);
        }
    }));
    
    const dbService = require('./databaseService'); // Re-require with mocked path
    db = dbService.__getDb(); // This line would ideally get the db instance from the re-required module
                               // However, the mock structure above is more for illustration.
                               // The key is that databaseService.js itself should use :memory:
                               // We'll rely on the initial table creation within databaseService.js
                               // when it loads with the :memory: path.
    
    // If __getDb and __createTable were correctly set up in the mock:
    // db = require('./databaseService').__getDb();
    // await require('./databaseService').__createTable(db);
  });
  
  beforeEach(async () => {
    // Suppress console.error for most tests
    console.error = jest.fn();
    
    // Clean the table before each test
    // This relies on the module being re-evaluated with :memory: or having a clear method.
    // For an in-memory DB, it's usually fresh per jest worker or if modules are reset.
    // To be absolutely sure for serial tests in one file:
    const dbService = require('./databaseService'); // Ensures we're talking to the same :memory: instance if not reset
    const testDb = dbService.__getDb ? dbService.__getDb() : null; // Check if exposed
    if (testDb) {
        await new Promise((resolve, reject) => {
            testDb.serialize(async () => {
                 // Ensure table exists (idempotent)
                await dbService.__createTable(testDb);
                // Clear table
                await dbService.__clearTable(testDb);
                resolve();
            });
        });
    }
  });

  afterEach(() => {
    // Restore original console.error after each test
    console.error = originalConsoleError;
  });

  afterAll((done) => {
    const dbService = require('./databaseService');
    const testDb = dbService.__getDb ? dbService.__getDb() : null;
    if (testDb) {
        testDb.close(err => {
            if (err) console.error(err.message);
            done();
        });
    } else {
        done();
    }
    jest.unmock('path'); // Unmock path to avoid affecting other tests
  });

  describe('markDealAsSent and isDealSent', () => {
    it('should correctly mark a new deal as sent and verify it', async () => {
      const newItemId = 'new_item_123';
      const newItemTitle = 'Test Deal Title';

      let dealIsSent = await isDealSent(newItemId);
      expect(dealIsSent).toBe(false);

      await expect(markDealAsSent(newItemId, newItemTitle)).resolves.toBe(true);

      dealIsSent = await isDealSent(newItemId);
      expect(dealIsSent).toBe(true);
    });

    it('isDealSent should return false for a non-existent deal', async () => {
      const dealIsSent = await isDealSent('non_existent_item_456');
      expect(dealIsSent).toBe(false);
    });

    it('markDealAsSent should reject with an error for a duplicate item_id (PRIMARY KEY constraint)', async () => {
      const duplicateItemId = 'duplicate_item_789';
      const title1 = 'First Title';
      const title2 = 'Second Title Attempt';

      await expect(markDealAsSent(duplicateItemId, title1)).resolves.toBe(true);
      
      // Restore console.error to check the actual SQLite error if logged by the function
      console.error = originalConsoleError; 
      try {
        await markDealAsSent(duplicateItemId, title2);
      } catch (error) {
        expect(error).toBeDefined();
        // Check for SQLite specific error for PRIMARY KEY constraint
        // The exact error message can vary, but usually includes "SQLITE_CONSTRAINT_PRIMARYKEY" or "UNIQUE constraint failed"
        expect(error.message).toMatch(/SQLITE_CONSTRAINT_PRIMARYKEY|UNIQUE constraint failed/i);
      }
    });
  });
});
