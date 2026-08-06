//! Guardrail computation. This module is the answer to "is the agent grading
//! its own homework": every number here derives from fit artifacts inside
//! the platform, and the agent crate cannot import this module.

use plab_core::protocol::GuardrailOutcome;
use plab_core::{zone_code, PolicyRow, N_ZONES};

#[derive(Debug, Clone, Copy)]
pub struct GuardrailConfig {
    pub budget_limit: u32,
    pub territory_limit_pct: f64,
    pub folds_required: u32,
}

impl Default for GuardrailConfig {
    fn default() -> Self {
        GuardrailConfig {
            budget_limit: 2,
            territory_limit_pct: 5.0,
            folds_required: 5,
        }
    }
}

/// Direct relativity movement: the relativities themselves changed (EXP-03).
/// Returns (max percent movement, worst zone code).
pub fn direct_territory_movement(filed: &[f64], proposed: &[f64]) -> (f64, String) {
    let mut worst = (0.0f64, 0usize);
    for z in 0..N_ZONES {
        let m = (proposed[z] / filed[z] - 1.0).abs() * 100.0;
        if m > worst.0 {
            worst = (m, z);
        }
    }
    (worst.0, zone_code(worst.1 as u8))
}

/// Indirect dislocation: relativities frozen, but the new factors spread
/// unevenly across zones, so the exposure-weighted average predicted rate
/// inside a zone still drifts. This is what a dislocation report and a
/// regulator actually see. Inputs are predicted claim counts per row under
/// the candidate and the baseline.
pub fn indirect_territory_movement(
    rows: &[&PolicyRow],
    mu_candidate: &[f64],
    mu_baseline: &[f64],
) -> (f64, String) {
    assert_eq!(rows.len(), mu_candidate.len());
    assert_eq!(rows.len(), mu_baseline.len());
    let mut cand = vec![0.0f64; N_ZONES];
    let mut base = vec![0.0f64; N_ZONES];
    for (i, r) in rows.iter().enumerate() {
        let z = r.territory as usize;
        cand[z] += mu_candidate[i];
        base[z] += mu_baseline[i];
    }
    let mut worst = (0.0f64, 0usize);
    for z in 0..N_ZONES {
        if base[z] <= 0.0 {
            continue;
        }
        let m = (cand[z] / base[z] - 1.0).abs() * 100.0;
        if m > worst.0 {
            worst = (m, z);
        }
    }
    (worst.0, zone_code(worst.1 as u8))
}

pub fn assemble(
    config: &GuardrailConfig,
    new_factors: u32,
    territory_movement_pct: f64,
    territory_worst_zone: String,
    territory_direct: bool,
    fold_deltas: &[f64],
) -> GuardrailOutcome {
    let folds_held = fold_deltas.iter().filter(|d| **d > 0.0).count() as u32;
    GuardrailOutcome {
        budget_used: new_factors,
        budget_limit: config.budget_limit,
        budget_ok: new_factors <= config.budget_limit,
        territory_movement_pct,
        territory_worst_zone,
        territory_direct,
        territory_limit_pct: config.territory_limit_pct,
        territory_ok: territory_movement_pct <= config.territory_limit_pct,
        folds_required: config.folds_required,
        folds_held,
        folds_ok: folds_held >= config.folds_required,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn direct_movement_finds_worst_zone() {
        let filed = vec![1.0; N_ZONES];
        let mut proposed = vec![1.0; N_ZONES];
        proposed[13] = 1.114; // T-114
        proposed[5] = 0.95;
        let (m, zone) = direct_territory_movement(&filed, &proposed);
        assert!((m - 11.4).abs() < 1e-9);
        assert_eq!(zone, "T-114");
    }

    #[test]
    fn frozen_relativities_move_zero_directly() {
        let filed = vec![1.1; N_ZONES];
        let (m, _) = direct_territory_movement(&filed, &filed.clone());
        assert_eq!(m, 0.0);
    }

    #[test]
    fn folds_held_counts_strict_positives() {
        let cfg = GuardrailConfig::default();
        let out = assemble(&cfg, 1, 0.0, "T-101".into(), false, &[0.001, 0.0, -0.002, 0.004, 0.0005]);
        assert_eq!(out.folds_held, 3);
        assert!(!out.folds_ok);
        assert!(out.budget_ok);
    }
}
