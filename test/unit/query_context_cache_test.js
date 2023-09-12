const QueryContextCache = require('../../lib/queryContextCache.js');
const assert = require('assert');

function TestingQCC () {
  this.qcc = null;
  this.BASE_READ_TIMESTAMP = 1668727958;
  this.CONTEXT = 'Some query Context';
  this.BASE_ID = 0;
  this.BASE_PRIORITY = 0;
  this.MAX_CAPACITY = 5;
  this.expectedIDs;
  this.expectedReadTimestamp;
  this.expectedPriority;
  
  this.initCache = function () {
    this.qcc = new QueryContextCache(this.MAX_CAPACITY);
  };
  
  this.initCacheWithData = function () {
    this.initCacheWithDataWithContext(this.CONTEXT);
  };
  
  this.initCacheWithDataWithContext = function (Context) {
    this.qcc = new QueryContextCache(this.MAX_CAPACITY);
    this.expectedIDs = [];
    this.expectedReadTimestamp = [];
    this.expectedPriority = [];
    for (let i = 0; i < this.MAX_CAPACITY; i++) {
      this.expectedIDs[i] = this.BASE_ID + i;
      this.expectedReadTimestamp[i] = this.BASE_READ_TIMESTAMP + i;
      this.expectedPriority[i] = this.BASE_PRIORITY + i;
      this.qcc.merge(this.expectedIDs[i], this.expectedReadTimestamp[i], this.expectedPriority[i], Context);
    }
    this.qcc.syncPriorityMap();
  };
    
  this.initCacheWithDataInRandomOrder = function () {
    this.qcc = new QueryContextCache(this.MAX_CAPACITY);
    this.expectedIDs = [];
    this.expectedReadTimestamp = [];
    this.expectedPriority = [];
    for (let i = 0; i < this.MAX_CAPACITY; i++) {
      this.expectedIDs[i] = this.BASE_ID + i;
      this.expectedReadTimestamp[i] = this.BASE_READ_TIMESTAMP + i;
      this.expectedPriority[i] = this.BASE_PRIORITY + i;
    }
  
    this.qcc.merge(this.expectedIDs[3], this.expectedReadTimestamp[3], this.expectedPriority[3], this.CONTEXT);
    this.qcc.merge(this.expectedIDs[2], this.expectedReadTimestamp[2], this.expectedPriority[2], this.CONTEXT);
    this.qcc.merge(this.expectedIDs[4], this.expectedReadTimestamp[4], this.expectedPriority[4], this.CONTEXT);
    this.qcc.merge(this.expectedIDs[0], this.expectedReadTimestamp[0], this.expectedPriority[0], this.CONTEXT);
    this.qcc.merge(this.expectedIDs[1], this.expectedReadTimestamp[1], this.expectedPriority[1], this.CONTEXT);
    this.qcc.syncPriorityMap();
  };

  this.assertCacheData = function () {
    this.assertCacheDataWithContext(this.CONTEXT);
  };
  
  this.assertCacheDataWithContext = function (Context) {
    const size = this.qcc.getSize();
    assert.strictEqual(size,this.MAX_CAPACITY);
    const elements = Array.from(this.qcc.getElements());
    for (let i = 0; i < size; i++) {
      assert.strictEqual(this.expectedIDs[i], elements[i].getId());
      assert.strictEqual(this.expectedReadTimestamp[i], elements[i].getReadTimestamp());
      assert.strictEqual(this.expectedPriority[i], elements[i].getPriority());
      assert.strictEqual(Context, elements[i].getContext());
    }
  };
}

