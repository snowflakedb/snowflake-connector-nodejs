const mock = require('mock-require');
const os = require('os');


exports.mockClientConfigFileEnvVariable = function (envClientConfigFileValue) {
  mock('process', {
    env: {
      SF_CLIENT_CONFIG_FILE: envClientConfigFileValue
    }
  });
};

exports.mockFiles = function (fsMock) {
  mock('fs/promises', {
    access: async function (path) {
      return fsMock.access(path);
    },
    readFile: async function (path){
      return fsMock.readFile(path);
    },
    stat: async function (path) {
      return fsMock.stat(path);
    },
    open: async function (path) {
      return fsMock.open(path);
    }
  });
};

exports.createFsMock = function () {
  return new FsMock();
};
const badPermissionsConfig = 'bad_perm_config.json';
exports.badPermissionsConfig = badPermissionsConfig;

const wrongOwner = 'wrong_file_owner.json';
exports.wrongOwner = wrongOwner;

class FsMock {
  existingFiles = new Map();

  constructor() {}

  mockFile(filePath, fileContents) {
    this.existingFiles.set(filePath, fileContents);
    return this;
  }

  async stat(filePath) {
    if (filePath === badPermissionsConfig) {
      return {
        uid: 0,
        gid: 0,
        mode: 0o40777,
      };
    }
    if (filePath === wrongOwner) {
      return {
        uid: 0,
        gid: 0,
        mode: 0o40600,
      };
    }

    return {
      uid: os.userInfo().uid,
      gid: os.userInfo().gid,
      mode: 0o40700,
    };
  }

  async open(filePath) {
    if (!this.existingFiles.has(filePath)) {
      throw new Error('File does not exist');
    }
    return {
      stat: async () => {
        if (filePath === badPermissionsConfig) {
          return {
            uid: 0,
            gid: 0,
            mode: 0o40777,
          };
        }
        if (filePath === wrongOwner) {
          return {
            uid: 0,
            gid: 0,
            mode: 0o40600,
          };
        }
    
        return {
          uid: os.userInfo().uid,
          gid: os.userInfo().gid,
          mode: 0o40700,
        };
      },
      readFile: async () => {
        if (!this.existingFiles.has(filePath)) {
          throw new Error('File does not exist');
        }
        return this.existingFiles.get(filePath);
      },

      async close() {
        return;
      }
    };
  }

  async access(filePath) {
    if (!this.existingFiles.has(filePath)) {
      throw new Error('File does not exist');
    }
  }
}

exports = FsMock;
