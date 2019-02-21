var async = require('async');
var testUtil = require('./testUtil');

describe('Test Cancel Query', function()
{
  var connection;
  var createTestDB = 'create or replace database NodeTestDB';
  var createTestSch = 'create or replace schema NodeTestSchema';
  var createUser = 'create or replace user userCancel password=\'1234\'';
  var longQuery = 'select count(*) from table(generator(timeLimit => 3600))';
  var dropTestDB = 'drop database if exists NodeTestDB';
  var dropUser = 'drop User if exists userCancel';

  before(function(done)
  {
    connection = testUtil.createConnection();
    async.series([
        function(callback)
        {
          testUtil.connect(connection, callback);
        },
        function(callback)
        {
          testUtil.executeCmd(connection, createTestDB, callback);
        },
        function(callback)
        {
          testUtil.executeCmd(connection, createTestSch, callback);
        },
        function(callback)
        {
          testUtil.executeCmd(connection, createUser, callback);
        }
      ],
      done
    );
  });
  
  after(function(done)
  {
    async.series(
      [
        function(callback)
        {
          testUtil.executeCmd(connection, dropTestDB, callback);
        },
        function(callback)
        {
          testUtil.executeCmd(connection, dropUser, callback);
        },
        function(callback)
        {
          testUtil.destroyConnection(connection, callback);
        }
      ],
      done
    );
  });
  
  it('testCancelQuerySimple', function(done)
  {
    var statement = connection.execute({
      sqlText: longQuery 
    });
    
    setTimeout(function()
    {
      statement.cancel(function(err)
      {
        testUtil.checkError(err);
        done();
      });
    }, 3000);
  });
});




















