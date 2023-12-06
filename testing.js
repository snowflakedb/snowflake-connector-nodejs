const snowflake = require('snowflake-sdk');
const async = require('async');

snowflake.configure({
  logLevel:"trace",
});
// const CredentialManager = require('./lib/authentication/SecureStorage/credentialManager');
// const authenticationTypes = require('./lib/authentication/authentication');

// console.log(authenticationTypes);


async function run(){

  // await CredentialManager.writeCredential("kjilikl-nkb59809","JOHNTESTING","USERNAME_PASSWORD_MFA",'1234');
 
  const connection = snowflake.createConnection({
    // account: "kjilikl-nkb59809",
    // username: "JOHNTESTING",
    // password: 'Sunshine4u#',

    account: 'simbapartner',
    username: 'SEN',
    password: 'NewPwd4SEN!',
    database: 'LFTESTDB',
    schema: 'PUBLIC',
    warehouse: 'SIMBA_WH_TEST',
    // username: "mag-simbacloud@insightsoftware.com",
    // authenticator: "USERNAME_PASSWORD_MFA"
    // password: "Sunshine4u",
    // authenticator:"https://dev-90125362.okta.com/",
    // clientStoreTemporaryCredential: true
  });

  //   await connection.connectAsync(function (err, conn)
  //   {
  //     if(err){
  //       console.log(err.message);
  //     }else{
  //       console.log("Successfully connected");
  // }
  // });

  await connection.connectAsync(function (err, conn) {
    if (err) {
      console.log(err);
    } else {
      console.log('Successfully connected');
    }
  });

  // connection.execute({
  //   sqlText: "GET @LFTESTDB.PUBLIC.puttesting file://C:\\Users\\JYun\\Desktop\\snowflakegettest",
  //   complete: function (err, _, rows) {
  //     if(err) {
  //       console.log(err);
  //     }else {
  //       console.log(rows);
  //     }
  //   }

  // })

  connection.execute({
    sqlText: 'REMOVE @LFTESTDB.PUBLIC.puttesting',
    complete: function (err, _, rows) {
      if (err) {
        console.log(err);
      } else {
        connection.execute({
          sqlText: 'create or replace table LFTESTDB.PUBLIC.puttesting (COL1 STRING, COL2 STRING, COL3 STRING)',
          complete: function (err, _, rows) {
            if (err) {
              console.log(err);
            } else {
              console.log(rows);
              connection.execute({
                // sqlText: 'PUT file://C:\\Users\\JYun\\Desktop\\snowflaketest\\** @LFTESTDB.PUBLIC.puttesting',
                sqlText: 'PUT file://C:\\Users\\JYun\\Desktop\\snowflakezipfile\\** @LFTESTDB.PUBLIC.puttesting',
                complete: function (err, _, rows) {
                  if (err) {
                    console.log(err);
                  } else {
                    console.log(rows);
                    connection.execute({
                      sqlText: 'COPY INTO LFTESTDB.PUBLIC.puttesting',
                      complete: function (err, _, rows) {
                        if (err) {
                          console.log(err);
                        } else {
                          console.log(rows);

                          connection.execute({
                            sqlText: 'SELECT * FROM LFTESTDB.PUBLIC.puttesting',
                            complete: function (err, _, rows) {
                              if (err) {
                                console.log(err);
                              } else {
                                console.log(rows);

                                connection.execute({
                                  sqlText: 'GET @LFTESTDB.PUBLIC.puttesting file://C:\\Users\\JYun\\Desktop\\snowflakegettest',
                                  complete: function (err, _, rows) {
                                    if (err) {
                                      console.log(err);
                                    } else {

                                      console.log(rows);
                                    }
                                  }
                                });
                              }
                            }
                          });
                        }
                      }
                    });
                  }
                }
              });
            }
          }
        });
      }
    }
  });
    
   

  

      


  // if(err){
  //   console.log(err.message);
  // }else{
  //   connection.execute({
  //     // sqlText: "REMOVE @LFTESTDB.PUBLIC.puttesting",
  //       // sqlText: `PUT file://C:\\Users\\JYun\\Desktop\\snowflaketest\\** @LFTESTDB.PUBLIC.puttesting`,
  //       // sqlText: `GET @LFTESTDB.PUBLIC.puttesting file://C:\\Users\\JYun\\Desktop\\snowflakegettest`,
  //         // sqlText: `COPY INTO puttesting`,
  //       //  sqlText: `SELECT * FROM LFTESTDB.PUBLIC.puttesting`,


//       // sqlText: `create or replace table LFTESTDB.PUBLIC.puttesting ("col1" STRING, "col2" STRING, "col3" STRING )`,
//       complete: function (err,_,rows)
//       {
//        if(err) {
//         console.log(err);
//        }else{
//         console.log(rows);
//         // try {
//         //   fileSize = row['targetSize'];
//         //   // Check the file is correctly uploaded
//         //   console.log(row['status']);
//         //   // Check the target encoding is correct
//         //   console.log(row['targetCompression']);
//         // } catch (e) {
//         //   console.log(e);
//         // }
//       }
//     }
// });
}

run();