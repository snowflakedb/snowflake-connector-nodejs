const async = require('async');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const testUtil = require('./testUtil');
const connOption = require('./connectionOptions');
const { randomizeName } = require('./testUtil');

const DATABASE_NAME = connOption.valid.database;
const SCHEMA_NAME = connOption.valid.schema;
const WAREHOUSE_NAME = connOption.valid.warehouse;
const TABLE = randomizeName('TESTTBL');

let connection;
const files = new Array();

function uploadFiles(callback, index = 0) {
  if (index < files.length) {
    const putQuery = `PUT file://${files[index]} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TABLE}`;
    connection.execute({
      sqlText: putQuery,
      complete: function (err) {
        testUtil.checkError(err);
        if (!err) {
          index++;
          if (index < files.length) {
            uploadFiles(callback, index);
          } else {
            callback();
          }
        }
      }
    });
  }
}

describe('Test Put Small Files', function () {
  this.timeout(100000);
  const useWH = `use warehouse ${WAREHOUSE_NAME}`;
  const createTable = `create or replace table ${DATABASE_NAME}.${SCHEMA_NAME}.${TABLE}(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  const copytInto = `copy into ${DATABASE_NAME}.${SCHEMA_NAME}.${TABLE}`;
  const select1row = `select * from ${DATABASE_NAME}.${SCHEMA_NAME}.${TABLE} where colB = 3`;
  const selectAll = `select count(*) AS NUM from ${DATABASE_NAME}.${SCHEMA_NAME}.${TABLE}`;
  const count = 5000;

  before(function (done) {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function () {
      connection.execute({
        sqlText: useWH,
        complete: function (err) {
          testUtil.checkError(err);
          
          done();
        }
      });
    });
  });

  after(function (done) {
    testUtil.destroyConnection(connection, done);
  });

  it('testPutSmallFiles', function (done) {
    async.series(
      [
        function (callback) {
          connection.execute({
            sqlText: createTable,
            complete: function (err) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function (callback) {
          const arrBind = [];
          const filesize = 1024 * 100;
          
          for (let i = 0; i < count; i++) {
            arrBind.push(['string' + i, i, '2020-05-11', '12:35:41.3333333', '2022-04-01 23:59:59', '2022-07-08 12:05:30.9999999']);
          }
          
          let fileCount = 0;
          let strbuffer = '';
          
          let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp'));
          if (tmpDir.indexOf('~') !== -1 && process.platform === 'win32') {
            const tmpFolderName = tmpDir.substring(tmpDir.lastIndexOf('\\'));
            tmpDir = process.env.USERPROFILE + '\\AppData\\Local\\Temp\\' + tmpFolderName;
          }
          for (let i = 0; i < arrBind.length; i++) {
            for (let j = 0; j < arrBind[i].length; j++) {
              if (j > 0) {
                strbuffer += ','; 
              }
              strbuffer += arrBind[i][j];
            }
            strbuffer += '\n';

            if ((strbuffer.length >= filesize) || (i === arrBind.length - 1)) {
              const fileName = path.join(tmpDir, (++fileCount).toString());
              fs.writeFileSync(fileName, strbuffer);
              files.push(fileName);
              strbuffer = '';
            }
          }
          const callbackfunc = function () {
            for (const fileName in files) {
              if (fs.existsSync(fileName)) {
                fs.unlinkSync(fileName);
              }
            }
            callback();
          };
          uploadFiles(callbackfunc, 0);
        },
        function copy(callback) {
          connection.execute({
            sqlText: copytInto,
            complete: function (err) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function select(callback) {
          connection.execute({
            sqlText: select1row,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              assert.strictEqual(rows[0]['COLA'], 'string3');
              const dateValue = new Date(rows[0]['COLC']).getTime();
              const timeValue = new Date(rows[0]['COLE']).getTime();
              assert.strictEqual(dateValue.toString(), '1589155200000');
              assert.strictEqual(timeValue.toString(), '1648857599000');
              callback();
            }
          });
        },
        function selectall(callback) {
          connection.execute({
            sqlText: selectAll,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              assert.strictEqual(rows[0]['NUM'], count);
              callback();
            }
          });
        },
      ],
      done
    );
  });
});
