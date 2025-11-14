#!/usr/bin/env node

/**
 * IPv6 Connectivity Test for Snowflake Node.js Connector
 * Tests: SELECT 1, SELECT pi(), PUT operation, GET operation
 */

const snowflake = require('./dist/index');
const dns = require('dns').promises;
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PARAMETERS_FILE = path.join(__dirname, 'parameters.json');

// Logger
class Logger {
  constructor(level = 'INFO') {
    this.levels = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3 };
    this.level = this.levels[level] || this.levels.INFO;
  }

  log(level, message, ...args) {
    if (this.levels[level] >= this.level) {
      const timestamp = new Date().toISOString();
      const formattedMsg = typeof message === 'string' ? message : JSON.stringify(message);
      console.log(`${timestamp} - ${level} - ${formattedMsg}`, ...args);
    }
  }

  debug(message, ...args) { this.log('DEBUG', message, ...args); }
  info(message, ...args) { this.log('INFO', message, ...args); }
  warning(message, ...args) { this.log('WARNING', message, ...args); }
  error(message, ...args) { this.log('ERROR', message, ...args); }
}

const logger = new Logger('DEBUG');

// Load configuration from parameters.json
async function loadConfig() {
  try {
    const parametersData = await fsPromises.readFile(PARAMETERS_FILE, 'utf8');
    const parameters = JSON.parse(parametersData);
    const testParams = parameters.testconnection || parameters;
    
    const config = {
      account: testParams.SNOWFLAKE_TEST_ACCOUNT,
      username: testParams.SNOWFLAKE_TEST_USER,
      warehouse: testParams.SNOWFLAKE_TEST_WAREHOUSE,
      database: testParams.SNOWFLAKE_TEST_DATABASE,
      schema: testParams.SNOWFLAKE_TEST_SCHEMA,
      host: testParams.SNOWFLAKE_TEST_HOST,
      protocol: testParams.SNOWFLAKE_TEST_PROTOCOL || 'https',
      role: testParams.SNOWFLAKE_TEST_ROLE,
    };
    
    if (testParams.SNOWFLAKE_TEST_PASSWORD) {
      config.password = testParams.SNOWFLAKE_TEST_PASSWORD;
    } else if (testParams.SNOWFLAKE_TEST_PRIVATE_KEY_FILE) {
      logger.info(`Loading private key from: ${testParams.SNOWFLAKE_TEST_PRIVATE_KEY_FILE}`);
      const keyPath = path.resolve(testParams.SNOWFLAKE_TEST_PRIVATE_KEY_FILE);
      config.privateKey = await fsPromises.readFile(keyPath, 'utf8');
      config.authenticator = 'SNOWFLAKE_JWT';
      if (testParams.SNOWFLAKE_TEST_PRIVATE_KEY_PASS) {
        config.privateKeyPass = testParams.SNOWFLAKE_TEST_PRIVATE_KEY_PASS;
      }
    } else {
      throw new Error('No authentication method specified (password or private key)');
    }
    
    const required = ['account', 'username', 'warehouse', 'database', 'schema'];
    for (const field of required) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }
    
    return config;
  } catch (err) {
    logger.error(`Failed to load config from ${PARAMETERS_FILE}: ${err.message}`);
    throw err;
  }
}

// Generate random file
async function generateRandomFile(filePath, sizeKB = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789\n';
  let content = '';
  for (let i = 0; i < sizeKB * 1024; i++) {
    content += chars[Math.floor(Math.random() * chars.length)];
  }
  await fsPromises.writeFile(filePath, content);
  logger.info(`Generated random file: ${filePath} (${sizeKB} KB)`);
  return filePath;
}

// Check DNS resolution (respects /etc/hosts like Python's socket.getaddrinfo)
async function checkDnsResolution(hostname) {
  logger.info('=' .repeat(60));
  logger.info('DNS Resolution Check (using OS resolver - respects /etc/hosts)');
  logger.info('=' .repeat(60));
  logger.info(`Checking DNS resolution for: ${hostname}`);
  
  const ipv4Addresses = [];
  const ipv6Addresses = [];
  
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    
    addresses.forEach(addr => {
      if (addr.family === 4) {
        ipv4Addresses.push(addr.address);
        logger.info(`  IPv4: ${addr.address}`);
      } else if (addr.family === 6) {
        ipv6Addresses.push(addr.address);
        logger.info(`  IPv6: ${addr.address}`);
      }
    });
    
    logger.info(`Summary: Found ${ipv4Addresses.length} IPv4 address(es) and ${ipv6Addresses.length} IPv6 address(es)`);
    
    if (ipv6Addresses.length > 0) {
      logger.info(`IPv6 addresses: ${ipv6Addresses.slice(0, 3).join(', ')}`);
    } else {
      logger.warning('WARNING: No IPv6 addresses found!');
    }
    
    if (ipv4Addresses.length > 0) {
      logger.info(`IPv4 addresses: ${ipv4Addresses.slice(0, 3).join(', ')}`);
      if (ipv4Addresses.includes('127.0.0.1')) {
        logger.info('  ✓ Found 127.0.0.1 - /etc/hosts override is active!');
      }
    } else {
      logger.warning('WARNING: No IPv4 addresses found!');
    }
  } catch (err) {
    logger.warning(`Could not resolve addresses: ${err.message}`);
  }
  
  logger.info('=' .repeat(60));
  
  return { ipv4Addresses, ipv6Addresses };
}

