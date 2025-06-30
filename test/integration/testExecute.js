const assert = require('assert');
const async = require('async');
const connOption = require('./connectionOptions').valid;
const testUtil = require('./testUtil');
const os = require('os');
const globalConfig = require('../../lib/global_config');


describe('Execute test', function () {
  let connection;
  const createNodeTSQL = 'create or replace table NodeT(colA number, colB varchar)';
  const selectAllSQL = 'select * from NodeT';
  const insertNodeTSQL = 'insert into NodeT values(1, \'a\')';
  const updateNodeTSQL = 'update NodeT set COLA = 2, COLB = \'b\' where COLA = 1';
  const dropNodeTSQL = 'drop table if exists NodeT';

  before(function (done) {
    connection = testUtil.createConnection();
    async.series([
      function (callback) {
        testUtil.connect(connection, callback);
      }],
    done
    );
  });

  after(function (done) {
    async.series([
      function (callback) {
        testUtil.destroyConnection(connection, callback);
      }],
    done
    );
  });

  it('testSimpleInsert', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createNodeTSQL, callback);
        },
        function (callback) {
          const insertCount = 5;
          const insertValues = function (i) {
            if (i < insertCount) {
              testUtil.executeCmd(connection,
                insertNodeTSQL,
                function () {
                  insertValues(i + 1);
                });
            } else {
              callback();
            }
          };
          insertValues(0);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllSQL,
            [{ 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' }],
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            dropNodeTSQL,
            callback
          );
        }],
      done
    );
  });

  it('testSimpleUpdate', function (done) {
    async.series([
      function (callback) {
        testUtil.executeCmd(connection, createNodeTSQL, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, insertNodeTSQL, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, updateNodeTSQL, callback);
      },
      function (callback) {
        testUtil.executeQueryAndVerify(
          connection,
          selectAllSQL,
          [{ 'COLA': 2, 'COLB': 'b' }],
          callback
        );
      },
      function (callback) {
        testUtil.executeCmd(
          connection,
          dropNodeTSQL,
          callback
        );
      }],
    done
    );
  });

  it('testDDLResultSet', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            createNodeTSQL,
            [{ 'status': 'Table NODET successfully created.' }],
            callback
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            insertNodeTSQL,
            [{ 'number of rows inserted': 1 }],
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(connection, dropNodeTSQL, callback);
        }
      ],
      done
    );
  });

  describe('testDescribeOnly', async function () {
    const selectWithDescribeOnly = 'SELECT 1.0::NUMBER(30,2) as C1, 2::NUMBER(38,0) AS C2, \'t3\' AS C3, 4.2::DOUBLE AS C4, \'abcd\'::BINARY(8388608) AS C5, true AS C6';
    const expectedRows = [{ 'C1': 1, 'C2': 2, 'C3': 't3', 'C4': 4.2, 'C5': { 'type': 'Buffer', 'data': [171, 205] }, 'C6': true }];
    const testCases =
      [
        {
          name: 'describeOnly - true',
          describeOnly: true,
          expectedRows: []
        },
        {
          name: 'describeOnly - false',
          describeOnly: false,
          expectedRows: expectedRows
        },
        {
          name: 'describeOnly - undefined',
          describeOnly: undefined,
          expectedRows: expectedRows
        },
      ];

    const executeQueryAndVerifyResultDependOnDescribeOnly = async (describeOnly, expectedReturnedRows) => {
      return new Promise((resolve, reject) => {
        connection.execute({
          sqlText: selectWithDescribeOnly,
          describeOnly: describeOnly,
          complete: (err, stmt, rows) => {
            if (err) {
              return reject(err);
            }
            assert.strictEqual(stmt.getColumns().length, 6);
            assert.strictEqual(rows.length, expectedReturnedRows.length);
            if (rows.length > 0) {
              const columnsNamesInMetadata = stmt.getColumns().map(cl => cl.getName());
              const columnsNames = Object.keys(rows[0]);
              columnsNames.every((element, index) => assert.strictEqual(element, columnsNamesInMetadata[index]));
            }
            return resolve(rows);
          }
        });
      }
      );
    };

    testCases.forEach(testCase => it(testCase.name, () => executeQueryAndVerifyResultDependOnDescribeOnly(testCase.describeOnly, testCase.expectedRows)));
  });
});

