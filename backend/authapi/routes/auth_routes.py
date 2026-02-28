from flask import Blueprint, request, jsonify
from auth import signup_user, login_user, hash_password, signup_user_with_pfp, get_current_admin
from db import users_collection, upload_user_pfp
from bson.objectid import ObjectId
import tempfile
import os
import traceback

auth_bp = Blueprint('auth', __name__)

# ---------------------------
# Authentication Routes
# ---------------------------

@auth_bp.route("/signup", methods=["POST", "OPTIONS"])
def signup():
    if request.method == "OPTIONS":
        return '', 200

    try:
        # If request is multipart/form-data (PFP upload)
        if request.content_type.startswith("multipart/form-data"):
            name = request.form.get("name")
            email = request.form.get("email")
            password = request.form.get("password")
            confirm_password = request.form.get("confirmPassword")
            photo_file = request.files.get("photo")
            result = signup_user_with_pfp(name, email, password, confirm_password, photo_file)
            return jsonify(result), 200 if result.get("success") else 400
        else:
            data = request.json
            if not data:
                return jsonify({"error": "No data provided"}), 400

            name = data.get("name")
            email = data.get("email")
            password = data.get("password")
            confirm_password = data.get("confirmPassword")
            result = signup_user(name, email, password, confirm_password)
            return jsonify(result), 200 if result.get("success") else 400

    except Exception as e:
        print("Signup error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return '', 200

    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        email = data.get("email")
        password = data.get("password")

        result = login_user(email, password)
        return jsonify(result), 200 if result.get("success") else 401

    except Exception as e:
        print("Login error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route("/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return '', 200

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Missing Authorization header"}), 401

        token = auth_header.split(" ")[1]
        from jose import jwt
        from auth import JWT_SECRET, JWT_ALGORITHM

        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")

        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isLoggedIn": False}}
        )
        return jsonify({"success": True, "message": "Logged out"}), 200

    except Exception as e:
        print("Logout error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500


@auth_bp.route("/me", methods=["GET", "OPTIONS"])
def get_current_user():
    if request.method == "OPTIONS":
        return '', 200

    try:
        from flask import g
        user = get_current_admin() or None
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        user_data = {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role", "user"),
            "photoProfile": user.get("photoProfile", "https://via.placeholder.com/120"),
            "photoThumbnail": user.get("photoThumbnail", "https://via.placeholder.com/120"),
            "photoPublicId": user.get("photoPublicId", "")
        }
        return jsonify({"success": True, "user": user_data}), 200

    except Exception as e:
        print("Get current user error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500