// Check active network connections
async function checkActiveConnections(hostname) {
  logger.info('Checking active connections...');
  
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-i', '-P', '-n']);
    let output = '';
    
    lsof.stdout.on('data', (data) => output += data.toString());
    
    lsof.on('close', (code) => {
      if (code === 0) {
        const lines = output.split('\n');
        const matchingLines = lines.filter(line => 
          line.includes(hostname) || line.includes('snowflakecomputing') || 
          line.includes('2600:') || line.includes('->16.') || 
          line.includes('->100.') || line.includes('->50.')
        );
        
        if (matchingLines.length > 0) {
          logger.info('Active connections:');
          matchingLines.forEach(line => {
            logger.info(line);
            if (line.includes('2600:')) {
              logger.info('  ✓ USING IPv6 CONNECTION!');
            } else if (line.includes('->')) {
              logger.warning('  ⚠ Using IPv4 connection');
            }
          });
        } else {
          logger.info('No connections found (may need sudo)');
          logger.info('Run manually: sudo lsof -i -P -n | grep -E "snowflake|2600:"');
        }
        resolve(matchingLines);
      } else {
        logger.warning('lsof command failed (may need sudo)');
        resolve([]);
      }
    });
    
    lsof.on('error', (err) => {
      logger.warning(`lsof not available: ${err.message}`);
      resolve([]);
    });
  });
}

// Execute SQL query
function executeQuery(connection, sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sqlText,
      complete: (err, stmt, rows) => err ? reject(err) : resolve({ stmt, rows })
    });
  });
}

// Execute SQL with streaming results
function executeQueryStream(connection, sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sqlText,
      complete: (err, stmt) => {
        if (err) {
          reject(err);
        } else {
          const rows = [];
          const stream = stmt.streamRows();
          stream.on('error', reject);
          stream.on('data', (row) => rows.push(row));
          stream.on('end', () => resolve({ stmt, rows }));
        }
      }
    });
  });
}

// Connect to Snowflake
function connectAsync(connection) {
  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => err ? reject(err) : resolve(conn));
  });
}

// Destroy connection
function destroyAsync(connection) {
  return new Promise((resolve, reject) => {
    connection.destroy((err) => err ? reject(err) : resolve());
  });
}

