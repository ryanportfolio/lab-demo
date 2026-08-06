pub mod executor;
pub mod filing;
pub mod guardrails;
pub mod profile;

use plab_core::PolicyRow;
use std::path::Path;

/// Load the generated dataset, regenerating it in-process when the CSV is
/// absent (both paths are deterministic and identical).
pub fn load_rows(csv_path: &Path) -> Result<Vec<PolicyRow>, String> {
    match std::fs::read_to_string(csv_path) {
        Ok(content) => plab_core::read_csv(&content),
        Err(_) => Ok(plab_datagen::generate().rows),
    }
}
