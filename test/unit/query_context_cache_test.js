const QueryContextCache = requrie('../lib/queryContextCache.js');
const assert = require('assert');

describe('QueryContextCacheTest', function() {
    qcc = null;
    BASE_READ_TIMESTAMP = 1668727958;
    CONTEXT = "Some query context";
    BASE_ID = 0;
    BASE_PRIORITY = 0;
  
    MAX_CAPACITY = 5;
    expectedIDs;
    expectedReadTimestamp;
    expectedPriority;
  
    this.initCache = function() {
      qcc = new QueryContextCache(MAX_CAPACITY);
    }
  
    this.initCacheWithData = function() {
      initCacheWithDataWithContext(CONTEXT);
    }
  
    this.initCacheWithDataWithContext = function( context) {
      qcc = new QueryContextCache(MAX_CAPACITY);
      expectedIDs = new long[MAX_CAPACITY];
      expectedReadTimestamp = new long[MAX_CAPACITY];
      expectedPriority = new long[MAX_CAPACITY];
      for (let i = 0; i < MAX_CAPACITY; i++) {
        expectedIDs[i] = BASE_ID + i;
        expectedReadTimestamp[i] = BASE_READ_TIMESTAMP + i;
        expectedPriority[i] = BASE_PRIORITY + i;
        qcc.merge(expectedIDs[i], expectedReadTimestamp[i], expectedPriority[i], context);
      }
      qcc.syncPriorityMap();
    }
    
    this.initCacheWithDataInRandomOrder = function() {
      qcc = new QueryContextCache(MAX_CAPACITY);
      expectedIDs = new long[MAX_CAPACITY];
      expectedReadTimestamp = new long[MAX_CAPACITY];
      expectedPriority = new long[MAX_CAPACITY];
      for (let i = 0; i < MAX_CAPACITY; i++) {
        expectedIDs[i] = BASE_ID + i;
        expectedReadTimestamp[i] = BASE_READ_TIMESTAMP + i;
        expectedPriority[i] = BASE_PRIORITY + i;
      }
  
      qcc.merge(expectedIDs[3], expectedReadTimestamp[3], expectedPriority[3], CONTEXT);
      qcc.merge(expectedIDs[2], expectedReadTimestamp[2], expectedPriority[2], CONTEXT);
      qcc.merge(expectedIDs[4], expectedReadTimestamp[4], expectedPriority[4], CONTEXT);
      qcc.merge(expectedIDs[0], expectedReadTimestamp[0], expectedPriority[0], CONTEXT);
      qcc.merge(expectedIDs[1], expectedReadTimestamp[1], expectedPriority[1], CONTEXT);
      qcc.syncPriorityMap();
    }
    this.assertCacheData = function() {
        assertCacheDataWithContext(CONTEXT);
    }
    this.assertCacheDataWithContext = function(context) {
        let size = qcc.getSize();
        assertThat("Non empty cache", size == MAX_CAPACITY);
    
        ids = new long[size];
        readTimestamps = new long[size];
        priorities = new long[size];
        contexts = new String[size];
    
        // Compare elements
        qcc.getElements(ids, readTimestamps, priorities, contexts);
        for (let i = 0; i < size; i++) {
          assertEquals(expectedIDs[i], ids[i]);
          assertEquals(expectedReadTimestamp[i], readTimestamps[i]);
          assertEquals(expectedPriority[i], priorities[i]);
          assertEquals(context, contexts[i]);
        }
      }

  
    /** Test for empty cache */
    it('testIsEmpty',function(){
            this.initCache();
            assert.strictEqual(this.qcc.getSize(), 0);
    });
  
    it('testWithSomeData',function(){
      initCacheWithData();
      // Compare elements
      assertCacheData();
    })
  
    it('testWithSomeDataInRandomOrder',function(){
      initCacheWithDataInRandomOrder();
      // Compare elements
      assertCacheData();
    });
});
    // @Test
    // public void testMoreThanCapacity() throws Exception {
    //   initCacheWithData();
  
    //   // Add one more element at the end
    //   int i = MAX_CAPACITY;
    //   qcc.merge(BASE_ID + i, BASE_READ_TIMESTAMP + i, BASE_PRIORITY + i, CONTEXT);
    //   qcc.syncPriorityMap();
    //   qcc.checkCacheCapacity();
  
    //   // Compare elements
    //   assertCacheData();
    // }
  
    // @Test
    // public void testUpdateTimestamp() throws Exception {
    //   initCacheWithData();
  
    //   // Add one more element with new TS with existing id
    //   int updatedID = 1;
    //   expectedReadTimestamp[updatedID] = BASE_READ_TIMESTAMP + updatedID + 10;
    //   qcc.merge(
    //       BASE_ID + updatedID, expectedReadTimestamp[updatedID], BASE_PRIORITY + updatedID, CONTEXT);
    //   qcc.syncPriorityMap();
    //   qcc.checkCacheCapacity();
  
    //   // Compare elements
    //   assertCacheData();
    // }
  
    // @Test
    // public void testUpdatePriority() throws Exception {
    //   initCacheWithData();
  
    //   // Add one more element with new priority with existing id
    //   int updatedID = 3;
    //   long updatedPriority = BASE_PRIORITY + updatedID + 7;
  
    //   expectedPriority[updatedID] = updatedPriority;
    //   qcc.merge(
    //       BASE_ID + updatedID, BASE_READ_TIMESTAMP + updatedID, expectedPriority[updatedID], CONTEXT);
    //   qcc.syncPriorityMap();
    //   qcc.checkCacheCapacity();
  
    //   for (int i = updatedID; i < MAX_CAPACITY - 1; i++) {
    //     expectedIDs[i] = expectedIDs[i + 1];
    //     expectedReadTimestamp[i] = expectedReadTimestamp[i + 1];
    //     expectedPriority[i] = expectedPriority[i + 1];
    //   }
  
    //   expectedIDs[MAX_CAPACITY - 1] = BASE_ID + updatedID;
    //   expectedReadTimestamp[MAX_CAPACITY - 1] = BASE_READ_TIMESTAMP + updatedID;
    //   expectedPriority[MAX_CAPACITY - 1] = updatedPriority;
  
    //   assertCacheData();
    // }
  
    // @Test
    // public void testAddSamePriority() throws Exception {
    //   initCacheWithData();
  
    //   // Add one more element with same priority
    //   int i = MAX_CAPACITY;
    //   long UpdatedPriority = BASE_PRIORITY + 1;
    //   qcc.merge(BASE_ID + i, BASE_READ_TIMESTAMP + i, UpdatedPriority, CONTEXT);
    //   qcc.syncPriorityMap();
    //   qcc.checkCacheCapacity();
    //   expectedIDs[1] = BASE_ID + i;
    //   expectedReadTimestamp[1] = BASE_READ_TIMESTAMP + i;
  
    //   // Compare elements
    //   assertCacheData();
    // }
  
    // @Test
    // public void testAddSameIDButStaleTimestamp() throws Exception {
    //   initCacheWithData();
  
    //   // Add one more element with same priority
    //   int i = 2;
    //   qcc.merge(BASE_ID + i, BASE_READ_TIMESTAMP + i - 10, BASE_PRIORITY + i, CONTEXT);
    //   qcc.syncPriorityMap();
    //   qcc.checkCacheCapacity();
  
    //   // Compare elements
    //   assertCacheData();
    // }
  
    // @Test
    // public void testEmptyCacheWithNullData() throws Exception {
    //   initCacheWithData();
  
    //   qcc.deserializeQueryContextJson(null);
    //   assertThat("Empty cache", qcc.getSize() == 0);
    // }
  
    // @Test
    // public void testEmptyCacheWithEmptyResponseData() throws Exception {
    //   initCacheWithData();
  
    //   qcc.deserializeQueryContextJson("");
    //   assertThat("Empty cache", qcc.getSize() == 0);
    // }
  
    // @Test
    // public void testSerializeRequestAndDeserializeResponseData() throws Exception {
    //   // Init qcc
    //   initCacheWithData();
    //   assertCacheData();
  
    //   QueryContextDTO requestData = qcc.serializeQueryContextDTO();
  
    //   // Clear qcc
    //   qcc.clearCache();
    //   assertThat("Empty cache", qcc.getSize() == 0);
  
    //   qcc.deserializeQueryContextDTO(requestData);
    //   assertCacheData();
    // }
  
    // @Test
    // public void testSerializeRequestAndDeserializeResponseDataWithNullContext() throws Exception {
    //   // Init qcc
    //   initCacheWithDataWithContext(null);
    //   assertCacheDataWithContext(null);
  
    //   QueryContextDTO requestData = qcc.serializeQueryContextDTO();
  
    //   // Clear qcc
    //   qcc.clearCache();
    //   assertThat("Empty cache", qcc.getSize() == 0);
  
    //   qcc.deserializeQueryContextDTO(requestData);
    //   assertCacheDataWithContext(null);
    // }
  
    
  
    