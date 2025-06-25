from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
import os
import json
from typing import List, Any, Optional
from uuid import uuid4
import logging

# -----------------------------------------------------------------------------
# Path configuration
# -----------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Ensure we reference the current project root (directory containing this file)
# rather than its parent; this prevents files from being written outside the
# workspace when the application is executed from the repository root.
PROJECT_ROOT = BASE_DIR

RAW_RESULTS_DIR = os.path.join(PROJECT_ROOT, "public", "results", "model-results")
PARSED_RESULTS_DIR = os.path.join(PROJECT_ROOT, "public", "results", "parsed")

# Ensure result directories exist so we don't fail on first write
os.makedirs(RAW_RESULTS_DIR, exist_ok=True)
os.makedirs(PARSED_RESULTS_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# FastAPI application setup
# -----------------------------------------------------------------------------

app = FastAPI(title="VLLM Evaluation Backend", version="0.1.0")

# Allow the frontend (likely served from a different port) to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with explicit origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# Pydantic models
# -----------------------------------------------------------------------------

class EvaluationPayload(BaseModel):
    """Incoming payload for both /raw_input and /standardized_output.

    * `run_id` can be omitted (None); we will auto-generate a UUID.
    * `data` may be any JSON-serialisable payload or a raw JSON string.
    """

    run_id: Optional[str] = None
    benchmark_name: str
    data: Any

    class Config:
        schema_extra = {
            "example": {
                "run_id": "None",
                "benchmark_name": "None",
                "data": "None",
            }
        }

# -----------------------------------------------------------------------------
# Helper utilities
# -----------------------------------------------------------------------------

def _compose_filename(benchmark_name: str, run_id: str) -> str:
    """Return the file name using the convention <benchmark_name>-<run_id>.json."""

    safe_benchmark = os.path.basename(benchmark_name)
    safe_run_id = os.path.basename(run_id)
    return f"{safe_benchmark}-{safe_run_id}.json"


def _write_json(path: str, payload: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def _read_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _list_json_files(directory: str) -> List[str]:
    return sorted([f for f in os.listdir(directory) if f.endswith(".json")])

# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------

@app.post("/raw_input")
async def post_raw_input(payload: EvaluationPayload):
    """Receive and persist raw benchmark results."""

    # If run_id is missing, use the literal string "None"
    run_id = payload.run_id or "None"

    filename = _compose_filename(payload.benchmark_name, run_id)
    file_path = os.path.join(RAW_RESULTS_DIR, filename)

    # Attempt to parse JSON strings so that stored files are always objects
    raw_data = payload.data
    if isinstance(raw_data, str):
        try:
            raw_data = json.loads(raw_data)
        except json.JSONDecodeError:
            pass  # leave as string

    _write_json(file_path, raw_data)

    return {"status": "success", "run_id": run_id, "saved_as": filename}


@app.post("/standardized_output")
async def post_standardized_output(payload: EvaluationPayload):
    """Receive and persist standardized/parsed benchmark results."""

    # If run_id is missing, use the literal string "None"
    run_id = payload.run_id or "None"

    filename = _compose_filename(payload.benchmark_name, run_id)
    file_path = os.path.join(PARSED_RESULTS_DIR, filename)

    raw_data = payload.data
    if isinstance(raw_data, str):
        try:
            raw_data = json.loads(raw_data)
        except json.JSONDecodeError:
            pass

    _write_json(file_path, raw_data)

    return {"status": "success", "run_id": run_id, "saved_as": filename}


# ----- Retrieval Endpoints ----------------------------------------------------

@app.get("/raw_input", response_model=List[str])
async def list_raw_input_files():
    """Return a list of raw input result files available on the server."""
    return _list_json_files(RAW_RESULTS_DIR)


@app.get("/standardized_output", response_model=List[str])
async def list_standardized_output_files():
    """Return a list of standardized output files available on the server."""
    return _list_json_files(PARSED_RESULTS_DIR)


@app.get("/raw_input/{file_name}")
async def get_raw_input_file(file_name: str):
    """Return the contents of a raw input result file."""
    file_name = os.path.basename(file_name)
    file_path = os.path.join(RAW_RESULTS_DIR, file_name)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return {"file_name": file_name, "data": _read_json(file_path)}


@app.get("/standardized_output/{file_name}")
async def get_standardized_output_file(file_name: str):
    """Return the contents of a standardized output result file."""
    file_name = os.path.basename(file_name)
    file_path = os.path.join(PARSED_RESULTS_DIR, file_name)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return {"file_name": file_name, "data": _read_json(file_path)}


@app.get("/api/results")
async def get_all_results():
    """Return all benchmark results in a standardized format."""
    results = []
    
    # Read all files from the parsed directory
    try:
        json_files = _list_json_files(PARSED_RESULTS_DIR)
        
        for file_name in json_files:
            try:
                file_path = os.path.join(PARSED_RESULTS_DIR, file_name)
                data = _read_json(file_path)
                
                # Extract metadata from the data or filename
                # Assuming the data has meta information or we can derive it from filename
                if 'meta' in data:
                    meta = data['meta']
                    result_entry = {
                        "pk": f"{meta.get('timestamp', '')}-{meta.get('benchmark_name', '')}-{meta.get('run_id', 'None')}",
                        "benchmark_name": meta.get('benchmark_name', ''),
                        "model_id": meta.get('model', {}).get('id', '') if isinstance(meta.get('model'), dict) else '',
                        "source": meta.get('model', {}).get('source', '') if isinstance(meta.get('model'), dict) else '',
                        "timestamp": meta.get('timestamp', ''),
                        "tokenizer_id": meta.get('model', {}).get('tokenizer_id', '') if isinstance(meta.get('model'), dict) else '',
                        "file_name": file_name  # Include file name for detail navigation
                    }
                else:
                    # Fallback: try to extract from filename pattern: benchmark-runid.json
                    parts = file_name.replace('.json', '').split('-')
                    benchmark_name = parts[0] if len(parts) > 0 else 'Unknown'
                    run_id = parts[1] if len(parts) > 1 else 'None'
                    
                    result_entry = {
                        "pk": f"unknown-{benchmark_name}-{run_id}",
                        "benchmark_name": benchmark_name,
                        "model_id": "unknown",
                        "source": "unknown",
                        "timestamp": "unknown",
                        "tokenizer_id": "unknown",
                        "file_name": file_name
                    }
                
                results.append(result_entry)
                
            except Exception as e:
                logging.error(f"Error processing file {file_name}: {e}")
                continue
                
    except Exception as e:
        logging.error(f"Error reading results directory: {e}")
    
    return results

# -----------------------------------------------------------------------------
# Health check (useful for k8s probes)
# -----------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {"status": "ok"}