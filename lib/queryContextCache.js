/*
 * Copyright (c) 2012-2022 Snowflake Computing Inc. All rights reserved.
 */
const Logger = require('./logger');
const crypto = require('crypto');
/**
     * Constructor.
     *
     * @param id database id
     * @param timestamp Server time when this entry read
     * @param priority Priority of this entry w.r.t other ids
     * @param context Opaque query context, used by query processor in the server.
     */

/** Query context information. */
function QueryContextElement(id,timestamp,priority,context) {
  this.id = id;
  this.timestamp = timestamp;
  this.priority = priority;
  this.context = context;

}

QueryContextElement.prototype.getId = function() {
  return this.id;
};

QueryContextElement.prototype.getReadTimestamp = function() {
  return this.timestamp;
};

QueryContextElement.prototype.getPriority = function() {
  return this.priority;
};

QueryContextElement.prototype.getContext = function() {
  return this.context;
};
 
QueryContextElement.prototype.setId = function(id) {
  this.id = id;
};

QueryContextElement.prototype.setReadTimestamp = function(timestamp) {
  this.timestamp = timestamp;
};

QueryContextElement.prototype.setPriority = function(priority) {
  this.priority = priority;
};

QueryContextElement.prototype.setContext = function(context) {
  this.context = context;
};


QueryContextElement.prototype.equals = function(obj) {
  if (!(obj instanceof QueryContextElement)) {
    return false;
  }
    
  return (this.id == obj.id
        && this.timestamp == obj.timestamp
        && this.priority == obj.priority
        && this.context.equals(obj.context));
};

QueryContextElement.prototype.hashCode=function() {
  let hash = 31;

  hash = hash * 31 + parseInt(this.id);
  hash += (hash * 31) + parseInt(this.timestamp);
  hash += (hash * 31) + parseInt(this.priority);
  hash += (hash * 31) + parseInt(crypto.createHash('md5').update(Buffer.from(this.context,'utf-8').toString()).digest(),2);

  return hash;
};

/**
 * Most Recently Used and Priority based cache. A separate cache for each connection in the driver.
 */

/**
   * Constructor.
   *
   * @param capacity Maximum capacity of the cache.
   */

function QueryContextCache(capacity) {
  this.capacity = capacity;
  this.idMap = new Map(); // Map for id and QCC
  this.treeSet = new Set(); // Order data as per priority
  this.priorityMap = new Map(); // Map for priority and QCC
  this.newPriorityMap = new Map(); // Intermediate map for priority and QCC for current round of merging
}


/**
   * Add an element in the cache.
   *
   * @param qce element to add
   */
QueryContextCache.prototype.sortTreeSet = function(){
  this.treeSet = new Set(Array.from(this.treeSet).sort((a,b)=>a.getPriority()-b.getPriority()));
};

QueryContextCache.prototype.addQCE= function(qce) {
  this.idMap.set(qce.id,qce);
  this.newPriorityMap.set(qce.priority,qce);
  this.treeSet.add(qce);
  this.sortTreeSet();
};

/**
   * Remove an element from the cache.
   *
   * @param qce element to remove.
   */
QueryContextCache.prototype.removeQCE = function(qce) {

  this.idMap.delete(qce.id);
  this.priorityMap.delete(qce.priority);
  this.treeSet.delete(qce);
};

/**
   * Replace the cache element with a new response element. Remove old element exist in the cache
   * and add a new element received.
   *
   * @param oldQCE an element exist in the cache
   * @param newQCE a new element just received.
   */
QueryContextCache.prototype.replaceQCE = function(oldQCE, newQCE) {
  // Remove old element from the cache
  this.removeQCE(oldQCE);
  // Add new element in the cache
  this.addQCE(newQCE);
};

/**
   * Merge a new element comes from the server with the existing cache. Merge is based on read time
   * stamp for the same id and based on priority for two different ids.
   *
   * @param id Database id.
   * @param timestamp Last time read metadata from FDB.
   * @param priority 0 to N number, where 0 is the highest priority. Eviction policy is based on
   *     priority.
   * @param context Opaque query context.
   * 
   * 
   */
