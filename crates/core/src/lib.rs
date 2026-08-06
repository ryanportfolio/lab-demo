//! Shared domain types for the Prediction Lab experiments build.
//! Zero external dependencies so `datagen` and `fit` stay lean; the server
//! layer adds serde on its own structs.

pub mod protocol;

/// One synthetic auto policy record. Column order here is the CSV column order.
#[derive(Debug, Clone, PartialEq)]
pub struct PolicyRow {
    pub policy_id: u32,
    pub driver_age: u8,
    pub vehicle_age: u8,
    pub prior_accidents: u8,
    /// Zone index into [`ZONES`]; code is `T-1xx`.
    pub territory: u8,
    pub vehicle_use: VehicleUse,
    pub marital_status: Marital,
    pub homeowner: bool,
    pub multi_policy: bool,
    pub credit_tier: CreditTier,
    pub safe_driver: bool,
    /// None = missing (missing-not-at-random by design).
    pub annual_mileage: Option<f64>,
    pub earned_exposure: f64,
    pub period: Period,
    pub claim_count: u8,
    /// CV fold 0..4 for training periods, None for the out-of-time holdout.
    pub fold: Option<u8>,
}

impl PolicyRow {
    pub fn territory_code(&self) -> String {
        zone_code(self.territory)
    }
    pub fn region(&self) -> &'static str {
        ZONES[self.territory as usize].region
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VehicleUse {
    Pleasure,
    Commute,
    Business,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Marital {
    Single,
    Married,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CreditTier {
    A,
    B,
    C,
    D,
}

/// Half-year cohorts. 2025H2 is the out-of-time holdout everywhere.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Period {
    Y2023H1,
    Y2023H2,
    Y2024H1,
    Y2024H2,
    Y2025H1,
    Y2025H2,
}

pub const PERIODS: [Period; 6] = [
    Period::Y2023H1,
    Period::Y2023H2,
    Period::Y2024H1,
    Period::Y2024H2,
    Period::Y2025H1,
    Period::Y2025H2,
];

pub const HOLDOUT_PERIOD: Period = Period::Y2025H2;
pub const N_FOLDS: u8 = 5;

impl VehicleUse {
    pub fn as_str(self) -> &'static str {
        match self {
            VehicleUse::Pleasure => "pleasure",
            VehicleUse::Commute => "commute",
            VehicleUse::Business => "business",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "pleasure" => Some(Self::Pleasure),
            "commute" => Some(Self::Commute),
            "business" => Some(Self::Business),
            _ => None,
        }
    }
}

impl Marital {
    pub fn as_str(self) -> &'static str {
        match self {
            Marital::Single => "single",
            Marital::Married => "married",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "single" => Some(Self::Single),
            "married" => Some(Self::Married),
            _ => None,
        }
    }
}

impl CreditTier {
    pub fn as_str(self) -> &'static str {
        match self {
            CreditTier::A => "A",
            CreditTier::B => "B",
            CreditTier::C => "C",
            CreditTier::D => "D",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "A" => Some(Self::A),
            "B" => Some(Self::B),
            "C" => Some(Self::C),
            "D" => Some(Self::D),
            _ => None,
        }
    }
}

impl Period {
    pub fn as_str(self) -> &'static str {
        match self {
            Period::Y2023H1 => "2023H1",
            Period::Y2023H2 => "2023H2",
            Period::Y2024H1 => "2024H1",
            Period::Y2024H2 => "2024H2",
            Period::Y2025H1 => "2025H1",
            Period::Y2025H2 => "2025H2",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        PERIODS.iter().copied().find(|p| p.as_str() == s)
    }
    pub fn is_holdout(self) -> bool {
        self == HOLDOUT_PERIOD
    }
}

/// Static zone table: code suffix is 101 + index. Weights are relative
/// sampling weights; a few zones are deliberately credibility-thin.
pub struct Zone {
    pub region: &'static str,
    pub weight: f64,
}

pub const ZONES: [Zone; 30] = [
    // R1, skews young, higher accident propensity
    Zone { region: "R1", weight: 5.0 },
    Zone { region: "R1", weight: 3.2 },
    Zone { region: "R1", weight: 1.1 },
    Zone { region: "R1", weight: 0.18 },
    Zone { region: "R1", weight: 2.4 },
    Zone { region: "R1", weight: 6.5 },
    // R2
    Zone { region: "R2", weight: 4.1 },
    Zone { region: "R2", weight: 2.7 },
    Zone { region: "R2", weight: 0.9 },
    Zone { region: "R2", weight: 3.3 },
    Zone { region: "R2", weight: 0.22 },
    Zone { region: "R2", weight: 5.2 },
    // R3
    Zone { region: "R3", weight: 7.0 },
    Zone { region: "R3", weight: 4.4 },
    Zone { region: "R3", weight: 2.1 },
    Zone { region: "R3", weight: 1.4 },
    Zone { region: "R3", weight: 0.35 },
    Zone { region: "R3", weight: 3.8 },
    // R4
    Zone { region: "R4", weight: 3.6 },
    Zone { region: "R4", weight: 2.2 },
    Zone { region: "R4", weight: 1.7 },
    Zone { region: "R4", weight: 0.28 },
    Zone { region: "R4", weight: 4.9 },
    Zone { region: "R4", weight: 2.9 },
    // R5, skews old, lower accident propensity
    Zone { region: "R5", weight: 2.8 },
    Zone { region: "R5", weight: 1.9 },
    Zone { region: "R5", weight: 0.15 },
    Zone { region: "R5", weight: 3.1 },
    Zone { region: "R5", weight: 2.3 },
    Zone { region: "R5", weight: 1.6 },
];

