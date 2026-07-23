const nativeFs = require('fs');
const { assertFilesystemAccessAllowed } = require('./filesystem_access');

const guardedFunctions = new WeakMap();

function guardFunction(value, receiver) {
  if (typeof value !== 'function') {
    return value;
  }

  const cached = guardedFunctions.get(value);
  if (cached) {
    return cached;
  }

  const guarded = new Proxy(value, {
    apply(target, _thisArg, argumentsList) {
      assertFilesystemAccessAllowed();
      return Reflect.apply(target, receiver, argumentsList);
    },
    construct(target, argumentsList, newTarget) {
      assertFilesystemAccessAllowed();
      return Reflect.construct(target, argumentsList, newTarget);
    },
  });
  guardedFunctions.set(value, guarded);
  return guarded;
}

function guardObject(target) {
  return new Proxy(target, {
    get(object, property) {
      return guardFunction(Reflect.get(object, property, object), object);
    },
  });
}

const guardedPromises = guardObject(nativeFs.promises);
const guardedFs = new Proxy(nativeFs, {
  get(target, property) {
    if (property === 'promises') {
      return guardedPromises;
    }
    return guardFunction(Reflect.get(target, property, target), target);
  },
});

module.exports = guardedFs;
