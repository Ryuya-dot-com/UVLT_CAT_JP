# UVLT CAT JP — public technical demonstration

Japanese-L1 calibration, N=463; M3 Rasch testlet model with band-specific testlet variances. This standalone CAT uses the exact bank and scoring engine from the existing Japanese development app. It does not activate the prospective crossover study, alter its consent/collection gates, or authorize research recruitment. Every export is labelled `public_technical_demo`.

Public page: https://ryuya-dot-com.github.io/UVLT_CAT_JP/

Researcher notes: https://ryuya-dot-com.github.io/UVLT_CAT_JP/researcher.html

## Run and check

Node.js (no dependencies): `npm test`.

Serve locally: `python3 -m http.server 8768 --bind 127.0.0.1`.

Open http://127.0.0.1:8768/ . Two unscored practice testlets precede the CAT. The app applies the original EPVR selection from the first set, EAP with 15-point Gauss–Hermite integration, the original JP prior and theta grid, and the development rule min=6, max=14, posterior SD<=.48. There is no time cap or forced initial 4K set. User-requested termination keeps partial choices unscored. Recorded elapsed time includes background-tab time.

The underlying calibration and stopping settings are provisional, not operationally frozen. Intervals and precision are conditional on calibration point estimates. This is not the 2PL JP/VN comparison app, and its theta scale is not directly interchangeable with the Vietnamese-calibrated legacy CAT. No mastery classification, estimated vocabulary size, or TOEIC conversion is provided.

## Publication and data

The owner explicitly approved publication to `Ryuya-dot-com/UVLT_CAT_JP` and its GitHub Pages site on 2026-10-01, including Version B stimuli/options/answer keys and aggregate JP463 item/testlet parameters, acknowledging that anyone can retrieve those public files. The release contains no participant-level source data. Publication does not grant a new license to third-party UVLT material. The bank is copied byte-for-byte, preserving `developmentOnly: true` and `operationallyFrozen: false`.

Version 0.2.0 requires a participant name and student ID before practice and automatically starts a CSV download at completion or user-requested termination. Both CSV and optional JSON contain the entered identity. The filename contains only a random session ID. Missing identity prevents starting; text IDs retain their leading zeros in the CSV text, and formula-like input is escaped for spreadsheet safety. A result-screen button retries the same CSV if downloading is blocked.

Identity and responses stay in memory only: they are not automatically transmitted or persisted to browser storage. Reloading loses unsaved progress. Downloaded files do not include question text or answer keys. JSON includes model settings, bank hash, estimates, termination conditions and any unscored partial set. CSV schema `uvlt-jp-cat-result-2` includes identity, session timestamps and scored item rows. If there are no scored responses, one `session_summary` row preserves the identity and termination metadata with blank item fields. Normal hosting access logs are separate from response collection. Participant-facing text is limited to instructions and saving results; measurement caveats remain on the researcher page.

`manifest.json` identifies the exact release and source hashes. `build.py` refreshes byte-identical copies of the existing bank, scorer and practice and then hashes an explicit public file list. Publish only that allowlist plus manifest, tests, package metadata, and the CI workflow. Never publish the parent research workspace, source workbooks, raw responses, or restricted runtime.
