const SecureStorage = require('./lib/authentication/secureStorage.js');
function testing(){
  return 123
}

async function testing2(){
  let a = await testing();
  console.log(a);
}

testing2();






