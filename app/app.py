# app/app.py
import os
from flask import Flask, jsonify
from dotenv import load_dotenv

from common import init_db_and_redis, ensure_indexes_db

# import blueprints
from blueprints.users import users_bp
from blueprints.movies import movies_bp
from blueprints.bookings import bookings_bp
from blueprints.payments import payments_bp
from blueprints.reviews import reviews_bp

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), 'config.example'))

def create_app():
    app = Flask(__name__)

    # load config into app.config for convenience
    app.config['HOLD_TTL_SECONDS'] = int(os.environ.get('HOLD_TTL_SECONDS', 600))
    app.config['JWT_SECRET'] = os.environ.get('JWT_SECRET')
    app.config['LUA_PATH'] = os.path.join(os.path.dirname(__file__), 'hold_seats.lua')

    mc, mdb, r, hold_seats_sha = init_db_and_redis(app)
    ensure_indexes_db(mdb)

    app.mongodb_client = mc
    app.mdb = mdb
    app.redis = r
    app.hold_seats_sha = hold_seats_sha

    app.register_blueprint(users_bp, url_prefix='/users')
    app.register_blueprint(movies_bp, url_prefix='/movies')
    app.register_blueprint(bookings_bp, url_prefix='/bookings')
    app.register_blueprint(payments_bp, url_prefix='/payments')
    app.register_blueprint(reviews_bp, url_prefix='/reviews')

    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'ok': True}), 200

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)