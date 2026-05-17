from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TOKEN_FILE = ROOT / "PUT_VERCEL_TOKEN_HERE.txt"
ENV_FILE = ROOT / ".env.local"
OUTPUT_FILE = ROOT / "vercel_deployment.json"
API_BASE = "https://api.vercel.com"


def read_token() -> str:
    token = TOKEN_FILE.read_text(encoding="utf-8").splitlines()[0].strip()
    if len(token) < 20 or token.startswith("PASTE_"):
        raise SystemExit("Vercel token looks missing. Put it on the first line of PUT_VERCEL_TOKEN_HERE.txt.")
    return token


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    if not ENV_FILE.exists():
        return env

    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()

    return env


def request_json(token: str, method: str, path: str, payload: dict | None = None) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read().decode("utf-8")
            return json.loads(data) if data else {}
    except urllib.error.HTTPError as error:
        data = error.read().decode("utf-8", errors="replace")
        try:
            details = json.loads(data)
        except json.JSONDecodeError:
            details = {"error": data}
        raise RuntimeError(f"{method} {path} failed with {error.code}: {details}") from error


def collect_files() -> list[dict[str, str]]:
    include_roots = [
        "index.html",
        "vercel.json",
        "requirements.txt",
        "api",
    ]
    ignored_names = {".DS_Store"}
    files: list[dict[str, str]] = []

    for item in include_roots:
        path = ROOT / item
        if not path.exists():
            continue
        if path.is_file():
            candidates = [path]
        else:
            candidates = [p for p in path.rglob("*") if p.is_file()]

        for candidate in candidates:
            if candidate.name in ignored_names:
                continue
            # Read as bytes then base64 or just text? Vercel API expects text for source files usually, 
            # but for images etc it might need more. Here we only have text files.
            try:
                content = candidate.read_text(encoding="utf-8")
                files.append(
                    {
                        "file": candidate.relative_to(ROOT).as_posix(),
                        "data": content,
                    }
                )
            except Exception:
                # Skip binary files for now as this script is simplified
                continue

    return files


def main() -> None:
    token = read_token()
    env = read_env()
    project_name = f"offerglow-pro-{time.strftime('%m%d%H%M')}"

    print("Checking Vercel account...")
    request_json(token, "GET", "/v2/user")

    print(f"Creating Vercel project: {project_name}")
    project = request_json(
        token,
        "POST",
        "/v10/projects",
        {
            "name": project_name,
            "framework": None,
        },
    )

    project_id = project.get("id") or project_name
    targets = ["production", "preview", "development"]
    for key in ("DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL"):
        value = env.get(key)
        if not value:
            continue
        print(f"Adding environment variable: {key}")
        request_json(
            token,
            "POST",
            f"/v10/projects/{project_id}/env",
            {
                "key": key,
                "value": value,
                "type": "encrypted",
                "target": targets,
            },
        )

    print("Uploading source files and starting production deployment...")
    deployment = request_json(
        token,
        "POST",
        "/v13/deployments",
        {
            "name": project_name,
            "project": project_id,
            "target": "production",
            "files": collect_files(),
        },
    )

    deployment_id = deployment.get("id")
    url = deployment.get("url")
    if not deployment_id:
        raise SystemExit(f"Deployment was created but no id was returned: {deployment}")

    print("Waiting for Vercel build...")
    status = deployment.get("readyState")
    for _ in range(90):
        if status in {"READY", "ERROR", "CANCELED"}:
            break
        time.sleep(4)
        current = request_json(token, "GET", f"/v13/deployments/{deployment_id}")
        status = current.get("readyState")
        url = current.get("url") or url
        print(f"Build status: {status}")

    if status != "READY":
        raise SystemExit(f"Vercel deployment did not finish successfully. Final status: {status}")

    final_url = f"https://{url}"
    print(f"DEPLOYMENT_URL={final_url}")
    OUTPUT_FILE.write_text(
        json.dumps(
            {
                "projectName": project_name,
                "projectId": project_id,
                "deploymentId": deployment_id,
                "url": final_url,
                "createdAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    try:
        TOKEN_FILE.unlink()
    except OSError:
        pass


if __name__ == "__main__":
    main()
