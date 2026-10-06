import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

_DEFAULT_LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"

LOG_FORMAT = "%(asctime)s [%(levelname)s] [%(name)s]: %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Updated inside setup_logging() so importers see the active directory.
LOGS_DIR = _DEFAULT_LOGS_DIR

_configured = False


def resolve_logs_dir() -> Path:
    override = os.environ.get("CAREGIVER_LOGS_DIR")
    if override:
        return Path(override)
    return _DEFAULT_LOGS_DIR


def error_fingerprint(exception_type: str, method: str, path: str) -> str:
    return f"{exception_type}|{method}|{path}"


class JsonErrorFormatter(logging.Formatter):
    """One JSON object per line for error.log triage."""

    def format(self, record: logging.LogRecord) -> str:
        utc_dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        iso_str = utc_dt.isoformat().replace("+00:00", "Z")
        occurred_at_str = utc_dt.strftime("%Y-%m-%d %H:%M:%S UTC")

        payload = {
            "occurred_at": occurred_at_str,
            "timestamp": iso_str,
            "ts": iso_str,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
            "method": getattr(record, "method", None),
            "path": getattr(record, "path", None),
            "exception_type": getattr(record, "exception_type", None),
            "fingerprint": getattr(record, "fingerprint", None),
        }

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
            if not payload["exception_type"] and record.exc_info[0] is not None:
                payload["exception_type"] = record.exc_info[0].__name__

        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging() -> logging.Logger:
    global _configured, LOGS_DIR
    if _configured:
        return logging.getLogger("app")

    LOGS_DIR = resolve_logs_dir()
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Suppress verbose outbound HTTP client request spam from third-party libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    # 1. Console handler
    has_console = any(
        isinstance(h, logging.StreamHandler) and not isinstance(h, RotatingFileHandler)
        for h in root_logger.handlers
    )
    if not has_console:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    # 2. Rotating File Handler for general application logs (app.log)
    app_log_file = LOGS_DIR / "app.log"
    app_file_handler = RotatingFileHandler(
        filename=str(app_log_file),
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=5,
        encoding="utf-8",
    )
    app_file_handler.setLevel(logging.INFO)
    app_file_handler.setFormatter(formatter)
    root_logger.addHandler(app_file_handler)

    # 3. Rotating File Handler for dedicated HTTP access logs (access.log)
    access_log_file = LOGS_DIR / "access.log"
    access_file_handler = RotatingFileHandler(
        filename=str(access_log_file),
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=5,
        encoding="utf-8",
    )
    access_file_handler.setLevel(logging.INFO)
    access_file_handler.setFormatter(formatter)
    access_logger = logging.getLogger("app.access")
    access_logger.setLevel(logging.INFO)
    access_logger.addHandler(access_file_handler)
    # Prevent request lines from duplicating into root handlers / app.log
    access_logger.propagate = False

    # 4. Rotating File Handler for ERROR-only triage (error.log, JSON lines)
    error_log_file = LOGS_DIR / "error.log"
    error_file_handler = RotatingFileHandler(
        filename=str(error_log_file),
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=5,
        encoding="utf-8",
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(JsonErrorFormatter())
    root_logger.addHandler(error_file_handler)

    _configured = True
    app_logger = logging.getLogger("app")
    app_logger.info("Logging initialized. Logs written to %s", LOGS_DIR)
    return app_logger


def reset_logging_for_tests() -> logging.Logger:
    """Clear root handlers and re-run setup. Tests only."""
    global _configured
    root = logging.getLogger()
    for handler in root.handlers[:]:
        root.removeHandler(handler)
        handler.close()

    acc_logger = logging.getLogger("app.access")
    for handler in acc_logger.handlers[:]:
        acc_logger.removeHandler(handler)
        handler.close()

    _configured = False
    return setup_logging()
