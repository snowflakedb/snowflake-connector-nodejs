/*
 ** Copyright (c) 2012-2019 Snowflake Computing Inc. All rights reserved.
 */
#ifndef JWT_WRAPPER_H
#define JWT_WRAPPER_H
typedef void * HEADER;
typedef void * CLAIMSET;
typedef void * CJWT;

#ifdef __cplusplus
extern "C" {
#endif
/*
 * Any updates to this enum should
 * be reflected in IJwt header to
 * maintain interoperability.
 */
typedef enum
{
    HS256, HS384, HS512,
    RS256, RS384, RS512,
    ES256, ES384, ES512,
    UNKNOWN,
}ALGORITHM_TYPE;

/**
 * Construct function for JWT header
 */
HEADER HDR_buildHeader();

/**
 * Set the algorithm's type
 * @param cjwt_header - void pointer to iJwt object
 * @param type - Algorithm Type
 */
void HDR_setAlgorithm(HEADER cjwt_header, ALGORITHM_TYPE alg);

/**
 * Set custom Header Entry
 * @param cjwt_header - void pointer to iJwt Object
 * @param entry_type - name of entry to be added
 * @param entry_value - value of entry to be added
 */
void HDR_setCustomHeaderEntry(HEADER cjwt_header, const char *entry_type, const char *entry_value);

/**
 * Get the algorithm's type
 * @param cjwt_header - void pointer to iJwt object
 */
ALGORITHM_TYPE HDR_getAlgorithmType(HEADER cjwt_header);

/**
 * Get custom Header Entry
 * @param cjwt_header - void pointer to iJwt Object
 * @param entry_type - name of entry in the Header
 */
const char * HDR_getCustomHeaderEntry(HEADER cjwt_header, const char *entry_type);

/**
 * Construct function for JWT Claimset
 * @return iClaimSet object casted to void *
 */
CLAIMSET  CSET_buildClaimset();

/**
 * Parse claimset
 * @param cjwt_cset - void pointer to store claimset object
 * @param text - claimset in string that needs to be parsed
 */
void CSET_parseClaimset(CLAIMSET cjwt_cset, const char *text);

/**
 * Check if a claim "key" is present in a ClaimSet
 * @param cjwt_cset
 * @param key
 * @return
 */
int CSET_containsClaimset(CLAIMSET cjwt_cset, const char *key);

/**
 * Add a String value to iClaimSet Object
 * @param cjwt_cset
 * @param key
 * @param value
 */
void CSET_addStrClaim(CLAIMSET cjwt_cset, const char *key, const char *value);

/**
 * Add an integer value to an iClaimSet Object
 * @param cjwt_cset
 * @param key
 * @param value
 */
void CSET_addIntClaim(CLAIMSET cjwt_cset, const char *key, long value);

/**
 * Extract a value of type char * from iClaimSet object
 * @param cjwt_cset
 * @param key
 * @return
 */
const char * CSET_getClaimsetString(CLAIMSET cjwt_cset, const char *key);

/**
 * Extract a value of type long from iClaimSet object
 * @param cjwt_cset
 * @param key
 * @return
 */
long CSET_getClaimsetLong(CLAIMSET cjwt_cset, const char *key);

/**
 * Extract a value of type double from iClaimSet object
 * @param cjwt_cset
 * @param key
 * @return
 */
double CSET_getClaimsetDouble(CLAIMSET cjwt_cset, const char *key);

/**
 * Build a new empty, iJwt object
 * @return
 */
CJWT CJWT_buildCJWT();

/**
 * Build an iJwt object from a JWT String
 * @param text
 * @return
 */
CJWT CJWT_buildCJWTFromString(const char *text);

/**
 * Delete iJwt Object
 * @param c_jwt_token
 */
void CJWT_delete_cjwt(CJWT c_jwt_token);

/**
 * Serialize iJWT Object
 * @param cjwt_obj
 * @param key
 * @return
 */
const char *CJWT_serialize(CJWT cjwt_obj, EVP_PKEY *key);

/**
 * Verify an iJWT object
 * @param c_jwt_token
 * @param key
 * @return
 */
int CJWT_verify(CJWT c_jwt_token, EVP_PKEY *key);

/**
 * Set claimset in a iJwt Object
 * @param c_jwt_token
 * @param cjwt_cset
 */
void CJWT_setClaimset(CJWT c_jwt_token, CLAIMSET cjwt_cset);

/**
 * Get claimeset from the iJwt Object
 * @param c_jwt_token
 * @return void * pointing to iClaimSet Object
 */
CLAIMSET CJWT_getClaimset(CJWT c_jwt_token);

/**
 * Set header in a iJwt Object
 * @param c_jwt_token - void * to iJwt Object
 * @param cjwt_hdr - void * pointing to iHeader
 */
void CJWT_setHeader(CJWT c_jwt_token, HEADER cjwt_hdr);

/**
 * Get header from the iJwt Object
 * @param C_jwt_token
 * @return void * pointing to iHeader object
 */
HEADER CJWT_getHeader(CJWT C_jwt_token);


#ifdef __cplusplus
}
#endif
#endif
