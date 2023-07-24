/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const async = require('async');
const connOption = require('./connectionOptions').valid;
const testUtil = require('./testUtil');
const fs = require('fs');
const tmp = require('tmp');
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
            [{'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'}],
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
          [{'COLA': 2, 'COLB': 'b'}],
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
            [{'status': 'Table NODET successfully created.'}],
            callback
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            insertNodeTSQL,
            [{'number of rows inserted': 1}],
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

      const sampleTempFile = tmp.fileSync({postfix: testCase.fileExtension});
      fs.writeFileSync(sampleTempFile.name, testCase.sampleData);

      let putVariant = `PUT file://${sampleTempFile.name} @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;

      // Windows user contains a '~' in the path which causes an error
      if (process.platform === 'win32') {
        const fileName = sampleTempFile.name.substring(sampleTempFile.name.lastIndexOf('\\'));
        putVariant = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;
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
              } catch (e) {
                done(e);
              }
            }
          })
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

    testCases.forEach(testCase=> it(testCase.name, createItCallback(testCase, rowAsserts)));
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
});

