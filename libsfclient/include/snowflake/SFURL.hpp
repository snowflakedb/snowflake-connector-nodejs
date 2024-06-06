/*
 * Copyright (c) 2024 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SFURL_HPP
#define SFURL_HPP

#include <string>
#include <unordered_map>
#include <sstream>
#include <list>
#include "snowflake/BaseClasses.hpp"
#include "snowflake/Proxy.hpp"

/**
 * Delegate class to modify url
 */
namespace Snowflake
{
namespace Client
{

class SFURLParseError : public std::logic_error {
public:
  SFURLParseError(const std::string &errorMessage)
  : std::logic_error(errorMessage) {}
};


/**
 * Structural URL that can do parse, component extraction and modification on a url
 * The implementation includes optimization on cached url string.
 */
class SFURL
{

private:
  /**
   * Nested class that owns the query params and provide access function to it.
   * Not exposed to clients.
   */
  class QueryParams
  {
    /**
     * Only SFURL should have access to QueryParams
     */
    friend class SFURL;

    /**
     * Node structure that host param's data and meta-data
     */
    struct QueryParamNode
    {
      QueryParamNode(const std::string &key, const std::string &value, size_t index)
        : m_key(key), m_value(value), m_index(index)
      {}

      std::string m_key;
      std::string m_value;
      size_t m_index;
    };

    /**
     * Constructor function to pass in reference to cache and valid flag of cache
     */
    QueryParams(bool &cacheValid, std::string &cacheURL)
      : m_cacheValid(&cacheValid), m_cacheURL(&cacheURL) {}

    /**
     * Semi-copy constructor to provide a deep copy except for cacheValid and cacheURL
     * @param params
     * @param cacheValid
     * @param cacheURL
     */
    QueryParams(const QueryParams &params, bool &cacheValid, std::string &cacheURL);

    /**
     * Getter for a specific query param value
     * @param key
     * @return value of the key, or empty string "" if the key is not pressented
     */
    const std::string &getQueryParam(const std::string &key) const;

    /**
     * Add a query param pair
     * @param paramName
     * @param paramValue
     * @param index This is the location where parameters' value should be at. ONLY used in parser
     */
    void addQueryParam(const std::string &paramName, const std::string &paramValue, size_t index = 0);

    /**
     * Renew a query param pair. when there is no paramName, there would be no side effect
     * @param paramName
     * @param paramValue
     */
    inline void renewQueryParam(const std::string &paramName, const std::string &paramValue)
    {
      auto iter = m_map.find(paramName);
      if (iter == m_map.end())
      {
        return;
      }

      renewQueryParam(iter->second, paramValue);
    }

    /**
     * Parser function to parse the url stored in cacheURL
     * @param i the current cursor of parser
     */
    void parse(size_t &i);

    /**
     * Append query params to the cached URL.
     * Should only be called in SFURL::toString()
     */
    void flushStr()
    {
      if (m_list.size() == 0)
      {
        return;
      }

      auto iter = m_list.rbegin();

      m_cacheURL->append("?" + iter->m_key + "=");
      iter->m_index = m_cacheURL->size();
      m_cacheURL->append(iter->m_value);

      while (++iter != m_list.rend())
      {
        m_cacheURL->append("&" + iter->m_key + "=");
        iter->m_index = m_cacheURL->size();
        m_cacheURL->append(encodeParam(iter->m_value));
      }
    }

    /**
     * Update the element's value and potentially do cacheURL update when:
     * 1. cache is valid;
     * 2. new value is of same length as the old value
     * @param elem
     * @param newValue
     */
    void renewQueryParam(std::list<QueryParamNode>::iterator &elem, const std::string &newValue);

    /**
    * Encode a query parameter value
    *
    * @param srcParam
    *   parameter value to encode
    *
    * @return
    *   encoded parameter value
    */
    std::string encodeParam(const std::string &srcParam);

    /**
     * Pointer pointing to SFURL's cache valid flag
     */
    bool *m_cacheValid;

    /**
     * Pointer pointing to SFURL's cache
     */
    std::string *m_cacheURL;

    /**
     * Index for fast referencing parameter
     */
    std::unordered_map<std::string, std::list<QueryParamNode>::iterator> m_map;

    /**
     * list for main storage and ordered iteration
     */
    std::list<QueryParamNode> m_list;

    /**
     * empty string when the key for query is not in the set
     */
    std::string empty = "";

  };

public:
  /**
   * Constructor of an empty url
   */
  SFURL();

  /**
   * Copy constructor
   * @param copy
   */
  SFURL(const SFURL &copy);

  /**
   * Assign operator
   * @param copy
   */
  SFURL &operator= (const SFURL &copy);

  /**
   * static parser function to parse a url to the structural data
   * @throw SFURLParseError when the url is invalid
   * @return SFURL being constructed
   */
  static SFURL parse(const std::string &url);

  /**
   * Scheme getter
   * @return scheme
   */
  inline const std::string &scheme() const
  {
    return m_scheme;
  }

