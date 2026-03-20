use napi_derive::napi;

#[napi]
pub fn sf_core_full_version() -> &'static str {
	"0.0.1"
}
