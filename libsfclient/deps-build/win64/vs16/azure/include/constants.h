#pragma once

namespace azure {  namespace storage_lite {  namespace constants {

#define DAT(x, y) extern const char *x; const int x ## _size{ sizeof(y) / sizeof(char) - 1 };
#include "constants.dat"
#undef DAT

}}}  // azure::storage_lite::constants