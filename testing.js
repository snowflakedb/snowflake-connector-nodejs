const snowflake = require('snowflake-sdk');
snowflake.configure({logLevel: "TRACE"})

   // function createQueryTest () {
  //   const testingSet = [];
  //   for(let i = 0; i < querySet.length; i++) {
  //       const {sqlTexts,QccSize} = querySet[i];
  //      const firstExecution = function(callback) {
  //       connection.execute({
  //         sqlText: sqlTexts[0],
  //         complete: function () {
  //          callback()
  //         }
  //       });
  //     }
  //     const secondExecution = function(callback) {
  //       connection.execute({
  //         sqlText: sqlTexts[1],
  //         complete: function () {
  //          callback()
  //         }
  //       });
  //     }
  //     const thirdExecution = function(callback) {
  //       connection.execute({
  //         sqlText: sqlTexts[2],
  //         complete: function (err, stmt) {
  //           assert.ok(!err,'There should be no error!');
  //           assert.strictEqual(stmt.getQueryContextCacheSize(), QccSize);
  //           assert.strictEqual(stmt.getQueryContextDTOSize(), QccSize);
  //           callback(); 
  //         }
  //       });
  //     }
  //     testingSet.push(firstExecution);
  //     testingSet.push(secondExecution);
  //     testingSet.push(thirdExecution);


  //   }
  //   return testingSet;
  // }

  // var streamResult = true;
  // console.log('streamResult: ' + streamResult);

const connection = snowflake.createConnection({
  account: 'simbapartner',
  username: 'SEN',
  password: 'NewPwd4SEN!',
  database: 'LFTESTDB',
  SCHEMA: 'WEATHER',
  warehouse: 'SIMBA_WH_TEST',
});

connection.connect((err)=>{
  if(err){
    throw err;
  }else{
    console.log('Successfully connected');
  }
});

// connection.execute({
//   sqlText: 'SELECT 1',
  
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//               err.message
//       );
//     } else {
//       console.log("Done");
//     }
//   }
// })

// connection.execute({
//   sqlText: 'create or replace database db1',
  
//   complete: function (err, stmt, rows) {
//     if (err) {
//       console.error(
//         '1 Failed to execute statement due to the following error: ' +
//               err.message
//       );
//     } else {
//       connection.execute({
//         sqlText: 'create or replace hybrid table t1 (a int primary key, b int)',
        
//         complete: function (err, stmt, rows) {
//           if (err) {
//             console.error(
//               '1 Failed to execute statement due to the following error: ' +
//                     err.message
//             );
//           } else {
//             connection.execute({
//               sqlText: 'insert into t1 values (1, 2), (2, 3), (3, 4)',
              
//               complete: function (err, stmt, rows) {
//                 if (err) {
//                   console.error(
//                     '1 Failed to execute statement due to the following error: ' +
//                           err.message
//                   );
//                 } else {
//                   connection.execute({
//                     sqlText: 'SELECT * from t1',
                    
//                     complete: function (err, stmt, rows) {
//                       if (err) {
//                         console.error(
//                           '1 Failed to execute statement due to the following error: ' +
//                                 err.message
//                         );
//                       } else {
//                         console.log("Done");   
//                       }
//                     }
//                   })      
//                 }
//               }
//             })      
//           }
//         }
//       })      
//     }
//   }
// })


