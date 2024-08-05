/*
 * Copyright (c) 2024 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKE_CURLDESCPOOL_HPP
#define	SNOWFLAKE_CURLDESCPOOL_HPP

#include <unordered_map>
#include <deque>
#include <memory>

#include "snowflake/BaseClasses.hpp"
#include "snowflake/CurlDesc.hpp"

namespace Snowflake
{
namespace Client
{
/**
 * Class CurlDescPool is used to manage pools of curl descriptors. Internally,
 * the pool is subdivided  into sub-pools, one pool of descriptor per server
 * we connect to.
 */
class CurlDescPool: private DoNotCopy
{
public:

  /**
   * Class sub-pool manages a sub-pool of descriptors and
   */
  class SubPool
  {
  public:

    /**
     * Constructor
     *
     * @param endPointName
     *   name of the server end point, derived from the URL
     *
     * @param (IN/NULL) curlShareDesc
     *   curl shared descriptor to use if non null
     *
     * @param parentPool
     *   reference to parent pool instance.
     */
    SubPool(const std::string &endPointName,
            CURLSH *curlShareDesc, CurlDescPool& parentPool);

    /**
     * Get new curl descriptor from the pool and populate unique_ptr with it
     *
     * @param curlDescPt
     *   empty unique pointer we will populate with a new pointer to a curl
     *   descriptor
     */
    void newCurlDesc(std::unique_ptr<CurlDesc> &curlDescPt);

    /**
     * Free curl descriptor back to the pool
     *
     * @param curlDescPt
     *   pointer to curl descriptor
     */
    void freeCurlDesc(std::unique_ptr<CurlDesc> &curlDescPt);

  private:

    /** lock the sub pool */
    std::mutex  m_lockSubPool;

    /**
     * reference to parent pool instance.
     * used to call createCurlDesc there to allow overriding CurlDesc.
     */
    CurlDescPool& m_parentPool;

    /**
     * End point name, identifies the server name end point of a connection. For
     * example http://localhost:23668 (for GS) or
     * https://sfc-dev2-bdagevil.s3.amazonaws.com.
     */
    std::string m_endPointName;

    /** curl shared descriptor to use when not null */
    CURLSH *m_curlShareDesc;

    /**
     * pool of unused descriptor
     */
    std::deque<std::unique_ptr<CurlDesc>> m_curlDescPool;
  };

  /**
   * Constructor
   */
  CurlDescPool();

  /**
   * Destructor
   */
  virtual ~CurlDescPool();

  /**
   * Initialization (or reinitialization). This should be called after forking
   * a job so that we can start clean.
   */
  void init();
  
  /**
   * Allow subclass to use different CurlDesc
   */
  virtual std::unique_ptr<CurlDesc> createCurlDesc(CURLSH* curlShareDesc)
  {
    return std::unique_ptr<CurlDesc>(new CurlDesc(curlShareDesc));
  }

  /**
   * Get sub-pool associated to the specified URL
   *
   * @param url
   *   url we are accessing
   */
  virtual SubPool &getSubPool(const SFURL &url);

  /**
   * Callback function called by curl to lock the shared descriptor
   *
   * @param handle
   *   handle for which this function is called
   *
   * @param data
   *   data being accessed
   *
   * @param access
   *   access type
   *
   * @param ctx
   *   our context, pointer to this singleton instance
   */
  static void curlShareLock(CURL *handle, curl_lock_data data,
                            curl_lock_access access, void *ctx);

  /**
   * Callback function for curl to unlock the shared descriptor
   *
   * @param handle
   *   handle for which this function is called
   *
   * @param data
   *   data being accessed
   *
   * @param ctx
   *   our context, pointer to this singleton instance
   */
  static void curlShareUnlock(CURL *handle, curl_lock_data data, void *ctx);

protected:

  /**
   * true if we have already initialized the pool service
   */
  bool m_init;

  /** to lock the pool when looking up or creating new sub-pools */
  std::mutex m_lockPool;

  /** to lock the SHARE section of the global curl shared descriptor */
  std::mutex m_lockSharedShare;

  /** to lock the DNS section of the global curl shared descriptor */
  std::mutex m_lockSharedDns;

  /** to lock the SSL section of the global curl shared descriptor */
  std::mutex m_lockSharedSsl;

  /**
   * curl share descriptor to share dns names and ssl session ids
   */
  CURLSH *m_curlShared;

  /**
   * Map a string representing an end point name to a sub-pool
   */
  typedef std::unordered_map<std::string, std::unique_ptr<SubPool>>
                                                                SubPoolByName_t;

  /**
   * All the sub pools we manage
   */
  SubPoolByName_t m_subPools;
};

class ClientCurlDescPool : public CurlDescPool, public Singleton<ClientCurlDescPool>
{
  public:
  /**
   * Constructor
   */
  ClientCurlDescPool() {};

  /**
   * Destructor
   */
  virtual ~ClientCurlDescPool() {};
};

}
}

#endif /* SNOWFLAKE_CURLDESCPOOL_HPP */

