"""Put a trained model online as a free Hugging Face Space (the same steps as
notebooks/bill_breaker_deploy.ipynb, sections 4 to 6, run from this machine).

    uv run --no-project --python 3.12 --with huggingface_hub --with requests \
        python ml/deploy_space.py --model ml/bill_breaker_model

Needs a one-time `hf auth login` with a write token. Prints the /explain URL that
the site reads as VITE_ML_ENDPOINT.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import requests
from huggingface_hub import HfApi

SPACE_DIR = Path(__file__).parent / "space"
SAMPLE = {
    "title": "Example bill",
    "text": "SEC. 1. SHORT TITLE. This Act may be cited as the Example Act. "
    "SEC. 2. STUDENT LOANS. The Secretary of Education shall reduce interest on "
    "federal student loans for borrowers enrolled at a college or university.",
    "profile": {"age": "18-24", "work": "college student"},
}


def space_host(space_repo: str) -> str:
    return "https://" + space_repo.lower().replace("/", "-").replace("_", "-").replace(".", "-") + ".hf.space"


def wait_until_up(api: HfApi, space_repo: str, host: str, minutes: int = 40) -> None:
    deadline = time.time() + minutes * 60
    while True:
        stage = api.get_space_runtime(space_repo).stage
        print("Space stage:", stage, flush=True)
        if stage in ("BUILD_ERROR", "RUNTIME_ERROR", "CONFIG_ERROR"):
            raise RuntimeError(f"Space stopped with {stage}: https://huggingface.co/spaces/{space_repo}")
        if stage == "RUNNING":
            try:
                if requests.get(host + "/", timeout=30).ok:
                    return
            except requests.RequestException:
                pass
        if time.time() > deadline:
            raise TimeoutError(f"Still starting after {minutes} minutes: https://huggingface.co/spaces/{space_repo}")
        time.sleep(20)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=Path, required=True, help="Folder written by ml/train.py")
    ap.add_argument("--model-name", default="bill-breaker-t5")
    ap.add_argument("--space-name", default="billbreaker")
    args = ap.parse_args()

    api = HfApi()
    user = api.whoami()["name"]
    model_repo, space_repo = f"{user}/{args.model_name}", f"{user}/{args.space_name}"

    api.create_repo(model_repo, exist_ok=True)
    api.upload_folder(repo_id=model_repo, folder_path=str(args.model),
                      commit_message="Bill Breaker fine-tuned FLAN-T5")
    print("Model: https://huggingface.co/" + model_repo, flush=True)

    api.create_repo(space_repo, repo_type="space", space_sdk="docker", exist_ok=True)
    api.add_space_variable(space_repo, "MODEL_ID", model_repo)
    api.upload_folder(repo_id=space_repo, repo_type="space", folder_path=str(SPACE_DIR),
                      ignore_patterns=["__pycache__/*", "*.pyc"],
                      commit_message="Bill Breaker model server")
    print("Space: https://huggingface.co/spaces/" + space_repo, flush=True)

    host = space_host(space_repo)
    wait_until_up(api, space_repo, host)
    reply = requests.post(host + "/explain", json=SAMPLE, timeout=900)
    reply.raise_for_status()
    print("Sample summary:", reply.json()["general"], flush=True)
    print("ENDPOINT", host + "/explain", flush=True)


if __name__ == "__main__":
    main()
