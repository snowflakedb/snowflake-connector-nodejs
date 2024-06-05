{
  "targets": [
    {
      "target_name": "generic_driver",
      "sources": [
        "bindings.cc"
      ],
      "include_dirs": [
        "libsfclient/include"
      ],
      "libraries": [],
      "conditions": [
        [
          "OS==\"mac\"",
          {
            "libraries": [
              "<(module_root_dir)/libsfclient/lib/darwin/libsnowflakeclient.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/arrow/lib/libarrow.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/arrow_deps/lib/libjemalloc.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/arrow_deps/lib/libjemalloc_pic.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/aws/lib/libaws-cpp-sdk-core.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/aws/lib/libaws-cpp-sdk-s3.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/azure/lib/libazure-storage-lite.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/boost/lib/libboost_filesystem.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/boost/lib/libboost_regex.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/boost/lib/libboost_system.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/curl/lib/libcurl.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/oob/lib/libtelemetry.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/openssl/lib/libcrypto.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/openssl/lib/libssl.a",
              "<(module_root_dir)/libsfclient/deps-build/darwin/zlib/lib/libz.a"
            ]
          }
        ],
        [
          "OS==\"win\"",
          {
            "libraries": [
              "<(module_root_dir)/libsfclient/lib/win64/vs16/libsnowflakeclient.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/arrow/lib/arrow_static.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/aws/lib/libaws-cpp-sdk-core.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/aws/lib/libaws-cpp-sdk-s3.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/azure/lib/libazure-storage-lite.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/boost/lib/libboost_filesystem.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/boost/lib/libboost_regex.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/boost/lib/libboost_system.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/curl/lib/libcurl_a.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/oob/lib/libtelemetry_a.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/openssl/lib/libcrypto_a.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/openssl/lib/libssl_a.lib",
              "<(module_root_dir)/libsfclient/deps-build/win64/vs16/zlib/lib/libz_a.lib"
            ]
          }
        ],
        [
          "OS==\"linux\"",
          {
            "libraries": [
              "<(module_root_dir)/libsfclient/lib/linux/libsnowflakeclient.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/arrow/lib/libarrow.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/arrow_deps/lib/libjemalloc.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/arrow_deps/lib/libjemalloc_pic.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/aws/lib64/libaws-cpp-sdk-core.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/aws/lib64/libaws-cpp-sdk-s3.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/azure/lib/libazure-storage-lite.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/boost/lib/libboost_filesystem.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/boost/lib/libboost_regex.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/boost/lib/libboost_system.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/curl/lib/libcurl.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/oob/lib/libtelemetry.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/openssl/lib/libcrypto.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/openssl/lib/libssl.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/uuid/lib/libuuid.a",
              "<(module_root_dir)/libsfclient/deps-build/linux/zlib/lib/libz.a"
            ]
          }
        ]
      ]
    }
  ]
}