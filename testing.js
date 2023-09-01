const snowflake = require('snowflake-sdk');
snowflake.configure({logLevel:"TRACE"});

const connection = snowflake.createConnection({
  account: 'simbapartner',
  username: 'SEN',
  password: 'NewPwd4SEN!',
  // database: 'SNOWFLAKE_SAMPLE_DATA',
  database: 'TESTDB',
  SCHEMA: 'WEATHER',
  warehouse: 'SIMBA_WH_TEST',
  queryContextCacheSize:3
});

let connection_ID;
connection.connect(function (err, conn) {
  if (err) {
    console.error('Unable to connect: ' + err.message);
  } else {
    console.log('Successfully connected to Snowflake.');
    // Optional: store the connection ID.
    connection_ID = conn.getId();
  }
});

connection.execute({
  // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
  sqlText: 'ALTER SESSION SET multi_statement_count=4',
  complete: function (err, stmt, rows) {
    if (err) {
      console.error(
        '1 Failed to execute statement due to the following error: ' +
          err.message
      );
    } else {
      // console.log(stmt.getColumns()[1].getName());
      console.log(stmt.getStatementId(), '2');
    }
  },
});
// connection.execute({
//   // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
//   sqlText: 'alter session set enable_key_value_table=true',
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//           err.message
//       );
//     } else {
//       // console.log(stmt.getColumns()[1].getName());
//       console.log(stmt.getStatementId(), '2');
//     }
//   },
// });

// connection.execute({
//   // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
//   sqlText: 'alter session set ENABLE_CROSS_DATABASE_QUERY=true',
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//           err.message
//       );
//     } else {
//       // console.log(stmt.getColumns()[1].getName());
//       console.log(stmt.getStatementId(), '2');
//     }
//   },
// });connection.execute({
//   // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
//   sqlText: 'alter session set xp_exchange_read_ts_with_gs_enabled=true',
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//           err.message
//       );
//     } else {
//       // console.log(stmt.getColumns()[1].getName());
//       console.log(stmt.getStatementId(), '2');
//     }
//   },
// });connection.execute({
//   // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
//   sqlText: 'alter session set kv_write_parallelism_enabled=true, hybrid_table_scan_v2_enabled=true, kv_compaction_compact_table_enabled=true',
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//           err.message
//       );
//     } else {
//       // console.log(stmt.getColumns()[1].getName());
//       console.log(stmt.getStatementId(), '2');
//     }
//   },
// });connection.execute({
//   // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
//   sqlText: "alter session set local_dop=1, server_count=1, enable_dop_downgrade=false, kv_snowtram_fast_path_enabled=true, bypass_auth_check_sensitive_meta_funcs=true",
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//           err.message
//       );
//     } else {
//       // console.log(stmt.getColumns()[1].getName());
//       console.log(stmt.getStatementId(), '2');
//     }
//   },
// });connection.execute({
//   // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
//   sqlText: 'alter session set KV_SNOWTRAM_FDB_GRV_CACHE_ENABLED=true',
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//           err.message
//       );
//     } else {
//       // console.log(stmt.getColumns()[1].getName());
//       console.log(stmt.getStatementId(), '2');
//     }
//   },
// });

// connection.execute({
//   // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
//   sqlText: 'alter session set hcll_xs=false',
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//           err.message
//       );
//     } else {
//       // console.log(stmt.getColumns()[1].getName());
//       console.log(stmt.getStatementId(), '2');
//     }
//   },
// });

