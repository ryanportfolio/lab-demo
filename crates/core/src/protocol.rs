//! The contract between the platform and the agent. The agent crate sees
//! ONLY these types: already-computed fit summaries, guardrail outcomes, and
//! data profile facts. It cannot compute a guardrail number because it never
//! sees a fit artifact, a dataset row, or the fit crate.

/// What an experiment proposes to change, structurally. The platform maps
/// this to a concrete model spec; the agent never touches design matrices.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Archetype {
    SplineAge,
    InteractionAgeVehicle,
    CredibilityTerritory,
    CappedAccidents,
    NegBinomialFamily,
    MileageBands,
    ComboSplineAccidents,
}

#[derive(Debug, Clone)]
pub struct ExperimentPlan {
    pub code: &'static str,
    pub name: &'static str,
    pub hypothesis: &'static str,
    /// Plain-terms gloss for the hypothesis layer, vetted phrasing
    pub archetype: Archetype,
    /// New rating factors this plan spends against the budget. A spline that
    /// replaces a banded factor still counts.
    pub new_factors: u32,
    pub factor_names: &'static [&'static str],
    /// Wave ordering hint for the console
    pub wave: u8,
    /// Set when the agent derived this plan from earlier results
    pub lineage: Option<String>,
}

/// Everything the platform computed from one experiment's fits. All numbers
/// are real fit outputs; the agent only reads them.
#[derive(Debug, Clone, Default)]
pub struct FitSummary {
    pub gini: f64,
    pub delta_gini: f64,
    /// percent change vs baseline deviance, negative = error shrank;
    /// None when families differ (deviance is not comparable across families)
    pub deviance_change_pct: Option<f64>,
    /// AIC minus baseline AIC, negative = preferred; the only cross-family
    /// comparison we display
    pub aic_delta: Option<f64>,
    pub fold_deltas: Vec<f64>,
    pub folds_pass: Vec<bool>,
    pub budget_used: u32,
}

/// Guardrail outcomes, computed by the platform outside the agent.
#[derive(Debug, Clone, Default)]
pub struct GuardrailOutcome {
    pub budget_used: u32,
    pub budget_limit: u32,
    pub budget_ok: bool,
    /// Largest per-zone movement in percent. Direct = the relativities
    /// themselves moved (EXP-03); indirect = zone-level average rate drift
    /// with relativities frozen (dislocation).
    pub territory_movement_pct: f64,
    pub territory_worst_zone: String,
    pub territory_direct: bool,
    pub territory_limit_pct: f64,
    pub territory_ok: bool,
    pub folds_required: u32,
    pub folds_held: u32,
    pub folds_ok: bool,
}

/// Dataset facts from the platform profiler, the inputs to scrap-before-fit
/// decisions.
#[derive(Debug, Clone, Default)]
pub struct DataProfileFacts {
    pub rows: u64,
    pub mileage_missing_pct: f64,
    pub mileage_missing_region_min_pct: f64,
    pub mileage_missing_region_max_pct: f64,
    pub acc3_exposure_pct: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Disposition {
    Candidate,
    Scrapped,
    Winner,
    Absorbed,
}

impl Disposition {
    pub fn tag(self) -> &'static str {
        match self {
            Disposition::Candidate => "Candidate",
            Disposition::Scrapped => "Scrapped",
            Disposition::Winner => "Winner",
            Disposition::Absorbed => "Absorbed",
        }
    }
}

/// The agent's written output for one experiment: dense expert layer plus a
/// plain-terms gloss. Both layers carry the same real numbers.
#[derive(Debug, Clone)]
pub struct Verdict {
    pub disposition: Disposition,
    /// text after the tag, e.g. "lift holds across all five folds"
    pub expert_text: String,
    pub gloss_text: String,
    pub lineage: Option<String>,
}

/// The agent's review summary, expert paragraphs plus one gloss.
#[derive(Debug, Clone)]
pub struct ReviewSummary {
    pub paragraphs: Vec<String>,
    pub gloss: String,
}