// Main test function
async function testIPv6Connectivity() {
  logger.info('=' .repeat(60));
  logger.info('Starting IPv6 Connectivity Test');
  logger.info('=' .repeat(60));
  
  let connection = null;
  let tmpDir = null;
  
  try {
    const config = await loadConfig();
    logger.info(`Configuration loaded for account: ${config.account}`);
    
    const hostname = config.host || `${config.account}.snowflakecomputing.com`;
    
    await checkDnsResolution(hostname);
    
    logger.info('Creating Snowflake connection...');
    connection = snowflake.createConnection(config);
    
    logger.info('Connecting to Snowflake...');
    await connectAsync(connection);
    logger.info('Connected to Snowflake successfully');
    logger.info(`Account: ${config.account}, User: ${config.username}, Host: ${hostname}`);
    
    await checkActiveConnections(hostname);
    
    if (config.warehouse) {
      logger.info(`Using warehouse: ${config.warehouse}`);
      await executeQuery(connection, `USE WAREHOUSE ${config.warehouse}`);
    }
    
    if (config.database) {
      logger.info(`Using database: ${config.database}`);
      await executeQuery(connection, `USE DATABASE ${config.database}`);
    }
    
    if (config.schema) {
      logger.info(`Using schema: ${config.schema}`);
      await executeQuery(connection, `USE SCHEMA ${config.schema}`);
    }
    
    // Test 1: SELECT 1
    logger.info('=' .repeat(60));
    logger.info('Test 1: SELECT 1');
    logger.info('=' .repeat(60));
    const result1 = await executeQuery(connection, 'SELECT 1');
    const value1 = result1.rows[0]['1'];
    logger.info(`Result: ${value1}`);
    if (value1 !== 1) throw new Error(`Expected 1, got ${value1}`);
    logger.info('✓ Test 1 PASSED');
    
    // Test 2: SELECT pi()
    logger.info('=' .repeat(60));
    logger.info('Test 2: SELECT pi()');
    logger.info('=' .repeat(60));
    const result2 = await executeQuery(connection, 'SELECT pi()');
    const piValue = result2.rows[0]['PI()'];
    logger.info(`Result: ${piValue}`);
    const expectedPi = 3.141592653589793;
    if (Math.abs(piValue - expectedPi) > 0.000001) {
      throw new Error(`Expected pi (${expectedPi}), got ${piValue}`);
    }
    logger.info('✓ Test 2 PASSED');
    
    // Test 3 & 4: PUT and GET
    logger.info('=' .repeat(60));
    logger.info('Test 3 & 4: PUT and GET operations');
    logger.info('=' .repeat(60));
    
    tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'ipv6-test-'));
    logger.info(`Created temporary directory: ${tmpDir}`);
    
    const testFileName = 'test_ipv6_file.txt';
    const testFilePath = path.join(tmpDir, testFileName);
    await generateRandomFile(testFilePath, 5);
    
    const fileStats = await fsPromises.stat(testFilePath);
    logger.info(`Test file size: ${fileStats.size} bytes`);
    
    const stageName = '~';
    logger.info(`Using user stage: ${stageName}`);
    
    // PUT file
    const putSql = `PUT file://${testFilePath} @${stageName}`;
    logger.info(`Executing PUT: ${putSql}`);
    const putResult = await executeQueryStream(connection, putSql);
    logger.info('PUT result:', putResult.rows);
    
    if (!putResult.rows || putResult.rows.length === 0) {
      throw new Error('PUT should return results');
    }
    
    const putStatus = putResult.rows[0].status;
    logger.info(`PUT status: ${putStatus}`);
    if (putStatus !== 'UPLOADED' && putStatus !== 'SKIPPED') {
      throw new Error(`File should be uploaded, got status: ${putStatus}`);
    }
    logger.info('✓ Test 3 (PUT) PASSED');
    
    // List files
    logger.info(`Listing files in stage: ${stageName}`);
    const listResult = await executeQuery(connection, `LIST @${stageName}`);
    logger.info('Files in stage:', listResult.rows.map(r => r.name));
    
    const uploadedFile = listResult.rows.find(r => r.name.includes(testFileName));
    if (!uploadedFile) throw new Error('Uploaded file not found in stage');
    logger.info(`Found uploaded file: ${uploadedFile.name}`);
    
    // GET file
    const downloadDir = path.join(tmpDir, 'download');
    await fsPromises.mkdir(downloadDir, { recursive: true });
    
    const getSql = `GET @${stageName}/${testFileName}.gz file://${downloadDir}/`;
    logger.info(`Executing GET: ${getSql}`);
    const getResult = await executeQueryStream(connection, getSql);
    logger.info('GET result:', getResult.rows);
    
    const downloadedFiles = await fsPromises.readdir(downloadDir);
    const gzFiles = downloadedFiles.filter(f => f.endsWith('.gz'));
    logger.info(`Downloaded files: ${gzFiles.join(', ')}`);
    
    if (gzFiles.length === 0) throw new Error('File should be downloaded');
    
    const downloadedFilePath = path.join(downloadDir, gzFiles[0]);
    const downloadedStats = await fsPromises.stat(downloadedFilePath);
    logger.info(`Downloaded file size: ${downloadedStats.size} bytes`);
    
    if (downloadedStats.size === 0) throw new Error('Downloaded file should not be empty');
    logger.info('✓ Test 4 (GET) PASSED');
    
    // Cleanup stage
    logger.info('Cleaning up: removing file from stage');
    await executeQuery(connection, `REMOVE @${stageName}/${testFileName}.gz`);
    
    logger.info('=' .repeat(60));
    logger.info('✓ ALL TESTS PASSED - IPv6 Connectivity Test Completed Successfully');
    logger.info('=' .repeat(60));
    
  } catch (err) {
    logger.error('=' .repeat(60));
    logger.error('✗ TEST FAILED');
    logger.error('=' .repeat(60));
    logger.error(`Error: ${err.message}`);
    if (err.stack) logger.debug(err.stack);
    process.exit(1);
    
  } finally {
    if (connection) {
      try {
        await destroyAsync(connection);
        logger.info('Connection closed');
      } catch (err) {
        logger.warning(`Error closing connection: ${err.message}`);
      }
    }
    
    if (tmpDir) {
      try {
        await fsPromises.rm(tmpDir, { recursive: true, force: true });
        logger.info('Temporary directory cleaned up');
      } catch (err) {
        logger.warning(`Error cleaning up temp directory: ${err.message}`);
      }
    }
  }
}

// Entry point
if (require.main === module) {
  testIPv6Connectivity().catch(err => {
    logger.error('Unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { testIPv6Connectivity };
