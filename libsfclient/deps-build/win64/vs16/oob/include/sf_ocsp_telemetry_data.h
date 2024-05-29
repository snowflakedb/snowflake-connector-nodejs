/*
* Copyright (c) 2018-2020 Snowflake Computing
*/

#ifndef PROJECT_SF_OCSP_TELEMETRY_DATA_H
#define PROJECT_SF_OCSP_TELEMETRY_DATA_H

#define OCSP_TELEMETRY_EVENT_MAX_LEN 100
#define OCSP_TELEMETRY_SUB_EVENT_MAX_LEN 1024
#define OCSP_TELEMETRY_HOSTNAME_MAX_LEN 1024
#define OCSP_TELEMETRY_CERTID_MAX_LEN 1024
#define OCSP_TELEMETRY_REQUEST_MAX_LEN 4096
#define OCSP_TELEMETRY_OCSP_URL_MAX_LEN 1024
#define OCSP_TELEMETRY_ERROR_MSG_MAX_LEN 4096

#define OCSP_REVOCATION_CHECK_FAILURE "OCSPRevocationCheckFailure"

#define OCSP_URL_MISSING_OR_INVALID "OCSPURLMissingInvalid"
#define OCSP_RESPONSE_FETCH_EXCEPTION "OCSPResponseFetchException"
#define OCSP_RESPONSE_FETCH_FAILURE "OCSPResponseFetchFailure"
#define OCSP_RESPONSE_UNAVAILABLE "OCSPResponseUnavailable"
#define OCSP_RESPONSE_LOAD_FAILURE "OCSPResponseLoadFailure"
#define OCSP_RESPONSE_STATUS_UNSUCCESSFUL "OCSPResponseStatusUnsuccessful"
#define OCSP_RESPONSE_ATTTACHED_CERT_INVALID "OCSPResponseAtttachedCertInvalid"
#define OCSP_RESPONSE_ATTACHED_CERT_EXPIRED "OCSPResponseAttachedCertExpired"
#define OCSP_RESPONSE_SIGNATURE_INVALID "OCSPResponseSignatureInvalid"
#define OCSP_RESPONSE_EXPIRY_INFO_MISSING "OCSPResponseExpiryInfoMissing"
#define OCSP_RESPONSE_EXPIRED "OCSPResponseExpired"
#define OCSP_RESPONSE_FAILED_TO_CONNECT_CACHE_SERVER "OCSPResponseFailedtoConnectCacheServer"
#define OCSP_RESPONSE_CERT_STATUS_INVALID "OCSPResponseCertStatusInvalid"
#define OCSP_RESPONSE_CERT_STATUS_UNKNOWN "OCSPResponseCertStatusUnknown"
#define OCSP_RESPONSE_CERT_STATUS_REVOKED "OCSPResponseCertStatusRevoked"
#define OCSP_RESPONSE_CERT_STATUS_UNAVAILABLE "OCSPResponseCertStatusUnavailable"
#define OCSP_RESPONSE_CACHE_DOWNLOAD_FAILED "OCSPResponseCacheDownloadFailed"

#define OCSP_REVOKED_CERT_ERROR "OCSPRevokedCertificateError"

// Driver specific
#define OCSP_RESPONSE_CURL_FAILURE "OCSPResponseCurlFailure"
#define OCSP_RESPONSE_STATUS_UNAVAILABLE "OCSPResponseCertStatusUnavailable"
#define OCSP_RESPONSE_CACHE_ENTRY_LOAD_FAILED "OCSPResponseCAcheEntryLoadFailed"
#define OCSP_RESPONSE_FROM_CACHE_EXPIRED "OCSPResponseFromCacheExpired"
#define OCSP_RESPONSE_ENCODE_FAILURE "OCSPResponseEncodeFailure"
#define OCSP_RESPONSE_DECODE_FAILURE "OCSPResponseDecodeFailure"
#define OCSP_REQUEST_CREATION_FAILURE "OCSPRequestAllocationFailure"
#define OCSP_CACHE_READ_FAILURE "OCSPCacheReadFailure"

typedef struct ocsp_telemetry_data
{
  char event_type[OCSP_TELEMETRY_EVENT_MAX_LEN];
  char event_sub_type[OCSP_TELEMETRY_SUB_EVENT_MAX_LEN];
  char sfc_peer_host[OCSP_TELEMETRY_HOSTNAME_MAX_LEN];
  char cert_id[OCSP_TELEMETRY_CERTID_MAX_LEN];
  char ocsp_req_b64[OCSP_TELEMETRY_REQUEST_MAX_LEN];
  char ocsp_responder_url[OCSP_TELEMETRY_OCSP_URL_MAX_LEN];
  char error_msg[OCSP_TELEMETRY_ERROR_MSG_MAX_LEN];
  int insecure_mode;
  int failopen_mode;
  int cache_enabled;
  int cache_hit;
}SF_OTD;

SF_OTD *get_ocsp_telemetry_instance();

void sf_otd_set_event_type(const char *event_type, SF_OTD* ocsp_telemetry_data);

void sf_otd_set_event_sub_type(const char *event_sub_type, SF_OTD* ocsp_telemetry_data);

void sf_otd_set_sfc_peer_host(const char *sfc_peer_host, SF_OTD* ocsp_telemetry_data);

void sf_otd_set_certid(const char *certid, SF_OTD* ocsp_telemetry_data);

void sf_otd_set_ocsp_request(const char *ocsp_req_b64, SF_OTD* ocsp_telemetry_data);

void sf_otd_set_event_sub_type(const char *ocsp_responder_url, SF_OTD* ocsp_telemetry_data);

void sf_otd_set_error_msg(const char *error_msg, SF_OTD* ocsp_telemetry_data);

void sf_otd_set_insecure_mode(const int insecure_mode, SF_OTD *ocsp_telemetry_data);

void sf_otd_set_fail_open_mode(const int failopen_mode, SF_OTD *ocsp_telemetry_data);

void sf_otd_set_cache_hit(const int cache_hit, SF_OTD *ocsp_telemetry_data);

void sf_otd_set_cache_enabled(const int cache_enabled, SF_OTD *ocsp_telemetry_data);

#endif //PROJECT_SF_OCSP_TELEMETRY_DATA_H
