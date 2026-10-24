"""Re-download the attributed public benchmark without third-party mirrors."""

import hashlib
import io
import urllib.request
import zipfile
from backend.ml import ROOT

URL = "https://archive.ics.uci.edu/static/public/601/ai4i+2020+predictive+maintenance+dataset.zip"
with urllib.request.urlopen(URL, timeout=45) as response:
    content = zipfile.ZipFile(io.BytesIO(response.read())).read("ai4i2020.csv")
(ROOT / "data").mkdir(exist_ok=True)
(ROOT / "data/ai4i2020.csv").write_bytes(content)
print("Downloaded UCI AI4I; SHA-256:", hashlib.sha256(content).hexdigest())