pub const N_ZONES: usize = ZONES.len();
pub const REGIONS: [&str; 5] = ["R1", "R2", "R3", "R4", "R5"];

pub fn zone_code(idx: u8) -> String {
    format!("T-{}", 101 + idx as usize)
}

pub fn zone_index(code: &str) -> Option<u8> {
    let n: usize = code.strip_prefix("T-")?.parse().ok()?;
    let idx = n.checked_sub(101)?;
    if idx < N_ZONES {
        Some(idx as u8)
    } else {
        None
    }
}

pub fn region_index(region: &str) -> Option<usize> {
    REGIONS.iter().position(|r| *r == region)
}

// ---------------------------------------------------------------------------
// CSV round trip, hand rolled so nothing below the server needs serde
// ---------------------------------------------------------------------------

pub const CSV_HEADER: &str = "policy_id,driver_age,vehicle_age,prior_accidents,territory,vehicle_use,marital_status,homeowner,multi_policy,credit_tier,safe_driver,annual_mileage,earned_exposure,period,claim_count,fold";

pub fn to_csv_line(r: &PolicyRow) -> String {
    format!(
        "{},{},{},{},{},{},{},{},{},{},{},{},{:.4},{},{},{}",
        r.policy_id,
        r.driver_age,
        r.vehicle_age,
        r.prior_accidents,
        r.territory_code(),
        r.vehicle_use.as_str(),
        r.marital_status.as_str(),
        r.homeowner as u8,
        r.multi_policy as u8,
        r.credit_tier.as_str(),
        r.safe_driver as u8,
        r.annual_mileage.map(|m| format!("{:.1}", m)).unwrap_or_default(),
        r.earned_exposure,
        r.period.as_str(),
        r.claim_count,
        r.fold.map(|f| f.to_string()).unwrap_or_default(),
    )
}

pub fn from_csv_line(line: &str) -> Result<PolicyRow, String> {
    let f: Vec<&str> = line.split(',').collect();
    if f.len() != 16 {
        return Err(format!("expected 16 fields, got {}", f.len()));
    }
    let err = |what: &str| format!("bad {what} in: {line}");
    Ok(PolicyRow {
        policy_id: f[0].parse().map_err(|_| err("policy_id"))?,
        driver_age: f[1].parse().map_err(|_| err("driver_age"))?,
        vehicle_age: f[2].parse().map_err(|_| err("vehicle_age"))?,
        prior_accidents: f[3].parse().map_err(|_| err("prior_accidents"))?,
        territory: zone_index(f[4]).ok_or_else(|| err("territory"))?,
        vehicle_use: VehicleUse::parse(f[5]).ok_or_else(|| err("vehicle_use"))?,
        marital_status: Marital::parse(f[6]).ok_or_else(|| err("marital_status"))?,
        homeowner: f[7] == "1",
        multi_policy: f[8] == "1",
        credit_tier: CreditTier::parse(f[9]).ok_or_else(|| err("credit_tier"))?,
        safe_driver: f[10] == "1",
        annual_mileage: if f[11].is_empty() {
            None
        } else {
            Some(f[11].parse().map_err(|_| err("annual_mileage"))?)
        },
        earned_exposure: f[12].parse().map_err(|_| err("earned_exposure"))?,
        period: Period::parse(f[13]).ok_or_else(|| err("period"))?,
        claim_count: f[14].parse().map_err(|_| err("claim_count"))?,
        fold: if f[15].is_empty() {
            None
        } else {
            Some(f[15].parse().map_err(|_| err("fold"))?)
        },
    })
}

pub fn read_csv(content: &str) -> Result<Vec<PolicyRow>, String> {
    let mut lines = content.lines();
    match lines.next() {
        Some(h) if h == CSV_HEADER => {}
        _ => return Err("missing or wrong CSV header".into()),
    }
    lines.filter(|l| !l.is_empty()).map(from_csv_line).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_round_trip() {
        let r = PolicyRow {
            policy_id: 42,
            driver_age: 34,
            vehicle_age: 7,
            prior_accidents: 2,
            territory: 13,
            vehicle_use: VehicleUse::Commute,
            marital_status: Marital::Single,
            homeowner: true,
            multi_policy: false,
            credit_tier: CreditTier::B,
            safe_driver: true,
            annual_mileage: Some(12345.6),
            earned_exposure: 0.75,
            period: Period::Y2024H2,
            claim_count: 1,
            fold: Some(3),
        };
        let back = from_csv_line(&to_csv_line(&r)).unwrap();
        assert_eq!(r, back);
        assert_eq!(r.territory_code(), "T-114");
        assert_eq!(r.region(), "R3");
    }

    #[test]
    fn csv_round_trip_missing_fields() {
        let r = PolicyRow {
            policy_id: 1,
            driver_age: 80,
            vehicle_age: 0,
            prior_accidents: 0,
            territory: 0,
            vehicle_use: VehicleUse::Pleasure,
            marital_status: Marital::Married,
            homeowner: false,
            multi_policy: true,
            credit_tier: CreditTier::D,
            safe_driver: false,
            annual_mileage: None,
            earned_exposure: 1.0,
            period: Period::Y2025H2,
            claim_count: 0,
            fold: None,
        };
        let back = from_csv_line(&to_csv_line(&r)).unwrap();
        assert_eq!(r, back);
        assert!(r.period.is_holdout());
    }

    #[test]
    fn zone_codes_invert() {
        for i in 0..N_ZONES as u8 {
            assert_eq!(zone_index(&zone_code(i)), Some(i));
        }
        assert_eq!(zone_index("T-100"), None);
        assert_eq!(zone_index("T-131"), None);
    }
}
