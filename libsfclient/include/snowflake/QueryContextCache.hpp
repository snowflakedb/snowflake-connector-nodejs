/*
 * Copyright (c) 2024 Snowflake Computing, Inc. All rights reserved.
 */

#pragma once
#ifndef QUERY_CONTEXT_CACHE_HPP
#define QUERY_CONTEXT_CACHE_HPP

#include <mutex>
#include <map>
#include <set>
#include <vector>
#include "snowflake/client.h"

namespace Snowflake
{
namespace Client
{

struct QueryContextElement
{
  uint64 id; // database id as key. (bigint)
  uint64 readTimestamp; // When the query context read (bigint). Compare for same id.
  uint64 priority; // Priority of the query context (bigint). Compare for different ids.
  std::string context; // Opaque information (varbinary).

  // constructors
  QueryContextElement() : id(0), readTimestamp(0), priority(0)
  {}

  QueryContextElement(uint64 in_id, uint64 in_timestamp,
                      uint64 in_pri, const std::string& in_context) :
    id(in_id), readTimestamp(in_timestamp), priority(in_pri), context(in_context)
  {}
};

struct QueryContextComparator {
  bool operator() (const QueryContextElement& lhs, const QueryContextElement& rhs) const {
    if (lhs.priority != rhs.priority)
      return lhs.priority < rhs.priority;
    else if (lhs.id != rhs.id)
      return lhs.id < rhs.id;
    else
      return lhs.readTimestamp < rhs.readTimestamp;
  }
};

class QueryContextCache
{
public:
  // constructor
  QueryContextCache(size_t capacity) : m_capacity(capacity) {}

  void clearCache();

  void setCapacity(size_t capacity);

  /**
  * Merge a new element comes from the server with the existing cache. Merge is based on read time
  * stamp for the same id and based on priority for two different ids.
  *
  * @param id Database id.
  * @param readTimestamp Last time read metadata from FDB.
  * @param priority 0 to N number, where 0 is the highest priority. Eviction policy is based on
  *     priority.
  * @param context Opaque query context.
  */
  void merge(uint64 id, uint64 readTimestamp, uint64 priority, const std::string& context);

  /**
  * Sync the newPriorityMap with the priorityMap at the end of current round of merge
  */
  void syncPriorityMap();

  /**
  * After the merge, loop through priority list and make sure cache is at most capacity. Remove all
  * other elements from the list based on priority.
  */
  void checkCacheCapacity();

  size_t getSize()
  {
    return m_cacheSet.size();
  }

  /*For unit test purpose only, get all elements in cache*/
  size_t getElements(std::vector<uint64>& ids,
                     std::vector<uint64>& readTimestamps,
                     std::vector<uint64>& priorities,
                     std::vector<std::string>& contexts);

protected:
  /**
  * Update Query Context Cache
  *
  * @param entries Query context entries to be updated to cache.
  */
  void UpdateQueryContextCache(const std::vector<QueryContextElement>& entries);

  /**
  * Get entries from Query Context Cache
  *
  * @param entries Output all entries in cache.
  *
  * @return the number of the entries.
  */
  size_t GetQueryContextEntries(std::vector<QueryContextElement>& entries);

private:
  /**
  * Add an element in the cache.
  *
  * @param qce element to add
  */
  void addQCE(const QueryContextElement& qce);

  /**
  * Remove an element from the cache.
  *
  * @param qce element to remove.
  */
  void removeQCE(const QueryContextElement& qce);

  /**
  * Update timstamp and context of an existing qce.
  *
  * @param qce an element exist in the cache
  * @param timestamp timestamp to be updated
  * @param context query context to be updated
  */
  void updateQCE(const QueryContextElement& qce, uint64 timestamp,
                 const std::string& context);

  /**
  * Replace the cache element with a new response element. Remove old element exist in the cache
  * and add a new element received.
  *
  * @param oldQCE an element exist in the cache
  * @param newQCE a new element just received.
  */
  void replaceQCE(const QueryContextElement& oldQCE, const QueryContextElement& newQCE);

  /** Debugging purpose, log the all entries in the cache. */
  void logCacheEntries();
  
  // The mutex protecting access to the query context cache
  std::recursive_mutex m_mutex;

  size_t m_capacity;
  // the query context cache mapped by id
  std::map<uint64, QueryContextElement> m_idMap; // Map for id and QCC
  std::map<uint64, QueryContextElement> m_priorityMap; // Map for priority and id
  std::map<uint64, QueryContextElement> m_newPriorityMap; // Intermediate map for priority and id for current round of merging
  std::set<QueryContextElement, QueryContextComparator> m_cacheSet; // Order data as per priority
};

} // namespace Client
} // namespace Snowflake

#endif  // QUERY_CONTEXT_CACHE_HPP
