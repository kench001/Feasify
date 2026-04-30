# Execution Scripts

Deterministic Python scripts that handle the actual work.

## Conventions
- Each script should be self-contained and importable
- Read config/secrets from `.env` via `python-dotenv`
- Use `argparse` or similar for CLI inputs when applicable
- Log clearly to stdout/stderr
- Exit with non-zero codes on failure
- Comment well — these are the system's muscles

## Dependencies
If a script needs a Python package, add it to `requirements.txt` in this directory.
