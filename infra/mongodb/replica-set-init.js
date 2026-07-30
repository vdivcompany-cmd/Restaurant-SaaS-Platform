/**
 * MongoDB Replica Set Initialization Script
 *
 * Run this ONLY when you are ready to convert the standalone MongoDB instance
 * to a replica set (Phase 8 or when Change Streams are needed).
 *
 * For Phase 0–7, MongoDB runs as a standalone instance (no replica set).
 * This script is here so it is ready when needed — do NOT run it now.
 *
 * Usage (from mongo shell on the VPS):
 *   mongosh < infra/mongodb/replica-set-init.js
 *
 * Prerequisites:
 *   1. mongod started with --replSet rs0 in its config
 *   2. Run only once — re-running on an existing replica set will error
 */

// Initialize a single-node replica set named "rs0"
// Single-node is sufficient for Change Streams; add members in Phase 8 for failover.
rs.initiate({
  _id: 'rs0',
  members: [
    {
      _id: 0,
      host: 'localhost:27017',
      priority: 1,
    },
  ],
});

// Wait for the node to become primary
let status = rs.status();
let attempts = 0;
while (status.myState !== 1 && attempts < 30) {
  sleep(1000);
  status = rs.status();
  attempts++;
}

if (status.myState === 1) {
  print('✅ Replica set rs0 initialized — node is PRIMARY');
} else {
  print('❌ Replica set did not become primary after 30 seconds');
  print(JSON.stringify(status, null, 2));
}
