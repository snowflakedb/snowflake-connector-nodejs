/*
 * Copyright (c) 2012-2022 Snowflake Computing Inc. All rights reserved.
 */


const Util = require('../util');
const Logger = require('../');
const QueryContextElement = require("./queryContextElement");
const QueryContextEntryDTO = require("./queryContextEntryDTO");

/**
 * Most Recently Used and Priority based cache. A separate cache for each connection in the driver.
 */

 /**
   * Constructor.
   *
   * @param capacity Maximum capacity of the cache.
   */

function QueryContextCache(capacity) {
  let idMap = new map(); // Map for id and QCC
  let treeSet = new set(); // Order data as per priority
  let priorityMap = new map(); // Map for priority and QCC
  let newPriorityMap = new map(); // Intermediate map for priority and QCC for current round of merging
}

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
    if (idMap.has(id)) {
      // ID found in the cache
      let qce = idMap.get(id);
      if (readTimestamp > qce.readTimestamp) {
        if (qce.priority === priority) {
          // Same priority, overwrite new data at same place
          qce.readTimestamp = readTimestamp;
          qce.context = context;
        } else {
          // Change in priority
          let newQCE =
              new QueryContextElement(id, readTimestamp, priority, context);

          replaceQCE(qce, newQCE);
        } // new priority
      } // new data is recent
      else if (readTimestamp === qce.readTimestamp && qce.priority !== priority) {
        // Same read timestamp but change in priority
        let newQCE = new QueryContextElement(id, readTimestamp, priority, context);
        replaceQCE(qce, newQCE);
      }
    } // id found
    else {
      // new id
      if (priorityMap.has(priority)) {

        // Same priority with different id
        let qce = priorityMap.get(priority);
        // Replace with new data
        let newQCE = new QueryContextElement(id, readTimestamp, priority, context);
        replaceQCE(qce, newQCE);
      } else {
        // new priority
        // Add new element in the cache
        let newQCE = new QueryContextElement(id, readTimestamp, priority, context);
        addQCE(newQCE);
      }
    }
  }
   /**
   * Add an element in the cache.
   *
   * @param qce element to add
   */
   QueryContextCache.prototype.addQCE= function(qce) {
    idMap.set(qce.id,qce);
    priorityMap.set(qce.priority,qce);
    treeSet.add(qce);
  }

  /**
   * Remove an element from the cache.
   *
   * @param qce element to remove.
   */
  QueryContextCache.prototype.removeQCE = function(qce) {
    idMap.delete(qce.id);
    priorityMap.delete(qce.priority);
    treeSet.delete(qce);
  }

  /**
   * Replace the cache element with a new response element. Remove old element exist in the cache
   * and add a new element received.
   *
   * @param oldQCE an element exist in the cache
   * @param newQCE a new element just received.
   */
  QueryContextCache.prototype.replaceQCE = function(oldQCE, newQCE) {
    // Remove old element from the cache
    removeQCE(oldQCE);
    // Add new element in the cache
    addQCE(newQCE);
  }




  /** Sync the newPriorityMap with the priorityMap at the end of current round of merge */
  QueryContextCache.prototype.syncPriorityMap = function() {
    Logger.getInstance().debug(
        "syncPriorityMap called priorityMap size = {}, newPrioirtyMap size = {}",
        priorityMap.size,
        newPriorityMap.size);

    newPriorityMap.forEach((value,key)=>{
        priorityMap.set(key,value);
    })
    // clear the newPriorityMap for next round of QCC merge(a round consists of multiple entries)
    newPriorityMap.clear();
  }

  /**
   * After the merge, loop through priority list and make sure cache is at most capacity. Remove all
   * other elements from the list based on priority.
   */
  QueryContextCache.prototype.checkCacheCapacity = function() {
    Logger.getInstance().debug(
        "checkCacheCapacity() called. treeSet size {} cache capacity {}", treeSet.size(), capacity);
    if (treeSet.size() > capacity) {
      // remove elements based on priority
      while (treeSet.size() > capacity) {
        let qce = Array.from(treeSet).pop();
        removeQCE(qce);
      }
    }
    Logger.getInstance().debug(
        "checkCacheCapacity() returns. treeSet size {} cache capacity {}",
        treeSet.size(),
        capacity);
  }

  /** Clear the cache. */
  QueryContextCache.prototype.clearCache = function() {
    Logger.getInstance().debug("clearCache() called");
    idMap.clear();
    priorityMap.clear();
    treeSet.clear();
    Logger.getInstance().debug("clearCache() returns. Number of entries in cache now {}", treeSet.size());
  }


  /**
   * @param data: the QueryContext Object serialized as a JSON format string
   */
  QueryContextCache.prototype.deserializeQueryContextJson = function(data) {

    // synchronized (this) {
      // Log existing cache entries
      logCacheEntries();

      if (data == null || data.length() == 0) {
        // Clear the cache
        clearCache();
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

        let entriesNode = data.entries;
        if (entriesNode != null && entriesNode.isArray()) {
          for (let entryNode in entriesNode) {
            let entry = deserializeQueryContextElement(entryNode);
            if (entry != null) {
              merge(entry.id, entry.readTimestamp, entry.priority, entry.context);
            } else {
              Logger.getInstance().warn(
                  "deserializeQueryContextJson: deserializeQueryContextElement meets mismatch field type. Clear the QueryContextCache.");
              clearCache();
              return;
            }
          }
          // after merging all entries, sync the internal priority map to priority map. Because of
          // priority swicth from GS side,
          // there could be priority key conflict if we directly operating on the priorityMap during
          // a round of merge.
          syncPriorityMap();
        }
      } catch (e) {
        Logger.getInstance().debug("deserializeQueryContextJson: Exception = {}", e.getMessage());
        // Not rethrowing. clear the cache as incomplete merge can lead to unexpected behavior.
        clearCache();
      }

      // After merging all entries, truncate to capacity
      checkCacheCapacity();

      // Log existing cache entries
      logCacheEntries();
    } // Synchronized

  QueryContextCache.deserializeQueryContextElement = function(node) {
    let entry = new QueryContextElement();
    let idNode = node.id;
    if (Number.isNumber(idNode)) {
      entry.setId(idNode);
    } else {
      Logger.getInstance().warn("deserializeQueryContextElement: `id` field is not Number type");
      return null;
    }

    let timestampNode = node.timestamp;
    if (Number.isNumber(timestampNode)) {
      entry.setReadTimestamp(timestampNode);
    } else {
      Logger.getInstance().warn("deserializeQueryContextElement: `timestamp` field is not Long type");
      return null;
    }

    let priorityNode = node.priority;
    if (Number.isNumber(priorityNode)) {
      entry.setPriority(priorityNode.asLong());
    } else {
      Logger.getInstance().warn("deserializeQueryContextElement: `priority` field is not Long type");
      return null;
    }

    let contextNode = node.context;
    if (typeof contextNode === 'string') {
      let contextBytes = contextNode.asText();
      entry.setContext(contextBytes);
    } else if (contextNode.isEmpty()) {
      // Currenly the OpaqueContext field is empty in the JSON received from GS. In the future, it
      // will
      // be filled with OpaqueContext object in base64 format.
      Logger.getInstance().debug("deserializeQueryContextElement `context` field is empty");
    } else {
      Logger.getInstance().warn("deserializeQueryContextElement: `context` field is not String type");
      return null;
    }

    return entry;
  }

  /**
   * Deserialize the QueryContext cache from a QueryContextDTO object. This function currently is
   * only used in QueryContextCacheTest.java where we check that after serialization and
   * deserialization, the cache is the same as before.
   */
  QueryContextCache.prototype.deserializeQueryContextDTO = function(queryContextDTO) {
      // Log existing cache entries
      logCacheEntries();

      if (queryContextDTO == null) {
        // Clear the cache
        clearCache();
        // Log existing cache entries
        logCacheEntries();
        return;
      }

      try {

        let entries = queryContextDTO.getEntries();
        if (entries != null) {
          for (let entryDTO in entries) {
            // The main entry priority will always be 0, we simply save a list of
            // QueryContextEntryDTO in QueryContextDTO
            let entry = QueryContextCache.deserializeQueryContextElementDTO(entryDTO);
            this.merge(entry.id, entry.readTimestamp, entry.priority, entry.context);
            logCacheEntries();
          }
        }
        // after merging all entries, sync the internal priority map to priority map. Because of
        // priority swicth from GS side,
        // there could be priority key conflict if we directly operating on the priorityMap during a
        // round of merge.
        syncPriorityMap();
      } catch (e) {
        Logger.getInstance().debug("deserializeQueryContextDTO: Exception = {}", e.getMessage());
        // Not rethrowing. clear the cache as incomplete merge can lead to unexpected behavior.
        clearCache();
      }

      // After merging all entries, truncate to capacity
      checkCacheCapacity();

      // Log existing cache entries
      logCacheEntries();
    } // Synchronized

  QueryContextCache.deserializeQueryContextElementDTO = function(entryDTO){
    return new QueryContextElement(
            entryDTO.getId(),
            entryDTO.getTimestamp(),
            entryDTO.getPriority(),
            entryDTO.getContext().getBase64Data());
  }

  /**
   * Serialize the QueryContext cache to a QueryContextDTO object, which can be serialized to JSON
   * automatically later.
   */
  QueryContextDTO.prototype.serializeQueryContextDTO = function() {
      // Log existing cache entries
      logCacheEntries();

      let elements = this.getElements();
      if (elements.size() == 0) {
        return null;
      }
      try {
        let queryContextDTO = new QueryContextDTO();
        let entries = [];
        // the first element is the main entry with priority 0. We use a list of
        // QueryContextEntryDTO to store all entries in QueryContextDTO
        // to simplify the JDBC side QueryContextCache design.
        for (const elem in elements) {
          let queryContextElementDTO = serializeQueryContextEntryDTO(elem);
          entries.add(queryContextElementDTO);
        }
        queryContextDTO.setEntries(entries);

        return queryContextDTO;

      } catch (e) {
        Logger.getInstance().debug("serializQueryContextDTO(): Exception {}", e.getMessage());
        return null;
      }
  }

  QueryContextCache.prototype.serializeQueryContextEntryDTO = function (entry)
  {
    // OpaqueContextDTO contains a base64 encoded byte array. On JDBC side, we do not decode and
    // encode it
    return new QueryContextEntryDTO(
            entry.getId(),
            entry.getReadTimestamp(),
            entry.getPriority(),
            new OpaqueContextDTO(entry.getContext()));
  }

  QueryContextCache.prototype.logCacheEntries = function() {
      let elements = this.getElements();
      for (let elem in elements) {
        logger.debug(
            " Cache Entry: id: {} readTimestamp: {} priority: {}",
            elem.id,
            elem.readTimestamp,
            elem.priority);
      }
  }

 


  
  
 
  