describe('Execute test - variant', function () {
  this.timeout(100000);

  let connection;

  const DATABASE_NAME = connOption.database;
  const SCHEMA_NAME = connOption.schema;

  const TEST_VARIANT_TABLE = 'TEST_VARIANT_TABLE';
  const TEST_VARIANT_STAGE = 'TEST_VARIANT_STAGE';
  const TEST_VARIANT_FORMAT = 'TEST_VARIANT_FORMAT';
  const TEST_COL = 'COL';
  const TEST_HEADER = 'ROOT';

  const createTableVariant = `create or replace table ${TEST_VARIANT_TABLE}(${TEST_COL} variant)`;
  const truncateTableVariant = `truncate table ${TEST_VARIANT_TABLE}`;
  const createStageVariant = `CREATE OR REPLACE STAGE ${TEST_VARIANT_STAGE} FILE_FORMAT = ${TEST_VARIANT_FORMAT}`;
  const copyIntoVariant = `COPY INTO ${TEST_VARIANT_TABLE} FROM @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;
  const selectVariant = `select ${TEST_COL}
                         from ${TEST_VARIANT_TABLE}`;
  const dropStageVariant = `drop table if exists ${TEST_VARIANT_STAGE}`;
  const dropTableVariant = `drop table if exists ${TEST_VARIANT_TABLE}`;
  const createItCallback = function (testCase, rowAsserts) {
    return function (done) {
      globalConfig.createXmlColumnVariantParserWithParameters({
        ignoreAttributes: testCase.ignoreAttributes,
        attributeNamePrefix: testCase.attributeNamePrefix,
        attributesGroupName: testCase.attributesGroupName,
        alwaysCreateTextNode: testCase.alwaysCreateTextNode
      });

      const sampleTempFile = testUtil.createRandomFileName({ extension: testCase.fileExtension });
      const tempFilePath = testUtil.createTempFile(os.tmpdir(), sampleTempFile, testCase.sampleData);

      let putVariant = `PUT file://${tempFilePath} @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;

      // Windows user contains a '~' in the path which causes an error
      if (process.platform === 'win32') {
        putVariant = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${sampleTempFile} @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;
      }

      testUtil.executeCmdAsync(connection, putVariant)
        .then(() => testUtil.executeCmdAsync(connection, copyIntoVariant))
        .then(() => {
          connection.execute({
            sqlText: selectVariant,
            streamResult: true,
            complete: function (err, stmt) {
              try {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  done(err);
                });
                stream.on('data', function (row) {
                  // Check the column, header, and value is correct
                  rowAsserts(testCase, row);
                });
                stream.on('end', function () {
                  done();
                });
              } catch (e){
                done(e);
              } finally {
                testUtil.removeFileSyncIgnoringErrors(tempFilePath);
              }
            }
          });
        })
        .catch((err) => done(err));
    };
  };

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTableVariant);
  });

  after(async () => {
    await testUtil.executeCmdAsync(connection, dropTableVariant);
  });

  describe('Variant XML', function () {
    const TEST_ATTRIBUTE_NAME = 'attr';
    const TEST_ATTRIBUTE_VALUE = 'attrValue';
    const TEST_ATTRIBUTE_CUSTOM_PREFIX = '##';
    const ELEMENT_VALUE_FIELD = '#text';
    const TEST_XML_VAL = 123;

    before(async () => {
      const createFileFormatVariant = `CREATE OR REPLACE FILE FORMAT ${TEST_VARIANT_FORMAT} TYPE = XML`;
      await testUtil.executeCmdAsync(connection, createFileFormatVariant);
    });

    beforeEach(async () => {
      await testUtil.executeCmdAsync(connection, createStageVariant);
    });

    afterEach(async () => {
      await testUtil.executeCmdAsync(connection, truncateTableVariant);
      await testUtil.executeCmdAsync(connection, dropStageVariant);
    });

    const testCases =
      [
        {
          name: 'xml_single_element',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<${TEST_HEADER}>${TEST_XML_VAL}</${TEST_HEADER}>`,
          assertionCheck: (row) => assert.strictEqual(row[TEST_COL][TEST_HEADER], TEST_XML_VAL)
        },
        {
          name: 'xml_single_element_with_attribute',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<${TEST_HEADER} ${TEST_ATTRIBUTE_NAME}=${TEST_ATTRIBUTE_VALUE}>${TEST_XML_VAL}</${TEST_HEADER}>`,
          ignoreAttributes: false,
          assertionCheck: (row) => assert.strictEqual(row[TEST_COL][TEST_HEADER][ELEMENT_VALUE_FIELD], TEST_XML_VAL)
        },
        {
          name: 'xml_with_attribute_and_custom_parser',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<node><${TEST_HEADER} ${TEST_ATTRIBUTE_NAME}=${TEST_ATTRIBUTE_VALUE}>${TEST_XML_VAL}</${TEST_HEADER}></node>`,
          ignoreAttributes: false,
          attributeNamePrefix: TEST_ATTRIBUTE_CUSTOM_PREFIX,
          assertionCheck: (row) => {
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][ELEMENT_VALUE_FIELD], TEST_XML_VAL);
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][TEST_ATTRIBUTE_CUSTOM_PREFIX + TEST_ATTRIBUTE_NAME], TEST_ATTRIBUTE_VALUE);
          }
        },
        {
          name: 'xml_single_element_custom_parser_with_text_node',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<${TEST_HEADER}>${TEST_XML_VAL}</${TEST_HEADER}>`,
          alwaysCreateTextNode: true,
          assertionCheck: (row) => assert.strictEqual(row[TEST_COL][TEST_HEADER][ELEMENT_VALUE_FIELD], TEST_XML_VAL)
        },
        {
          name: 'xml_single_element_custom_parser_with_attributes_group',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<node><${TEST_HEADER} ${TEST_ATTRIBUTE_NAME}=${TEST_ATTRIBUTE_VALUE}>${TEST_XML_VAL}</${TEST_HEADER}></node>`,
          alwaysCreateTextNode: true,
          ignoreAttributes: false,
          attributeNamePrefix: TEST_ATTRIBUTE_CUSTOM_PREFIX,
          attributesGroupName: 'attributes',
          assertionCheck: (row) => {
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][ELEMENT_VALUE_FIELD], TEST_XML_VAL);
            assert.equal(row[TEST_COL]['node'][TEST_HEADER]['attributes'][TEST_ATTRIBUTE_CUSTOM_PREFIX + TEST_ATTRIBUTE_NAME], TEST_ATTRIBUTE_VALUE);
          }
        },
        {
          name: 'xml_with_group_attributes_group_without_prefixes',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<node><${TEST_HEADER} ${TEST_ATTRIBUTE_NAME}=${TEST_ATTRIBUTE_VALUE}>${TEST_XML_VAL}</${TEST_HEADER}></node>`,
          ignoreAttributes: false,
          attributeNamePrefix: '',
          attributesGroupName: '@_',
          assertionCheck: (row) => {
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][ELEMENT_VALUE_FIELD], TEST_XML_VAL);
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER]['@_'][TEST_ATTRIBUTE_NAME], TEST_ATTRIBUTE_VALUE);
          }
        },
        {
          name: 'xml_skip_attributes',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<node><${TEST_HEADER} ${TEST_ATTRIBUTE_NAME}=${TEST_ATTRIBUTE_VALUE}>${TEST_XML_VAL}</${TEST_HEADER}></node>`,
          attributeNamePrefix: TEST_ATTRIBUTE_CUSTOM_PREFIX,
          assertionCheck: (row) => {
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER], TEST_XML_VAL);
            assert.equal(row[TEST_COL]['node'][TEST_HEADER][TEST_ATTRIBUTE_CUSTOM_PREFIX + TEST_ATTRIBUTE_NAME], undefined);
          }
        },
        {
          name: 'xml_attribute_only',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<node><${TEST_HEADER} ${TEST_ATTRIBUTE_NAME}=${TEST_ATTRIBUTE_VALUE}></${TEST_HEADER}></node>`,
          ignoreAttributes: false,
          attributeNamePrefix: TEST_ATTRIBUTE_CUSTOM_PREFIX,
          assertionCheck: (row) => {
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][ELEMENT_VALUE_FIELD], undefined);
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][TEST_ATTRIBUTE_CUSTOM_PREFIX + TEST_ATTRIBUTE_NAME], TEST_ATTRIBUTE_VALUE);
          }
        },
        {
          name: 'xml_attribute_empty_value',
          type: 'XML',
          fileExtension: '.xml',
          sampleData: `<node><${TEST_HEADER} ${TEST_ATTRIBUTE_NAME}='attr1'/></node>`,
          ignoreAttributes: false,
          attributeNamePrefix: TEST_ATTRIBUTE_CUSTOM_PREFIX,
          assertionCheck: (row) => {
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][ELEMENT_VALUE_FIELD], undefined);
            assert.strictEqual(row[TEST_COL]['node'][TEST_HEADER][TEST_ATTRIBUTE_CUSTOM_PREFIX + TEST_ATTRIBUTE_NAME], 'attr1');
          }
        }
      ];

    const rowAsserts = (testCase, row) => {
      // Check the column, header, and value is correct
      testCase.assertionCheck(row);
    };

    testCases.forEach(testCase => it(testCase.name, createItCallback(testCase, rowAsserts)));
  });

  describe( 'Variant JSON', function () {
    const TEST_JSON_VAL = '<123>';

    before(async () => {
      const createFileFormatVariant = `CREATE OR REPLACE FILE FORMAT ${TEST_VARIANT_FORMAT} TYPE = JSON`;
      await testUtil.executeCmdAsync(connection, createFileFormatVariant);
    });
    //
    beforeEach(async () => {
      await testUtil.executeCmdAsync(connection, createStageVariant);

    });
    afterEach(async () => {
      await testUtil.executeCmdAsync(connection, truncateTableVariant);
      await testUtil.executeCmdAsync(connection, dropStageVariant);
    });

    const testCase = {
      name: 'raw_json',
      type: 'JSON',
      fileExtension: '.json',
      sampleData: `{${TEST_HEADER}: "${TEST_JSON_VAL}"}`,
      assertionCheck: (row) => assert.strictEqual(row[TEST_COL][TEST_HEADER], TEST_JSON_VAL)
    };

    const rowAsserts = (testCase, row) => {
      // Check the column, header, and value is correct
      testCase.assertionCheck(row);
    };

    it(testCase.name, createItCallback(testCase, rowAsserts));
  });

  describe( 'connection.execute() Resubmitting requests using requestId and different connections', function () {
    const createTable = 'create or replace table test_request_id(colA string)';
    let  firstConnection;
    let  secondConnection;
    before(async () => {
      firstConnection = testUtil.createConnection();
      secondConnection = testUtil.createConnection();
      await testUtil.connectAsync(firstConnection);
      await testUtil.connectAsync(secondConnection);
      await testUtil.executeCmdAsync(firstConnection, createTable);
    });

    beforeEach(async () => {
      await testUtil.executeCmdAsync(firstConnection, 'truncate table if exists test_request_id');
    });

    after(async () => {
      await testUtil.executeCmdAsync(firstConnection, 'drop table if exists test_request_id');
      await testUtil.destroyConnectionAsync(firstConnection);
      await testUtil.destroyConnectionAsync(secondConnection);
    });

    it('Do not INSERT twice when the same request id and connection', async () => {
      let result;
      result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'INSERT INTO test_request_id VALUES (\'testValue\');');
      const requestId = result.rowStatement.getRequestId();

      result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection,
        'INSERT INTO test_request_id VALUES (\'testValue\');', 
        { requestId: requestId });
      assert.strictEqual(result.rowStatement.getRequestId(), requestId);

      result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'SELECT * from test_request_id ;');
      assert.strictEqual(result.rows.length, 1);
    });

    it('Execute INSERT for the same request id and different connection', async () => {
      let result;
      result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'INSERT INTO test_request_id VALUES (\'testValue\');');
      const requestId = result.rowStatement.getRequestId();

      result = await testUtil.executeCmdAsyncWithAdditionalParameters(secondConnection, 'INSERT INTO test_request_id VALUES (\'testValue\');', { requestId: requestId });
      assert.strictEqual(result.rowStatement.getRequestId(), requestId);

      result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'SELECT * from test_request_id ;');
      assert.strictEqual(result.rows.length, 2);
    });

    it('Execute SELECT for the same request id and different data', async () => {
      await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'INSERT INTO test_request_id VALUES (\'testValue\');');
      let result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'SELECT * from test_request_id;');
      assert.strictEqual(result.rows.length, 1);
      const requestId = result.rowStatement.getRequestId();

      await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'INSERT INTO test_request_id VALUES (\'testValue\');');
      result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'SELECT * from test_request_id;', { requestId: requestId });
      assert.strictEqual(result.rows.length, 1);

      result = await testUtil.executeCmdAsyncWithAdditionalParameters(firstConnection, 'SELECT * from test_request_id ;');
      assert.strictEqual(result.rows.length, 2);
    });
  });



});