QueryContextCache.prototype.merge = function(id, timestamp, priority, context) {

  if (this.idMap.has(id)) {
    // ID found in the cache
    const qce = this.idMap.get(id);
    if (timestamp > qce.getReadTimestamp()) {
      if (qce.getPriority() === priority) {

        // Same priority, overwrite new data at same place
        qce.setReadTimestamp(timestamp);
        qce.setContext(context);
      } else {

        // Change in priority
        const newQCE =
              new QueryContextElement(id, timestamp, priority, context);

        this.replaceQCE(qce, newQCE);
      } // new priority
    } // new data is recent
    else if (timestamp === qce.getReadTimestamp() && qce.getPriority() !== priority) {
      // Same read timestamp but change in priority
      const newQCE = new QueryContextElement(id, timestamp, priority, context);
      this.replaceQCE(qce, newQCE);

    }
  } // id found
  else {
    // new id
    if (this.priorityMap.has(priority)) {

      // Same priority with different id
      const qce = this.priorityMap.get(priority);
      // Replace with new data
      const newQCE = new QueryContextElement(id, timestamp, priority, context);

      this.replaceQCE(qce, newQCE);

    } else {
      // new priority
      // Add new element in the cache
      const newQCE = new QueryContextElement(id, timestamp, priority, context);
      this.addQCE(newQCE);

    }
  }
};

/** Sync the newPriorityMap with the priorityMap at the end of current round of merge */
QueryContextCache.prototype.syncPriorityMap = function() {
  Logger.getInstance().debug(
    `syncPriorityMap called priorityMap size = ${this.priorityMap.size}, newPrioirtyMap size = ${this.newPriorityMap.size}`
  );
  this.newPriorityMap.forEach((value,key)=>{
    this.priorityMap.set(key,value);
  });
  // clear the newPriorityMap for next round of QCC merge(a round consists of multiple entries)
  this.newPriorityMap.clear();
};




/**
   * After the merge, loop through priority list and make sure cache is at most capacity. Remove all
   * other elements from the list based on priority.
   */
QueryContextCache.prototype.checkCacheCapacity = function() {
  Logger.getInstance().debug(
    `checkCacheCapacity() called. treeSet size ${this.treeSet.size} cache capacity ${this.capacity}` );
  // remove elements based on priority
  while (this.treeSet.size > this.capacity) {
    const qce = Array.from(this.treeSet).pop();
    this.removeQCE(qce);
  }
  Logger.getInstance().debug(
    `checkCacheCapacity() returns. treeSet size ${this.treeSet.size} cache capacity ${this.capacity}`,
  );
};

/** Clear the cache. */
QueryContextCache.prototype.clearCache = function() {
  Logger.getInstance().debug('clearCache() called');
  this.idMap.clear();
  this.priorityMap.clear();
  this.treeSet.clear();
  Logger.getInstance().debug(`clearCache() returns. Number of entries in cache now ${this.treeSet.size}`,);
};


QueryContextCache.prototype.getElements = function(){
  return this.treeSet;
};

/**
   * @param data: the QueryContext Object serialized as a JSON format string
   */
