const mock = require('mock-require');


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

  async open(filePath) {
    if (!this.existingFiles.has(filePath)) {
      throw new Error('File does not exist');
    }
    return {
      stat: async () => {
        if (filePath === badPermissionsConfig) {
          return {
            uid: 0,
            mode: 0o40777,
          };
        }
        if (filePath === wrongOwner) {
          return {
            uid: 0,
            mode: 0o40600,
          };
        }
    
        return {
          uid: 0,
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
    }
  }

  async access(filePath) {
    if (!this.existingFiles.has(filePath)) {
      throw new Error('File does not exist');
    }
  }
}

exports = FsMock;
