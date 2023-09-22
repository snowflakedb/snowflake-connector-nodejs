/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

const QueryContextCache = require('../../lib/queryContextCache.js');
const assert = require('assert');

const BASE_ID = 0;
const BASE_PRIORITY = 0;
const BASE_READ_TIMESTAMP = 1668727958;
const CONTEXT = 'Some query Context';
const MAX_CAPACITY = 5;

function QueryContextElement (id,timestamp,priority,context) {
  this.id = id;
  this.timestamp = timestamp;
  this.priority = priority;
  this.context = context;
}

function TestingQCC () {
  this.qcc = null;
 
  this.expectedIDs;
  this.expectedReadTimestamp;
  this.expectedPriority;
  
  this.initCache = function () {
    this.qcc = new QueryContextCache(MAX_CAPACITY);
  };
  
  this.initCacheWithData = function () {
    this.initCacheWithDataWithContext(CONTEXT);
  };
  
  this.initCacheWithDataWithContext = function (Context) {
    this.qcc = new QueryContextCache(MAX_CAPACITY);
    this.expectedIDs = [];
    this.expectedReadTimestamp = [];
    this.expectedPriority = [];
    for (let i = 0; i < MAX_CAPACITY; i++) {
      this.expectedIDs[i] = BASE_ID + i;
      this.expectedReadTimestamp[i] = BASE_READ_TIMESTAMP + i;
      this.expectedPriority[i] = BASE_PRIORITY + i;
      this.qcc.merge(new QueryContextElement(this.expectedIDs[i], this.expectedReadTimestamp[i], this.expectedPriority[i], Context));
    }
  };
    
  this.initCacheWithDataInRandomOrder = function () {
    this.qcc = new QueryContextCache(MAX_CAPACITY);
    this.expectedIDs = [];
    this.expectedReadTimestamp = [];
    this.expectedPriority = [];
    for (let i = 0; i < MAX_CAPACITY; i++) {
      this.expectedIDs[i] = BASE_ID + i;
      this.expectedReadTimestamp[i] = BASE_READ_TIMESTAMP + i;
      this.expectedPriority[i] = BASE_PRIORITY + i;
    }
  
    this.qcc.merge(new QueryContextElement(this.expectedIDs[3], this.expectedReadTimestamp[3], this.expectedPriority[3], CONTEXT));
    this.qcc.merge(new QueryContextElement(this.expectedIDs[2], this.expectedReadTimestamp[2], this.expectedPriority[2], CONTEXT));
    this.qcc.merge(new QueryContextElement(this.expectedIDs[4], this.expectedReadTimestamp[4], this.expectedPriority[4], CONTEXT));
    this.qcc.merge(new QueryContextElement(this.expectedIDs[0], this.expectedReadTimestamp[0], this.expectedPriority[0], CONTEXT));
    this.qcc.merge(new QueryContextElement(this.expectedIDs[1], this.expectedReadTimestamp[1], this.expectedPriority[1], CONTEXT));
  };

  this.assertCacheData = function () {
    this.assertCacheDataWithContext(CONTEXT);
  };
  
  this.assertCacheDataWithContext = function (Context) {
    const size = this.qcc.getSize();
    assert.strictEqual(size,MAX_CAPACITY);
    const elements = Array.from(this.qcc.getElements());
    for (let i = 0; i < size; i++) {
      assert.strictEqual(this.expectedIDs[i], elements[i].id);
      assert.strictEqual(this.expectedReadTimestamp[i], elements[i].timestamp);
      assert.strictEqual(this.expectedPriority[i], elements[i].priority);
      assert.strictEqual(Context, elements[i].context);
    }
  };
}