QueryContextCache.prototype.deserializeQueryContext = function(data) {

  Logger.getInstance().debug(`deserializeQueryContext() called: data from server: ${JSON.stringify(data)}`);
  if (!data||JSON.stringify(data)==='{}'||data.entries === null) {
    // Clear the cache
    this.clearCache();
    Logger.getInstance().debug('deserializeQueryContext() returns');
    this.logCacheEntries();
    return;
  }

  try {
    // Deserialize the entries. The first entry with priority is the main entry. On JDBC side,
    // we save all entries into one list to simplify the logic. An example JSON is:
    // {
    //   "entries": [
    //    {
    //     "id": 0,
    //     "readtimestamp": 123456789,
    //     "priority": 0,
    //     "context": "base64 encoded context"
    //    },
    //     {
    //       "id": 1,
    //       "readtimestamp": 123456789,
    //       "priority": 1,
    //       "context": "base64 encoded context"
    //     },
    //     {
    //       "id": 2,
    //       "readtimestamp": 123456789,
    //       "priority": 2,
    //       "context": "base64 encoded context"
    //     }
    //   ]

    const entries = data.entries;
    if (entries !== null && Array.isArray(entries)) {
      for (const entryNode of entries) {
        const entry = this.deserializeQueryContextElement(entryNode);
        if (entry != null) {
          this.merge(entry.getId(), entry.getReadTimestamp(), entry.getPriority(), entry.getContext());
        } else {
          Logger.getInstance().warn(
            'deserializeQueryContextJson: deserializeQueryContextElement meets mismatch field type. Clear the QueryContextCache.');
          this.clearCache();
          return;
        }
      }
      // after merging all entries, sync the internal priority map to priority map. Because of
      // priority swicth from GS side,
      // there could be priority key conflict if we directly operating on the priorityMap during
      // a round of merge.
      this.syncPriorityMap();
    }
  } catch (e) {
    Logger.getInstance().debug(`deserializeQueryContextJson: Exception = ${e.getMessage}`, );
    // Not rethrowing. clear the cache as incomplete merge can lead to unexpected behavior.
    this.clearCache();
  }

  // After merging all entries, truncate to capacity
  this.checkCacheCapacity();

  // Log existing cache entries
  this.logCacheEntries();
}; // Synchronized

QueryContextCache.prototype.deserializeQueryContextElement = function(node) {
  const entry = new QueryContextElement();
  const idNode = node.id;
  if (typeof idNode === 'number') {
    entry.setId(idNode);
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `id` field is not Number type');
    return null;
  }

  const timestampNode = node.timestamp;
  if (typeof timestampNode === 'number') {
    entry.setReadTimestamp(timestampNode);
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `timestamp` field is not Long type');
    return null;
  }


  const priorityNode = node.priority;
  if (typeof priorityNode === 'number') {
    entry.setPriority(priorityNode);
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `priority` field is not Long type');
    return null;
  }


  const contextNode = node.context;
  if (typeof contextNode === 'string') {

    entry.setContext(contextNode);

  } else if (contextNode === null||contextNode === undefined) {
    
    entry.setContext(null);
    Logger.getInstance().debug('deserializeQueryContextElement `context` field is empty');
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `context` field is not String type');
    return null;
  }
  return entry;
};

QueryContextCache.prototype.logCacheEntries = function() {
  if(Logger.getInstance().getLevel()===3){
    this.treeSet.forEach(function(elem) {
      Logger.getInstance().debug(
        `Cache Entry: id: ${elem.getId()} timestamp: ${elem.getReadTimestamp()} priority: ${elem.getPriority()}`,
      );
    });
  }
};

QueryContextCache.prototype.getSize = function() {
  return this.treeSet.size;
};

QueryContextCache.prototype.getQueryContextDTO = function () {

  const arr = [];
  const querycontexts =Array.from(this.getElements());
  for(let i=0; i<this.treeSet.size;i++){
    arr.push({id:querycontexts[i].id,timestamp:querycontexts[i].timestamp,priority:querycontexts[i].priority,context:{base64Data:querycontexts[i].context}||null});
  }

  return {
    entries: arr || []
  };
};

QueryContextCache.prototype.getSerializeQueryContext = function(){
  const arr = [];
  const querycontexts =Array.from(this.getElements());
  for(let i=0; i<this.treeSet.size;i++){
    arr.push({id:querycontexts[i].id,timestamp:querycontexts[i].timestamp,priority:querycontexts[i].priority,context:querycontexts[i].context||null});
  }

  return {
    entries: arr
  };
};


module.exports = QueryContextCache;
  