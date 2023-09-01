/*
 * Copyright (c) 2012-2022 Snowflake Computing Inc. All rights reserved.
 */
const Logger = require('./logger');
const crypto = require('crypto');
/**
     * Constructor.
     *
     * @param id database id
     * @param readTimestamp Server time when this entry read
     * @param priority Priority of this entry w.r.t other ids
     * @param context Opaque query context, used by query processor in the server.
     */

/** Query context information. */
function QueryContextElement(id,readTimestamp,priority,context) {
  this.id = id;
  this.readTimestamp = readTimestamp;
  this.priority = priority;
  this.context = context;

  this.setId = function(id) {
    this.id = id;
  };

  this.setPriority = function(priority) {
    this.priority = priority;
  };

  this.setContext = function(context) {
    this.context = context;
  };

  this.setReadTimestamp = function(readTimestamp) {
    this.readTimestamp = readTimestamp;
  };

  this.getId = function() {
    return id;
  };

  this.getReadTimestamp = function() {
    return readTimestamp;
  };

  this.getPriority = function() {
    return priority;
  };

  this.getContext = function() {
    return context;
  };
   
}

QueryContextElement.prototype.equals = function(obj) {
  if (obj == this) {
    return true;
  }

  if (!(obj instanceof QueryContextElement)) {
    return this.equals(obj);
  }

    
  return (this.id == obj.id
        && this.readTimestamp == obj.readTimestamp
        && this.priority == obj.priority
        && this.context.equals(obj.context));
};

QueryContextElement.prototype.hashCode=function() {
  let hash = 31;

  hash = hash * 31 + parseInt(this.id);
  hash += (hash * 31) + parseInt(this.readTimestamp);
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
QueryContextCache.prototype.addQCE= function(qce) {
  this.idMap.set(qce.id,qce);
  this.priorityMap.set(qce.priority,qce);
  this.treeSet.add(qce);
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
   * Merge a new element comes from the server with the existing cache. Merge is based on read time
   * stamp for the same id and based on priority for two different ids.
   *
   * @param id Database id.
   * @param readTimestamp Last time read metadata from FDB.
   * @param priority 0 to N number, where 0 is the highest priority. Eviction policy is based on
   *     priority.
   * @param context Opaque query context.
   * 
   * 
   */
QueryContextCache.prototype.merge = function(id, readTimestamp, priority, context) {
  if (this.idMap.has(id)) {
    // ID found in the cache
    const qce = this.idMap.get(id);
    if (readTimestamp > qce.readTimestamp) {
      if (qce.priority === priority) {
        // Same priority, overwrite new data at same place
        qce.readTimestamp = readTimestamp;
        qce.context = context;
      } else {
        // Change in priority
        const newQCE =
              new QueryContextElement(id, readTimestamp, priority, context);

        this.replaceQCE(qce, newQCE);
      } // new priority
    } // new data is recent
    else if (readTimestamp === qce.readTimestamp && qce.priority !== priority) {
      // Same read timestamp but change in priority
      const newQCE = new QueryContextElement(id, readTimestamp, priority, context);
      this.replaceQCE(qce, newQCE);
    }
  } // id found
  else {
    // new id
    if (this.priorityMap.has(priority)) {

      // Same priority with different id
      const qce = this.priorityMap.get(priority);
      // Replace with new data
      const newQCE = new QueryContextElement(id, readTimestamp, priority, context);
      this.replaceQCE(qce, newQCE);
    } else {
      // new priority
      // Add new element in the cache
      const newQCE = new QueryContextElement(id, readTimestamp, priority, context);
      this.addQCE(newQCE);
    }
  }
};


/**
   * After the merge, loop through priority list and make sure cache is at most capacity. Remove all
   * other elements from the list based on priority.
   */
QueryContextCache.prototype.checkCacheCapacity = function() {
  Logger.getInstance().debug(
    `checkCacheCapacity() called. treeSet size ${this.treeSet.size} cache capacity ${this.capacity}` );
  if (this.treeSet.size > this.capacity) {
    // remove elements based on priority
    while (this.treeSet.size() > this.capacity) {
      const qce = Array.from(this.treeSet).pop();
      this.removeQCE(qce);
    }
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

QueryContextCache.prototype.serializeQueryContext = function () {
  if(this.treeSet.size===0){
    return {};
  }
  return {entries:[...Array.from(this.treeSet)]};
};


/**
   * @param data: the QueryContext Object serialized as a JSON format string
   */
QueryContextCache.prototype.deserializeQueryContext = function(data) {

  Logger.getInstance().debug(`deserializeQueryContext() called: data from server: ${data}`);
  this.logCacheEntries();

  if (data == null || data.length === 0) {
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
    //     "read_timestamp": 123456789,
    //     "priority": 0,
    //     "context": "base64 encoded context"
    //    },
    //     {
    //       "id": 1,
    //       "read_timestamp": 123456789,
    //       "priority": 1,
    //       "context": "base64 encoded context"
    //     },
    //     {
    //       "id": 2,
    //       "read_timestamp": 123456789,
    //       "priority": 2,
    //       "context": "base64 encoded context"
    //     }
    //   ]

    const entries = data.entries;
    if (entries !== null && Array.isArray(entries)) {
      for (const entryNode in entries) {
        const entry = this.deserializeQueryContextElement(entryNode);
        if (entry != null) {
          this.merge(entry.id, entry.readTimestamp, entry.priority, entry.context);
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
  if (Number.isNumber(idNode)) {
    entry.setId(idNode);
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `id` field is not Number type');
    return null;
  }

  const timestampNode = node.timestamp;
  if (Number.isNumber(timestampNode)) {
    entry.setReadTimestamp(timestampNode);
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `timestamp` field is not Long type');
    return null;
  }

  const priorityNode = node.priority;
  if (Number.isNumber(priorityNode)) {
    entry.setPriority(priorityNode.asLong());
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `priority` field is not Long type');
    return null;
  }

  const contextNode = node.context;
  if (typeof contextNode === 'string') {
    const contextBytes = contextNode.asText();
    entry.setContext(contextBytes);
  } else if (contextNode.isEmpty()) {
    // Currenly the OpaqueContext field is empty in the JSON received from GS. In the future, it
    // will
    // be filled with OpaqueContext object in base64 format.
    Logger.getInstance().debug('deserializeQueryContextElement `context` field is empty');
  } else {
    Logger.getInstance().warn('deserializeQueryContextElement: `context` field is not String type');
    return null;
  }

  return entry;
};

QueryContextCache.prototype.logCacheEntries = function() {
  for (const elem in Array.from(this.treeSet)) {
    Logger.debug(
      ' Cache Entry: id: {} readTimestamp: {} priority: {}',
      elem.id,
      elem.readTimestamp,
      elem.priority);
  }
};






module.exports = QueryContextCache;


  
  
 
  