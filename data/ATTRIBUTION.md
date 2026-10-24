# Dataset attribution

AI4I 2020 Predictive Maintenance Dataset [Dataset]. (2020). UCI Machine Learning Repository. DOI: [10.24432/C5HS5C](https://doi.org/10.24432/C5HS5C).

Source: [UCI dataset 601](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset). License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). The original CSV is redistributed unchanged. SHA-256 is recorded in `artifacts/model-report.json`.

UCI lists S. Matzka's 2020 paper, *Explainable Artificial Intelligence for Predictive Maintenance Applications*, as the introductory publication. The data is synthetic and does not establish field performance. UCI and the dataset authors do not endorse this project.

Transformations: only six sensor/product-type inputs enter the classifier. Type is encoded L=0, M=1, H=2. The binary Machine failure column is the target; identifiers and all failure-subtype columns are excluded. Splits are stratified with seed 42. The UI maps independent benchmark observations to six fictional assets; these IDs, production lines, replay arrival timestamps and maintenance decisions are demo metadata, not real plant measurements or longitudinal asset histories.

`runbooks.json` contains original illustrative procedures for this project. `example-events.jsonl` contains original example payloads. Neither is a manufacturer's operating manual. Retain this attribution if redistributing the CSV or derived dataset artifacts.
