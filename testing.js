const snowflake = require('snowflake-sdk');
// snowflake.configure({logLevel:"TRACE"});


var connection = snowflake.createConnection({
    account: "simbapartner",
    username: "SEN",
    password: "NewPwd4SEN!",
    database: "LFTESTDB",
    schema: "PUBLIC",
    warehouse: "SIMBA_WH_TEST",
    // authenticator:"EXTERNALBROWSER"
  });

  connection.connect(function (err, conn)
  {
    if(err){
      console.log(err.message);
    }else{
      console.log('Success');

    }
    // Handle any errors.
  })
    
  connection.execute({
    sqlText: "select 1",
    streamResult: true,
    complete: function (err, stmt)
    {
      var stream = stmt.streamRows();
      // Read data from the stream when it is available
      stream.on('readable', function (row)
      {
        while ((row = this.read()) !== null)
        {
          console.log(row);
        }
      }).on('end', function ()
      {
        console.log('done');
      }).on('error', function (err)
      {
        console.log(err);
      });
    }
  });