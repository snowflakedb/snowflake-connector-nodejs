const connOption = require("../integration/connectionOptions");
const snowflake = require('snowflake-sdk');
const assert = require('assert');
const testUtil = require("../integration/testUtil");

snowflake.configure({logLevel:"TRACE"});

describe.only("test and log how many result.js called for each execution",function (){
     let connection = snowflake.createConnection(connOption.valid);
      connection.connect(
        function (err, conn)
        {
          if (err)
          {
            console.error('Unable to connect: ' + err.message);
          }
          else
          {
            console.log('Successfully connected to Snowflake');
          }
        }
      )
    
    it('Run Select 1 query', function (done)
    {
      connection.execute({
        sqlText: "select 1",
        complete: function (err, stmt)
        {
          if(err){
            console.log(err.message);
          }else{
            done();
          }
        }
      });
    });
})
  