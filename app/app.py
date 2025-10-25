import os
from flask import Flask, jsonify, request, make_response
from dotenv import load_dotenv
from flask_cors import CORS  # Imported if you plan to enable CORS globally

from common import init_db_and_redis, ensure_indexes_db

# import blueprints
from blueprints.users import users_bp
from blueprints.movies import movies_bp
from blueprints.bookings import bookings_bp
from blueprints.payments import payments_bp
from blueprints.reviews import reviews_bp

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "config.example"))


def create_app() -> Flask:
    app = Flask(__name__)

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


if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)