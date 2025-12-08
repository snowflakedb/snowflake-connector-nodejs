This is an experimental telemetry core written in Rust.

We use [napi-rs](https://napi.rs/docs/cross-build) to build native Node.js addons from Rust code. Currently, the `.node` files are compiled manually on developer machines and stored in the repository.

In the future, we plan to move the entire core into a separate child package (or multiple packages based on platform and architecture).
