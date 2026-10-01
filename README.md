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

The standalone page requests no participant name or student ID. It keeps responses in memory only and does not automatically transmit them or persist them to browser storage. Reloading loses unsaved progress. Optional JSON and CSV downloads stay with the user; they do not include question text or answer keys. JSON includes model settings, bank hash, estimates, termination conditions and any unscored partial set. CSV contains scored item rows only. Normal hosting access logs are separate from response collection.

`manifest.json` identifies the exact release and source hashes. `build.py` refreshes byte-identical copies of the existing bank, scorer and practice and then hashes an explicit public file list. Publish only that allowlist plus manifest, tests, package metadata, and the CI workflow. Never publish the parent research workspace, source workbooks, raw responses, or restricted runtime.