  /**
   * Scheme setter
   * @return reference to current SFURL to allow chaining
   */
  inline SFURL &scheme(const std::string &scheme)
  {
    m_scheme = scheme;
    m_cacheValid = false;
    return *this;
  }

  /**
   * @return host name
   */
  inline const std::string &host() const
  {
    return m_host;
  }

  /**
   * Host setter
   * @return reference to current SFURL to allow chaining
   */
  inline SFURL &host(const std::string host)
  {
    m_host = host;
    m_cacheValid = false;
    return *this;
  }

  /**
   * @return port
   */
  inline const std::string &port() const
  {
    return m_port;
  }

  /**
   * Port setter
   * @return reference to current SFURL to allow chaining
   */
  inline SFURL &port(const std::string &port)
  {
    m_port = port;
    m_cacheValid = false;
    return *this;
  }

  /**
   * port setter with number as parameter
   * @return reference to current SFURL to allow chaining
   */
  inline SFURL &port(std::uint16_t port)
  {
    return this->port(std::to_string(port));
  }

  /**
   * @return path name
   */
  inline const std::string &path() const
  {
    return m_path;
  }

  /**
   * Path setter
   * it is the client's responsibility to make sure the path start
   * with '/'
   * @return reference to current SFURL to allow chaining
   */
  inline SFURL &path(const std::string &path)
  {
    m_path = path;
    m_cacheValid = false;
    return *this;
  }

  /**
   * @return fragment name
   */
  inline const std::string &fragment() const
  {
    return m_fragment;
  };

  /**
   * fragment setter
   * @return reference to current SFURL to allow chaining
   */
  inline SFURL &fragment(const std::string &fragment)
  {
    m_fragment = fragment;
    m_cacheValid = false;
    return *this;
  }

  /**
   * @return user information
   */
  inline const std::string &userInfo()
  {
    return m_userinfo;
  }

  /**
   * User info setter
   * @return reference to current SFURL to allow chaining
   */
  inline SFURL &userInfo(const std::string &userinfo)
  {
    m_userinfo = userinfo;
    m_cacheValid = false;
    return *this;
  }

  /**
   * Get the authority
   * @return [user@]host[:port]
   */
  std::string authority() const;

  /**
   *
   * @param key
   * @return
   */
  inline const std::string &getQueryParam(const std::string& key) const
  {
    return m_params.getQueryParam(key);
  }

  /**
   * @brief Renew a query parameter
   *
   * No effect if there is not parameter specified by paramName
   *
   * Cache Behavior:
   * Try to do in-place cache change when possible (param value is of same length)
   *
   * @param paramName
   * @param paramValue
   */
  SFURL &renewQueryParam(const std::string &paramName, const std::string &paramValue)
  {
    m_params.renewQueryParam(paramName, paramValue);
    return *this;
  }

  /**
   * @brief Add a query parameter
   *
   * Add parameter if there is no parameter specified by paramName
   *
   * Cache Behavior:
   * Try to do in-place cache change when possible (param value is of same length)
   *
   * @param paramName
   * @param paramValue
   */
  SFURL &addQueryParam(const std::string &paramName, const std::string &paramValue)
  {
    m_params.addQueryParam(paramName, paramValue);
    return *this;
  }

  /**
   * Pop out the url as a string
   *  1. the url string would be cached internally
   *  2. When replacing the query parameter value of same length, the cache would have
   *     inplace string change to avoid re-forming the url in the later call
   * @return url in string
   */
  std::string toString();

  /**
  * Set proxy settings
  *  When this function is called, proxy settings will be passed through CRULOPT
  *  and the settings in enviornment variables will be ingored.
  *
  * @param proxy The proxy settings.
  */
  inline void setProxy(const Snowflake::Client::Util::Proxy & proxy)
  {
    m_proxyEnabled = true;
    m_proxy = proxy;
  }

  /**
  * Check whether proxy settings is enabled and CRULOPT should be used.
  */
  bool inline isProxyEnabled() const
  {
    return m_proxyEnabled;
  }

  /**
  * Get proxy settings.
  */
  inline const Snowflake::Client::Util::Proxy & getProxy() const
  {
    return m_proxy;
  }

private:

  /**
   * Cached URL string
   */
  std::string m_cacheURL;

  /**
   * Flag to see if the cache is valid
   */
  bool m_cacheValid;

  /// Components of a url:
  /// scheme://[[userinfo@]hostname[:port]]path?paramKey1=paramVal1&.....#fragment
  std::string m_scheme;
  std::string m_userinfo;
  std::string m_host;
  std::string m_port;
  std::string m_path;
  QueryParams m_params;
  std::string m_fragment;

  /**
  * proxy settings
  */
  Snowflake::Client::Util::Proxy m_proxy;
  bool m_proxyEnabled;

  /**
   * Parse the authority component of the sfurl
   * @param sfurl sfurl to be filled with its authority from the url it cached
   * @param i cursor to the url. Should start with the first char of authority component in url
   */
  static void parseAuthority(SFURL &sfurl, size_t &i);
};
}
}

#endif //SFURL_HPP
