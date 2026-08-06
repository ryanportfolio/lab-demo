//! Writes data/policies.csv and data/meta.json, then prints a summary.
//! Deterministic: same seed, same bytes, every run.

use plab_core::{to_csv_line, CSV_HEADER};
use plab_datagen::{generate, summarize};
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

fn main() {
    let g = generate();
    let s = summarize(&g.rows);

    let out_dir = Path::new("data");
    fs::create_dir_all(out_dir).expect("create data dir");

    // CSV
    let mut csv = String::with_capacity(g.rows.len() * 80);
    csv.push_str(CSV_HEADER);
    csv.push('\n');
    for r in &g.rows {
        csv.push_str(&to_csv_line(r));
        csv.push('\n');
    }
    fs::write(out_dir.join("policies.csv"), &csv).expect("write csv");

    // Meta sidecar: true params echo + zone table + summary, hand-rolled JSON
    let mut j = String::new();
    let _ = writeln!(j, "{{");
    let _ = writeln!(j, "  \"seed\": \"0x{:X}\",", plab_datagen::SEED);
    let _ = writeln!(j, "  \"rows\": {},", s.rows);
    let _ = writeln!(j, "  \"beta0\": {:.6},", g.beta0);
    let _ = writeln!(j, "  \"exposure\": {:.2},", s.exposure);
    let _ = writeln!(j, "  \"claims\": {},", s.claims);
    let _ = writeln!(j, "  \"frequency\": {:.5},", s.frequency);
    let _ = writeln!(j, "  \"missing_mileage_pct\": {:.2},", s.missing_mileage_pct);
    let _ = writeln!(j, "  \"acc3_exposure_pct\": {:.2},", s.acc3_exposure_pct);
    let _ = writeln!(j, "  \"per_region_missing_pct\": {{");
    for (i, (reg, pct)) in s.per_region_missing_pct.iter().enumerate() {
        let comma = if i + 1 < s.per_region_missing_pct.len() { "," } else { "" };
        let _ = writeln!(j, "    \"{reg}\": {pct:.2}{comma}");
    }
    let _ = writeln!(j, "  }},");
    let _ = writeln!(j, "  \"zones\": [");
    for (i, (code, region, rows, exposure, claims)) in s.per_zone.iter().enumerate() {
        let comma = if i + 1 < s.per_zone.len() { "," } else { "" };
        let _ = writeln!(
            j,
            "    {{\"code\": \"{code}\", \"region\": \"{region}\", \"rows\": {rows}, \"exposure\": {exposure:.2}, \"claims\": {claims}, \"true_effect\": {:.5}}}{comma}",
            g.zone_true_effect[i]
        );
    }
    let _ = writeln!(j, "  ]");
    let _ = writeln!(j, "}}");
    fs::write(out_dir.join("meta.json"), &j).expect("write meta");

    println!("wrote data/policies.csv ({} rows) and data/meta.json", s.rows);
    println!(
        "exposure {:.0} car years, {} claims, frequency {:.4}",
        s.exposure, s.claims, s.frequency
    );
    println!(
        "missing mileage {:.1}% overall, by region: {}",
        s.missing_mileage_pct,
        s.per_region_missing_pct
            .iter()
            .map(|(r, p)| format!("{r} {p:.1}%"))
            .collect::<Vec<_>>()
            .join(", ")
    );
    println!("3+ prior accidents carry {:.2}% of exposure", s.acc3_exposure_pct);
    let thin: Vec<String> = s
        .per_zone
        .iter()
        .filter(|z| z.2 < 600)
        .map(|z| format!("{} ({} rows)", z.0, z.2))
        .collect();
    println!("credibility-thin zones: {}", thin.join(", "));
}
