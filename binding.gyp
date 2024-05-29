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
      ],
      "conditions": [
        [
          "OS==\"darwin\"",
          {
            "libraries": []
          }
        ],
        [
          "OS==\"win\"",
          {
            "libraries": []
          }
        ],
        [
          "OS==\"linux\"",
          {
            "libraries": []
          }
        ]
      ]
    }
  ]
}