describe('QueryContextCacheTest', function () {
  const testingQcc = new TestingQCC();

  /** Test for empty cache */
  it('testIsEmpty',function () {
    testingQcc.initCache();
    assert.strictEqual(testingQcc.qcc.getSize(), 0);
  });
  
  it('testWithSomeData',function () {
    testingQcc.initCacheWithData();

    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('testWithSomeDataInRandomOrder',function () {
    testingQcc.initCacheWithDataInRandomOrder();

    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('testMoreThanCapacity',function () {
    testingQcc.initCacheWithData();
  
    // Add one more element at the end
    const i = testingQcc.MAX_CAPACITY;
    testingQcc.qcc.merge(testingQcc.BASE_ID + i, testingQcc.BASE_READ_TIMESTAMP + i, testingQcc.BASE_PRIORITY + i, testingQcc.CONTEXT);
    testingQcc.qcc.syncPriorityMap();
    testingQcc.qcc.checkCacheCapacity();
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('testUpdateTimestamp',function () {
    testingQcc.initCacheWithData();

    // Add one more element with new TS with existing id
    const updatedID = 1;
    testingQcc.expectedReadTimestamp[updatedID] = testingQcc.BASE_READ_TIMESTAMP + updatedID + 10;
    testingQcc.qcc.merge(
      testingQcc.BASE_ID + updatedID, testingQcc.expectedReadTimestamp[updatedID], testingQcc.BASE_PRIORITY + updatedID, testingQcc.CONTEXT);
    testingQcc.qcc.syncPriorityMap();
    testingQcc.qcc.checkCacheCapacity();
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('testUpdatePriority', function () {
    testingQcc.initCacheWithData();

    // Add one more element with new priority with existing id
    const updatedID = 3;
    const updatedPriority = testingQcc.BASE_PRIORITY + updatedID + 7;
    testingQcc.expectedPriority[updatedID] = updatedPriority;
    testingQcc.qcc.merge(
      testingQcc.BASE_ID + updatedID, testingQcc.BASE_READ_TIMESTAMP + updatedID, testingQcc.expectedPriority[updatedID], testingQcc.CONTEXT);
    testingQcc.qcc.syncPriorityMap();
    testingQcc.qcc.checkCacheCapacity();
  
    for (let i = updatedID; i < testingQcc.MAX_CAPACITY - 1; i++) {
      testingQcc.expectedIDs[i] = testingQcc.expectedIDs[i + 1];
      testingQcc.expectedReadTimestamp[i] = testingQcc.expectedReadTimestamp[i + 1];
      testingQcc.expectedPriority[i] = testingQcc.expectedPriority[i + 1];
    }
  
    testingQcc.expectedIDs[testingQcc.MAX_CAPACITY - 1] = testingQcc.BASE_ID + updatedID;
    testingQcc.expectedReadTimestamp[testingQcc.MAX_CAPACITY - 1] = testingQcc.BASE_READ_TIMESTAMP + updatedID;
    testingQcc.expectedPriority[testingQcc.MAX_CAPACITY - 1] = updatedPriority;
    testingQcc.assertCacheData();
  });
  
  it('testAddSamePriority',function () {
    testingQcc.initCacheWithData();
  
    // Add one more element with same priority
    const i = testingQcc.MAX_CAPACITY;
    const UpdatedPriority = testingQcc.BASE_PRIORITY + 1;
    testingQcc.qcc.merge(testingQcc.BASE_ID + i, testingQcc.BASE_READ_TIMESTAMP + i, UpdatedPriority, testingQcc.CONTEXT);
    testingQcc.qcc.syncPriorityMap();
    testingQcc.qcc.checkCacheCapacity();
    testingQcc.expectedIDs[1] = testingQcc.BASE_ID + i;
    testingQcc.expectedReadTimestamp[1] = testingQcc.BASE_READ_TIMESTAMP + i;
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('testAddSameIDButStaleTimestamp', function () {
    testingQcc.initCacheWithData();

    // Add one more element with same priority
    const i = 2;
    testingQcc.qcc.merge(testingQcc.BASE_ID + i, testingQcc.BASE_READ_TIMESTAMP + i - 10, testingQcc.BASE_PRIORITY + i, testingQcc.CONTEXT);
    testingQcc.qcc.syncPriorityMap();
    testingQcc.qcc.checkCacheCapacity();
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('testEmptyCacheWithNullData', function () {
    testingQcc.initCacheWithData();
    testingQcc.qcc.deserializeQueryContext(null);
    assert.strictEqual(testingQcc.qcc.getSize(),0,'Empty cache');
  });
  
  it('testEmptyCacheWithEmptyResponseData',function () {
    testingQcc.initCacheWithData();
    testingQcc.qcc.deserializeQueryContext({});
    assert.strictEqual(testingQcc.qcc.getSize(),0,'Empty cache');
  });
  
  it('testSerializeRequestAndDeserializeResponseData', function () {
    testingQcc.initCacheWithData();
    testingQcc.assertCacheData();
  
    // const queryContextDTO = testingQcc.qcc.getQueryContextDTO();
    const response = testingQcc.qcc.getSerializeQueryContext();

    // Clear testingQcc.qcc
    testingQcc.qcc.clearCache();
    assert.strictEqual(testingQcc.qcc.getSize(),0,'Empty cache');
    testingQcc.qcc.deserializeQueryContext(response);
    testingQcc.assertCacheData();
  });
  
  it('testSerializeRequestAndDeserializeResponseDataWithNulltestingCONTEXT', function () {

    // Init testingQcc.qcc
    testingQcc.initCacheWithDataWithContext(null);
    testingQcc.assertCacheDataWithContext(null);
    const response = testingQcc.qcc.getSerializeQueryContext();

    //Clear testingQcc.qcc
    testingQcc.qcc.clearCache();
    assert.strictEqual(testingQcc.qcc.getSize(), 0,'Empty cache');

    testingQcc.qcc.deserializeQueryContext(response);
    testingQcc.assertCacheDataWithContext(null);
  });
});
  
    
  
    