describe('Query Context Cache Test', function () {
  const testingQcc = new TestingQCC();

  it('test - the cache is empty',function () {
    testingQcc.initCache();
    assert.strictEqual(testingQcc.qcc.getSize(), 0);
  });
  
  it('test - some elements in the cache',function () {
    testingQcc.initCacheWithData();

    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('test - query contexts are randomly added in the cache',function () {
    testingQcc.initCacheWithDataInRandomOrder();

    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('test - the number of contexts is over the size of capacity',function () {
    testingQcc.initCacheWithData();
  
    // Add one more element at the end
    const i = MAX_CAPACITY;
    const extraQCE = new QueryContextElement(BASE_ID + i, BASE_READ_TIMESTAMP + i, BASE_PRIORITY + i, CONTEXT);
    testingQcc.qcc.merge(extraQCE);
    testingQcc.qcc.checkCacheCapacity();
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('test updating timestamp',function () {
    testingQcc.initCacheWithData();

    // Add one more element with new TS with existing id
    const updatedID = 1;
    testingQcc.expectedReadTimestamp[updatedID] = BASE_READ_TIMESTAMP + updatedID + 10;
    const updatedQCE =  new QueryContextElement(BASE_ID + updatedID, testingQcc.expectedReadTimestamp[updatedID], BASE_PRIORITY + updatedID, CONTEXT);
    testingQcc.qcc.merge(updatedQCE);
    testingQcc.qcc.checkCacheCapacity();
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('test updating priority', function () {
    testingQcc.initCacheWithData();

    // Add one more element with new priority with existing id
    const updatedID = 3;
    const updatedPriority = BASE_PRIORITY + updatedID + 7;
    testingQcc.expectedPriority[updatedID] = updatedPriority;
    const updatedQCE = new QueryContextElement(BASE_ID + updatedID, BASE_READ_TIMESTAMP + updatedID, testingQcc.expectedPriority[updatedID], CONTEXT);
    testingQcc.qcc.merge(updatedQCE);
    testingQcc.qcc.checkCacheCapacity();
  
    for (let i = updatedID; i < MAX_CAPACITY - 1; i++) {
      testingQcc.expectedIDs[i] = testingQcc.expectedIDs[i + 1];
      testingQcc.expectedReadTimestamp[i] = testingQcc.expectedReadTimestamp[i + 1];
      testingQcc.expectedPriority[i] = testingQcc.expectedPriority[i + 1];
    }
  
    testingQcc.expectedIDs[MAX_CAPACITY - 1] = BASE_ID + updatedID;
    testingQcc.expectedReadTimestamp[MAX_CAPACITY - 1] = BASE_READ_TIMESTAMP + updatedID;
    testingQcc.expectedPriority[MAX_CAPACITY - 1] = updatedPriority;
    testingQcc.assertCacheData();
  });
  
  it('test - the same priority is added',function () {
    testingQcc.initCacheWithData();
  
    // Add one more element with same priority
    const i = MAX_CAPACITY;
    const updatedPriority = BASE_PRIORITY + 1;
    testingQcc.qcc.merge(new QueryContextElement(BASE_ID + i, BASE_READ_TIMESTAMP + i, updatedPriority, CONTEXT));
    testingQcc.qcc.checkCacheCapacity();
    testingQcc.expectedIDs[1] = BASE_ID + i;
    testingQcc.expectedReadTimestamp[1] = BASE_READ_TIMESTAMP + i;
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('test - the new context has the same id but different timestamp ', function () {
    testingQcc.initCacheWithData();

    // Add one more element with same priority
    const i = 2;
    const samePriorityQCE = new QueryContextElement(BASE_ID + i, BASE_READ_TIMESTAMP + i - 10, BASE_PRIORITY + i, CONTEXT);
    testingQcc.qcc.merge(samePriorityQCE);
    testingQcc.qcc.checkCacheCapacity();
  
    // Compare elements
    testingQcc.assertCacheData();
  });
  
  it('test empty cache with null data', function () {
    testingQcc.initCacheWithData();
    testingQcc.qcc.deserializeQueryContext(null);
    assert.strictEqual(testingQcc.qcc.getSize(),0,'Empty cache');
  });
  
  it('test empty cache with empty response data',function () {
    testingQcc.initCacheWithData();
    testingQcc.qcc.deserializeQueryContext({});
    assert.strictEqual(testingQcc.qcc.getSize(),0,'Empty cache');
  });
  
  it('test serialized request and deserialize response data', function () {
    testingQcc.initCacheWithData();
    testingQcc.assertCacheData();
  
    const response = testingQcc.qcc.getSerializeQueryContext();

    // Clear testingQcc.qcc
    testingQcc.qcc.clearCache();
    assert.strictEqual(testingQcc.qcc.getSize(),0,'Empty cache');
    testingQcc.qcc.deserializeQueryContext(response);
    testingQcc.assertCacheData();
  });
  
  it('test serialized request and deserialize response data when context is null', function () {

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