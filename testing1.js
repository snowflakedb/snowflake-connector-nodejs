// const CredentialManager = require('./lib/authentication/SecureStorage/credentialManager');
const glob = require('glob');
var fs = require('fs');
var path = require('path');

let matchingFileNames = glob.sync(path.join(`C:\\Users\\JYun\\Desktop\\snowflaketest`,`*`));

// for(matchingFileName of matchingFileNames) {
//     var fileInfo = fs.statSync(matchingFileName);
//     var currFileObj = {};
//     currFileObj['srcFileName'] = matchingFileName.substring(matchingFileName.lastIndexOf('/') + 1);
//     currFileObj['srcFilePath'] = matchingFileName;
//     currFileObj['srcFileSize'] = fileInfo.size;
//     console.log(fileInfo);
// }

console.log(getAllFilesInfo(`C:\\Users\\JYun\\Desktop\\snowflaketest`, true));


// console.log(glob.sync(path.join('',"")))
// function getAllFilesInfo (dir, includeSubDir, root = '') {
//   const fileInfos = [];
//   const subDirectories = [];
//   const matchingFileNames = glob.sync(path.join(dir, '*'));

//   for (const matchingFileName of matchingFileNames) {
//     // initEncryptionMaterial();

//     const fileInfo = fs.statSync(matchingFileName);
//     fileInfo.isDirectory() ? subDirectories.push(matchingFileName) : fileInfos.push(getFileObject(matchingFileName, root));
//   }
  
//   if(includeSubDir) {
//       for (const subDir of subDirectories) {
//         fileInfos.push(...getAllFilesInfo(subDir, includeSubDir, root + subDir.substring(subDir.lastIndexOf('/') + 1) + '/'));
//       }
//   }
  
//   return fileInfos;  
// }

// function getFileObject(dir, root) {
//   const fileInfo = fs.statSync(dir);
//   const currFileObj = {};
//   currFileObj['srcFileName'] = root + dir.substring(dir.lastIndexOf('/') + 1);
//   currFileObj['srcFilePath'] = dir;
//   currFileObj['srcFileSize'] = fileInfo.size;

//   return currFileObj
// }

// function getAllFilesInfo (dir, includeSubDir, subdirectory = '') {
//   const fileInfos = [];
//   const subDirectories = [];
//   const matchingFileNames = glob.sync(path.join(dir + subdirectory, '*'));

//   for (const matchingFileName of matchingFileNames) {
//     // initEncryptionMaterial();

//     const fileInfo = fs.statSync(matchingFileName);
//     fileInfo.isDirectory() ? subDirectories.push(matchingFileName) : fileInfos.push(getFileObject(matchingFileName, root));
//   }
  
//   if(includeSubDir) {
//       for (const subDir of subDirectories) {
//         fileInfos.push(...getAllFilesInfo(dir, includeSubDir,'/' + subDir));
//       }
//   }
  
//   return fileInfos;  
// }

// function getFileObject(dir, root) {
//   const fileInfo = fs.statSync(dir);
//   const currFileObj = {};
//   currFileObj['srcFileName'] = root + dir.substring(dir.lastIndexOf('/') + 1);
//   currFileObj['srcFilePath'] = dir;
//   currFileObj['srcFileSize'] = fileInfo.size;

//   return currFileObj
// }

function getAllFilesInfo (dir, includeSubDir, rootdir="") {
  const fileInfos = [];
  const subDirectories = [];
  const matchingFileNames = glob.sync(path.join(dir, '*'));

  for (const matchingFileName of matchingFileNames) {
    // initEncryptionMaterial();

    const fileInfo = fs.statSync(matchingFileName);
    fileInfo.isDirectory() ? subDirectories.push(matchingFileName) : fileInfos.push(getFileObject(matchingFileName, rootdir));
  }
  
  if(includeSubDir) {
      for (const subDir of subDirectories) {
        fileInfos.push(...getAllFilesInfo(subDir, includeSubDir, rootdir !== "" ? rootdir : dir));
      }
  }
  
  return fileInfos;  
}

function getFileObject(dir, rootdir) {
  const fileInfo = fs.statSync(dir);
  const currFileObj = {};
  currFileObj['srcFileName'] = dir.substring(dir.lastIndexOf('/') + 1);
  currFileObj['srcFilePath'] = dir;
  currFileObj['subDirectory'] = rootdir.length !== 0 ? getSubDirectory(dir, rootdir) : rootdir;
  // currFileObj['subDirectory'] = path.normalize(rootdir);
  currFileObj['srcFileSize'] = fileInfo.size;

  return currFileObj
}

function getSubDirectory(dir, root) {
  const rootDriectory = glob.sync(path.join(root, ''))[0];
  const subDir = dir.substring(0,dir.lastIndexOf('/'));
  return subDir.split(rootDriectory)[1] + '/';
}
