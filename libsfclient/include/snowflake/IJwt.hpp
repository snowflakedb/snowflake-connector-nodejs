/*
 * Copyright (c) 2018-2019 Snowflake Computing, Inc. All rights reserved.
 */

#ifndef SNOWFLAKECLIENT_IJWT_HPP
#define SNOWFLAKECLIENT_IJWT_HPP

#include <string>
#include <openssl/ossl_typ.h>
#include <memory>

namespace Snowflake
{
namespace Client
{
namespace Jwt
{

/**
 * Type of algorithms
 *
 * Note - Any updates to this
 * enum should be reflected in
 * jwtWrapper to maintain interoperability.
 */
enum class AlgorithmType
{
  HS256, HS384, HS512,
  RS256, RS384, RS512,
  ES256, ES384, ES512,
  UNKNOWN,
};

struct JwtException : public std::exception
{
  JwtException(const std::string &message) : message_(message) {}
  const char *what() const noexcept
  {
    return message_.c_str();
  }

  std::string message_;
};


/**
 * This is the interface of a Claim Set that can be inserted to the JWT token
 */
class IClaimSet
{
public:
  virtual ~IClaimSet() = default;

  /**
   * Constructor function for the claimset
   * ALWAYS USE THIS FUNCTION TO INSTANTIATE A CLAIM SET!
   */
  static IClaimSet *buildClaimSet();

  /**
   * Construct function for the claimset given the string of the
   * JSON text
   * @throw JWTException when the text is not valid
   */
  static IClaimSet *parseClaimset(const std::string &text);

  /**
   * Check if the claim set contains a specific key
   */
  virtual bool containsClaim(const std::string &key) = 0;

  /**
   * Add the key and a string value to the claim set
   * Would replace the old one if the key exists
   * @param key
   * @param value
   */
  virtual void addClaim(const std::string &key, const std::string &value) = 0;

  /**
   * Add the key and a long value to the claim set
   * Would replace the old one if the key exists
   * @param key
   * @param value
   */
  virtual void addClaim(const std::string &key, long number) = 0;

  /**
   * Get a claim from the claim set in string type
   */
  virtual std::string getClaimInString(const std::string &key) = 0;

  /**
   * Get a claim from the claim set with internal buffer for c interface
   * in jwtWrapper
   */
  virtual const char* getClaimInStringConstBuf(const std::string &key)
  {
    m_claimString = getClaimInString(key);
    return m_claimString.c_str();
  }

  /**
   * Get a claim from the claim set in long type
   */
  virtual long getClaimInLong(const std::string &key) = 0;

  /**
   * Get a claim from the claim set in double type
   */
  virtual double getClaimInDouble(const std::string &key) = 0;

  /**
   * Serialize the claim set to base64url encoded format
   */
  virtual std::string serialize(bool format=true) = 0;

  /**
   * Remove a claim from the claim set with specified key
   */
  virtual void removeClaim(const std::string &key) = 0;

protected:
  IClaimSet() = default;

private:
  /**
   * string buffer to hold string data returned from jwtWrapper
   */
  std::string m_claimString;
};

/**
 * This is a header of the JWT token
 */
class IHeader
{
public:
  virtual ~IHeader() = default;

  /**
   * Construct function for JWT header
   */
  static IHeader *buildHeader();

  /**
   * Construct function for JWT header given the JSON text for header
   * @throw JWTException when the header is not valid
   */
  static IHeader *parseHeader(const std::string &text);

  /**
   * Set the algorithm's type
   * @param type
   */
  virtual void setAlgorithm(AlgorithmType type) = 0;

  /**
   * Set custom header entry
   * @param std::string header_type
   * @param std::string header_value
   */
   virtual void setCustomHeaderEntry(std::string header_type, std::string header_value) = 0;

  /**
   * Get the algorithm type of the header
   * @return the algorithm type
   */
  virtual AlgorithmType getAlgorithmType() = 0;

  /**
   * Get value corresponding to a custom field in
   * the JWT Token Header
   * @return std::string value corresponding to
   * header_type
   */
   virtual std::string getCustomHeaderEntry(const std::string header_type) = 0;

  /**
   * Get custom field in header with interal buffer for c interface in jwtWrapper
   */
  virtual const char* getCustomHeaderEntryConstBuf(const std::string& header_type)
  {
    m_customHeaderEntry = getCustomHeaderEntry(header_type);
    return m_customHeaderEntry.c_str();
  }

  /**
   * Serialize the header
   * @return serialized string in base64urlencoded
   */
  virtual std::string serialize(bool format=true) = 0;

protected:
  IHeader() = default;

private:
  /**
   * string buffer to hold string data returned from jwtWrapper
   */
  std::string m_customHeaderEntry;
};

/**
 * JWT interface class
 * The general use case would be:
 * For issuer:
 *  Use IClaimSet and IHeader to construct elements in the JWT.
 *  Set the claim set and header to the jwt token
 *  Serialize the token with the key and send the result of string to authenticator
 *
 * For authenticator
 *  Use buildJwt(std::string text to marshalize the JWT structure
 *  Verify the token using public key
 */
class IJwt
{
  typedef std::shared_ptr<IClaimSet> ClaimSetPtr;
  typedef std::shared_ptr<IHeader> HeaderPtr;

public:
  /**
   * Construct function for the JWT
   */
  static IJwt *buildIJwt();

  /**
   * Construct function for the JWT with text of that token
   * FORMAT: <base64url coded header>.<base64url coded claimset>.<secret>
   * @throw JWTExcpetion if the text is not corrected serialized
   */
  static IJwt *buildIJwt(const std::string &text);

  virtual ~IJwt() {}

  /**
   * Serialize the JWT token with private key specified
   * The algorithm of signing is specified in the IHeader
   * @usedBy issuer
   */
  virtual std::string serialize(EVP_PKEY *key) = 0;

  /**
   * Get serialize string with interal buffer for c interface in jwtWrapper
   */
  virtual const char* serializeConstBuf(EVP_PKEY *key)
  {
    m_serializedString = serialize(key);
    return m_serializedString.c_str();
  }

  /**
   * Verify the JWT is valid using the public key
   * @usedBy authenticator
   */
  virtual bool verify(EVP_PKEY *key, bool format) = 0;

  /**
   * Setter and getter functions for header and claimset
   * Generally used by issuer
   */
  virtual void setClaimSet(ClaimSetPtr claim_set) = 0;

  virtual ClaimSetPtr getClaimSet() = 0;

  virtual void setHeader(HeaderPtr header) = 0;

  virtual HeaderPtr getHeader() = 0;

protected:
  IJwt() = default;

private:
  /**
   * string buffer to hold string data returned from jwtWrapper
   */
  std::string m_serializedString;
};

} // namespace Jwt
} // namespace Client
} // namespace Snowflake

#endif //SNOWFLAKECLIENT_IJWT_HPP
