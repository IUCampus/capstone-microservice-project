import os
import sys
import socket
import subprocess
import threading
import time
import io
from pathlib import Path
from typing import Optional
import shutil

from dotenv import load_dotenv
from flask import Flask, jsonify, request, make_response
from flask_cors import CORS

from common import init_db_and_redis, ensure_indexes_db

# import blueprints
from blueprints.users import users_bp
from blueprints.movies import movies_bp
from blueprints.bookings import bookings_bp
from blueprints.payments import payments_bp
from blueprints.reviews import reviews_bp

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "config.example"))

# Add this near the top-level (after imports)
START_FRONTEND = os.getenv("START_FRONTEND", "1") == "1"


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}}, supports_credentials=True)

    # load config into app.config for convenience
    app.config["HOLD_TTL_SECONDS"] = int(os.environ.get("HOLD_TTL_SECONDS", 600))
    app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET")
    app.config["LUA_PATH"] = os.path.join(os.path.dirname(__file__), "hold_seats.lua")

    mc, mdb, r, hold_seats_sha = init_db_and_redis(app)
    ensure_indexes_db(mdb)

    app.mongodb_client = mc
    app.mdb = mdb
    app.redis = r
    app.hold_seats_sha = hold_seats_sha

    app.register_blueprint(users_bp, url_prefix="/users")
    app.register_blueprint(movies_bp, url_prefix="/movies")
    app.register_blueprint(bookings_bp, url_prefix="/bookings")
    app.register_blueprint(payments_bp, url_prefix="/payments")
    app.register_blueprint(reviews_bp, url_prefix="/reviews")

    @app.route("/screenings/<string:screening_id>", methods=["GET", "OPTIONS"])
    def get_screening(screening_id: str):
        if request.method == "OPTIONS":
            resp = make_response("", 204)
            resp.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
            resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
            resp.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            return resp

        # Normal GET logic
        resp = make_response("...", 200)
        resp.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        return resp

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"ok": True}), 200

    return app


VITE_PORT = 5173


def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((host, port)) == 0


def _stream_output(prefix: str, stream: io.TextIOBase) -> None:
    for line in iter(stream.readline, ""):
        sys.stdout.write(f"{prefix} {line}")
    stream.close()


def start_frontend_if_needed() -> Optional[subprocess.Popen[str]]:
    # Resolve my-frontend directory relative to this file:
    project_root = Path(__file__).resolve().parents[1]
    frontend_dir = project_root / "my-frontend"

    if not frontend_dir.exists():
        print(f"[vite] Skipping: directory not found: {frontend_dir}")
        return None

    if not START_FRONTEND:
        print("[vite] Auto-start disabled via START_FRONTEND=0")
        return None

    if is_port_open("127.0.0.1", VITE_PORT):
        print(
            f"[vite] Port {VITE_PORT} already in use. Assuming Vite is running; not spawning a new process."
        )
        return None

    env = os.environ.copy()
    env.setdefault("FORCE_COLOR", "1")

    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    npm_path = shutil.which(npm_cmd)

    if not npm_path:
        # Don’t crash the backend in containers; just log and continue
        print("[vite] npm not found on PATH. Skipping auto-start. Start the frontend manually.")
        return None

    cmd = [npm_path, "run", "dev", "--", f"--port={VITE_PORT}"]

    proc = subprocess.Popen(
        cmd,
        cwd=frontend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    if proc.stdout:
        t = threading.Thread(target=_stream_output, args=("[vite]", proc.stdout), daemon=True)
        t.start()

    for _ in range(60):
        if is_port_open("127.0.0.1", VITE_PORT):
            print(f"[vite] Dev server is up on http://localhost:{VITE_PORT}")
            break
        time.sleep(0.1)

    return proc


def stop_frontend(proc: Optional[subprocess.Popen[str]]) -> None:
    if not proc:
        return
    print("[vite] Stopping dev server...")
    try:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    except Exception as e:
        print(f"[vite] Error stopping dev server: {e}")


if __name__ == "__main__":
    vite_proc: Optional[subprocess.Popen[str]] = None
    try:
        # Start Vite first (non-blocking)
        vite_proc = start_frontend_if_needed()

        # Then run your backend
        application = create_app()
        application.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        pass
    finally:
        stop_frontend(vite_proc)