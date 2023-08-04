/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const ResultTestCommon = require('./result_test_common');
const RowMode = require('./../../../../lib/constants/row_mode');
const ColumnNamesCreator = require('../../../../lib/connection/result/unique_column_name_creator');
const {addoverriddenNamesForDuplicatedColumns} = require('../../../../lib/connection/result/unique_column_name_creator');

describe('Unique column names', function () {
  describe('result contains renamed columns depend on row mode', function () {

    const columnNames = ['KEY', 'FOO', 'KEY_1', 'FOO', 'KEY_3', 'FOO_3', 'KEY', 'FOO', 'KEY', 'FOO'];
    const testCases = [
      {
        title: 'should return renamed columns for duplicates if ro mode object_with_renamed_duplicated_columns',
        rowMode: RowMode.OBJECT_WITH_RENAMED_DUPLICATED_COLUMNS,
        expectedColumnNames: [
          'KEY',
          'FOO',
          'KEY_1',
          'FOO_2',
          'KEY_3',
          'FOO_3',
          'KEY_2',
          'FOO_4',
          'KEY_4',
          'FOO_5'
        ]
      },
      {
        title: 'should not rename if row mode object',
        rowMode: RowMode.OBJECT,
        expectedColumnNames: columnNames
      },
      {
        title: 'should not rename if row mode array',
        rowMode: RowMode.ARRAY,
        expectedColumnNames: columnNames
      }
    ];
    const responseWithColumns = (columnRowSet) => {
      return {
        'data': {
          'parameters': [],
          'rowtype': columnRowSet,
          'rowset': [[]],
          'total': 1,
          'returned': 1
        },
      };
    };

    testCases.forEach(({title, rowMode, expectedColumnNames}) => {
      it(title, function (done) {
        const response = responseWithColumns(columnNames.map(columnName => {
          return {'name': columnName};
        }));
        const resultOptions = ResultTestCommon.createResultOptions(response);
        resultOptions['rowMode'] = rowMode;

        ResultTestCommon.testResult(
          resultOptions,
          function each() {
          },
          function end(result) {
            const columnNames = result.getColumns().map(col => col.getName());
            assert.deepStrictEqual(columnNames, expectedColumnNames);
            done();
          }
        );
      });
    });
  });

  describe('create unique names for duplicated column names', function () {

    const testCases = [
      {
        name: 'without overridden',
        columns: [{name: 'COL1'}, {name: 'COL2'}],
        expected: [{name: 'COL1'}, {name: 'COL2'}]
      },
      {
        name: 'single overridden column',
        columns: [{name: 'COL1'}, {name: 'COL1'}],
        expected: [{name: 'COL1'}, {name: 'COL1', overriddenName: 'COL1_2'}]
      },
      {
        name: 'works with empty column list',
        columns: [],
        expected: []
      },
      {
        name: 'create unique suffixes if column name exists',
        columns: [{name: 'COL1'}, {name: 'COL1'}, {name: 'COL1_2'}],
        expected: [{name: 'COL1'}, {name: 'COL1', overriddenName: 'COL1_3'}, {name: 'COL1_2'}]
      },
      {
        name: 'create unique suffixes for multiple columns',
        columns: [{name: 'COL1'}, {name: 'COL1'}, {name: 'COL2'}, {name: 'COL2'}, {name: 'COL2'}, {name: 'COL3'}, {name: 'COL3'}],
        expected: [{name: 'COL1'}, {name: 'COL1', overriddenName: 'COL1_2'}, {name: 'COL2'}, {
          name: 'COL2',
          overriddenName: 'COL2_2'
        }, {name: 'COL2', overriddenName: 'COL2_3'}, {name: 'COL3'}, {name: 'COL3', overriddenName: 'COL3_2'}]
      },
      {
        name: 'create unique suffixes for multiple columns despite of numeric suffixes',
        columns: [{name: 'COL1'}, {name: 'COL1_2'}, {name: 'COL1_2'}, {name: 'COL1'}],
        expected: [{name: 'COL1'}, {name: 'COL1_2'}, {name: 'COL1_2', overriddenName: 'COL1_2_2'}, {
          name: 'COL1',
          overriddenName: 'COL1_3'
        }]
      },
      {
        name: 'not changed if empty names',
        columns: [{name: ''}, {name: ''}],
        expected: [{name: ''}, {name: ''}]
      },
      {
        name: 'not changed if undefined names',
        columns: [{name: undefined}, {name: undefined}],
        expected: [{name: undefined}, {name: undefined}]
      },
      {
        name: 'not changed if nulls as names',
        columns: [{name: null}, {name: null}],
        expected: [{name: null}, {name: null}]
      }
    ];

    testCases.forEach(({name, columns, expected}) => {
      it(name, function () {
        ColumnNamesCreator.addOverridenNamesForDuplicatedColumns(columns);
        assert.deepStrictEqual(columns, expected);
      });
    });
  });
});