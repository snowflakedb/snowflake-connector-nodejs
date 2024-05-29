#pragma once

#ifdef _WIN32
#define AZURE_STORAGE_API __declspec(dllexport)
#else /* ifdef _WIN32 */
#define AZURE_STORAGE_API
#endif
