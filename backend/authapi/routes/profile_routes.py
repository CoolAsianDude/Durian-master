from flask import Blueprint, request, jsonify
from bson.objectid import ObjectId
from auth import hash_password, get_current_admin
from db import users_collection, upload_user_pfp
import datetime
import tempfile
import os
import traceback

profile_bp = Blueprint('profile', __name__)

# ---------------------------
# Profile Routes
# ---------------------------

def get_current_user():
    """Return the current authenticated user based on JWT token"""
    user = get_current_admin()  # Reuse admin JWT check
    if user:
        return user
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    try:
        from jose import jwt
        from auth import JWT_SECRET, JWT_ALGORITHM
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        return user
    except:
        return None

# ---------------------------
# Get profile
# ---------------------------

@profile_bp.route("/", methods=["GET", "OPTIONS"])
def get_profile():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        return jsonify({
            "id": str(user["_id"]),
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "photoProfile": user.get("photoProfile", "https://via.placeholder.com/120"),
            "photoThumbnail": user.get("photoThumbnail", "https://via.placeholder.com/120"),
            "photoPublicId": user.get("photoPublicId", ""),
            "createdAt": user.get("createdAt"),
            "updatedAt": user.get("updatedAt"),
            "isLoggedIn": user.get("isLoggedIn", False)
        }), 200
    except Exception as e:
        print("Get profile error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

# ---------------------------
# Update profile (JSON)
# ---------------------------

@profile_bp.route("/", methods=["PUT", "OPTIONS"])
def update_profile():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        update_data = {
            "name": data.get("name"),
            "email": data.get("email"),
            "updatedAt": datetime.datetime.utcnow()
        }

        if data.get("password"):
            update_data["password"] = hash_password(data["password"])

        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}

        result = users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": update_data}
        )

        if result.modified_count > 0:
            return jsonify({"success": True, "message": "Profile updated"}), 200
        else:
            return jsonify({"success": False, "message": "No changes made"}), 200

    except Exception as e:
        print("Update profile error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

# ---------------------------
# Update profile picture
# ---------------------------

@profile_bp.route("/update-pfp", methods=["PUT", "POST", "OPTIONS"])
def update_profile_picture():
    if request.method == "OPTIONS":
        return '', 200
    try:
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        if 'photo' not in request.files:
            return jsonify({"error": "No photo provided"}), 400

        photo_file = request.files['photo']

        # Save temp file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        photo_file.save(temp_file.name)
        temp_file.close()

        with open(temp_file.name, 'rb') as f:
            image_data = f.read()

        upload_result = upload_user_pfp(
            image_data=image_data,
            user_id=str(user["_id"]),
            username=user.get("name", "User")
        )

        os.unlink(temp_file.name)

        if upload_result.get("success"):
            users_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {
                    "photoProfile": upload_result.get("url") or upload_result.get("photoProfile"),
                    "photoThumbnail": upload_result.get("thumbnail") or upload_result.get("photoThumbnail"),
                    "photoPublicId": upload_result.get("public_id") or upload_result.get("photoPublicId")
                }}
            )
            return jsonify({
                "success": True,
                "message": "Profile picture updated",
                "photoProfile": upload_result.get("url") or upload_result.get("photoProfile"),
                "photoThumbnail": upload_result.get("thumbnail") or upload_result.get("photoThumbnail"),
                "photoPublicId": upload_result.get("public_id") or upload_result.get("photoPublicId")
            }), 200

        return jsonify({"error": "Upload failed"}), 500

    except Exception as e:
        print("Update PFP error:", str(e))
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500