connection.execute({
  sqlText: 'create or replace database db1',
  
  complete: function (err, stmt, rows) {
    if (err) {
      console.error(
        '1 Failed to execute statement due to the following error: ' +
              err.message
      );
    } else {
      connection.execute({
        // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
        sqlText: 'create or replace hybrid table t1 (a int primary key, b int)',
        

        complete: function (err, stmt, rows) {
          if (err) {
            console.error(
              '1 Failed to execute statement due to the following error: ' +
                    err.message
            );
          } else {
            connection.execute({
              // sqlText: 'CREATE TABLE PUBLIC.NODEJSTESTING(a int)',
              sqlText: 'insert into t1 values (1, 2), (2, 3), (3, 4)',
              

              complete: function (err, stmt, rows) {
                if (err) {
                  console.error(
                    '1 Failed to execute statement due to the following error: ' +
                          err.message
                  );
                } else {
                  connection.execute({
                    sqlText: 'create or replace database db2',
                    

                    complete: function (err, stmt, rows) {
                      if (err) {
                        console.error(
                          '1 Failed to execute statement due to the following error: ' +
                                err.message
                        );
                      } else {
                        connection.execute({
                          sqlText: 'create or replace hybrid table t2 (a int primary key, b int)',
                          

                          complete: function (err, stmt, rows) {
                            if (err) {
                              console.error(
                                '1 Failed to execute statement due to the following error: ' +
                                      err.message
                              );
                            } else {
                              connection.execute({
                                sqlText: 'insert into t2 values (1, 3), (2, 2), (3, 4)',
                                

                                complete: function (err, stmt, rows) {
                                  if (err) {
                                    console.error(
                                      '1 Failed to execute statement due to the following error: ' +
                                            err.message
                                    );
                                  } else {
                                    connection.execute({
                                      sqlText: 'create or replace database db3',
                                      

                                      complete: function (err, stmt, rows) {
                                        if (err) {
                                          console.error(
                                            '1 Failed to execute statement due to the following error: ' +
                                                  err.message
                                          );
                                        } else {
                                          connection.execute({
                                            sqlText: 'create or replace hybrid table t3 (a int primary key, b int)',
                                            

                                            complete: function (err, stmt, rows) {
                                              if (err) {
                                                console.error(
                                                  '1 Failed to execute statement due to the following error: ' +
                                                        err.message
                                                );
                                              } else {
                                                connection.execute({
                                                  sqlText: 'insert into t3 values (1, 3), (2, 2), (3, 4)',
                                                  

                                                  complete: function (err, stmt, rows) {
                                                    if (err) {
                                                      console.error(
                                                        '1 Failed to execute statement due to the following error: ' +
                                                              err.message
                                                      );
                                                    } else {
                                                      connection.execute({
                                                        sqlText: 'select * from db1.public.t1 x, db2.public.t2 y, db3.public.t3 z where x.a = y.a and y.a = z.a',
                                                        
                                                            
                                                        complete: function (err, stmt, rows) {
                                                          if (err) {
                                                            console.error(
                                                              '1 Failed to execute statement due to the following error: ' +
                                                                    err.message
                                                            );
                                                          } else {
                                                            connection.execute({
                                                              sqlText: 'insert into db2.public.t2 (select y.a*100*z.a, y.b*15*z.b from db1.public.t1 y, db3.public.t3 z where y.a=z.a)',
                                                              
                                                                  
                                                              complete: function (err, stmt, rows) {
                                                                if (err) {
                                                                  console.error(
                                                                    '1 Failed to execute statement due to the following error: ' +
                                                                          err.message
                                                                  );
                                                                } else {
                                                                  connection.execute({
                                                                    sqlText: 'select * from db1.public.t1 x, db2.public.t2 y, db3.public.t3 z where x.a = y.a and y.a = z.a;',
                                                                    
                                                                        
                                                                    complete: function (err, stmt, rows) {
                                                                      if (err) {
                                                                        console.error(
                                                                          '1 Failed to execute statement due to the following error: ' +
                                                                                err.message
                                                                        );
                                                                      } else {
                                                                        connection.execute({
                                                                          sqlText: 'select * from db1.public.t1 x, db2.public.t2 y where x.a = y.a;',
                                                                          
                                                                             
                                                                          complete: function (err, stmt, rows) {
                                                                            if (err) {
                                                                              console.error(
                                                                                '1 Failed to execute statement due to the following error: ' +
                                                                                      err.message
                                                                              );
                                                                            } else {
                                                                              connection.execute({
                                                                                sqlText: 'select * from db2.public.t2 y, db3.public.t3 z where y.a = z.a;',
                                                                                
                                                                                    
                                                                                complete: function (err, stmt, rows) {
                                                                                  if (err) {
                                                                                    console.error(
                                                                                      '1 Failed to execute statement due to the following error: ' +
                                                                                            err.message
                                                                                    );
                                                                                  } else {
                                                                                    // console.log(stmt.getColumns()[1].getName());
                                                                                    console.log('Done');
                                                                                  }
                                                                                },
                                                                              });
                                                                            }
                                                                          },
                                                                        });
                                                                      }
                                                                    },
                                                                  });
                                                                }
                                                              },
                                                            });
                                                          }
                                                        },
                                                      });
                                                    }
                                                  },
                                                });
                                              }
                                            },
                                          });
                                        }
                                      },
                                    });
                                  }
                                },
                              });
                            }
                          },
                        });
                      }
                    },
                  });
                }
              },
            });
          }
        },
      });
    }
  },
});
 



