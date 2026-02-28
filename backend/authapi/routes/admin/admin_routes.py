from flask import Blueprint, request, jsonify
from bson.objectid import ObjectId
from db import users_collection, posts_collection, scans_collection  # <- added posts & scans
from handlers.email_handler import send_deactivation_email, send_reactivation_email
import datetime
from auth import jwt_required, admin_required

admin_bp = Blueprint('admin', __name__)

# ---------------------------
# Admin User Management
# ---------------------------

@admin_bp.route("/users", methods=["GET", "OPTIONS"])
def get_all_users():
    if request.method == "OPTIONS":
        return '', 200  # Bypass preflight

    @jwt_required
    @admin_required
    def inner():
        users = list(users_collection.find({}, {"password": 0}))
        users_data = [
            {
                "id": str(user["_id"]),
                "name": user.get("name", ""),
                "email": user.get("email", ""),
                "role": user.get("role", "user"),
                "profile_picture": user.get("profile_picture", ""),
                "createdAt": user.get("createdAt", ""),
                "updatedAt": user.get("updatedAt", ""),
                "isActive": user.get("isActive", True)
            }
            for user in users
        ]
        return jsonify({"success": True, "users": users_data, "total": len(users_data)}), 200

    return inner()


@admin_bp.route("/users/<user_id>/role", methods=["PUT", "OPTIONS"])
@jwt_required
@admin_required
def update_user_role(user_id):
    if request.method == "OPTIONS":
        return '', 200

    try:
        data = request.json
        if not data or "role" not in data:
            return jsonify({"success": False, "error": "Missing role"}), 400

        valid_roles = ["user", "admin"]
        if data["role"] not in valid_roles:
            return jsonify({"success": False, "error": "Invalid role"}), 400

        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": data["role"], "updatedAt": datetime.datetime.utcnow().isoformat()}}
        )

        if result.modified_count > 0:
            return jsonify({"success": True, "message": "Role updated"}), 200
        return jsonify({"success": False, "error": "User not found"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/users/<user_id>/deactivate", methods=["PUT", "OPTIONS"])
@jwt_required
@admin_required
def deactivate_user(user_id):
    if request.method == "OPTIONS":
        return '', 200

    try:
        data = request.json or {}
        reason = data.get("reason", "No reason provided")

        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404

        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "isActive": False,
                    "deactivationReason": reason,
                    "deactivatedAt": datetime.datetime.utcnow().isoformat(),
                    "updatedAt": datetime.datetime.utcnow().isoformat()
                }
            }
        )

        email_sent = False
        if result.modified_count > 0:
            if user.get("email"):
                email_sent = send_deactivation_email(user["email"], user.get("name", "User"), reason)

            return jsonify({"success": True, "message": "User deactivated", "emailSent": email_sent}), 200

        return jsonify({"success": False, "error": "User not found or already deactivated"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/users/<user_id>/activate", methods=["PUT", "OPTIONS"])
@jwt_required
@admin_required
def activate_user(user_id):
    if request.method == "OPTIONS":
        return '', 200

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "error": "User not found"}), 404

        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {"isActive": True, "updatedAt": datetime.datetime.utcnow().isoformat()},
                "$unset": {"deactivationReason": "", "deactivatedAt": ""}
            }
        )

        email_sent = False
        if result.modified_count > 0:
            if user.get("email"):
                email_sent = send_reactivation_email(user["email"], user.get("name", "User"))
            return jsonify({"success": True, "message": "User reactivated", "emailSent": email_sent}), 200

        return jsonify({"success": False, "error": "User not found or already active"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@admin_bp.route("/users/<user_id>", methods=["DELETE", "OPTIONS"])
@jwt_required
@admin_required
def delete_user(user_id):
    if request.method == "OPTIONS":
        return '', 200

    try:
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"isActive": False, "updatedAt": datetime.datetime.utcnow().isoformat()}}
        )

        if result.modified_count > 0:
            return jsonify({"success": True, "message": "User deleted"}), 200
        return jsonify({"success": False, "error": "User not found"}), 404

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------
# Admin Stats
# ---------------------------

@admin_bp.route("/stats", methods=["GET", "OPTIONS"])
@jwt_required
@admin_required
def get_admin_stats():
    if request.method == "OPTIONS":
        return '', 200

    try:
        total_users = users_collection.count_documents({})
        active_users = users_collection.count_documents({"isActive": True})
        admin_users = users_collection.count_documents({"role": "admin"})

        return jsonify({
            "success": True,
            "stats": {
                "total_users": total_users,
                "active_users": active_users,
                "admin_users": admin_users,
                "inactive_users": total_users - active_users
            }
        }), 200

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------
# Admin Analytics (aggregate)
# ---------------------------

@admin_bp.route("/GenAnalytics", methods=["GET"])
@jwt_required
@admin_required
def get_admin_analytics():
    try:
        # -------------------------------
        # Fetch stats
        # -------------------------------
        total_users = users_collection.count_documents({})
        total_posts = posts_collection.count_documents({})
        total_scans = scans_collection.count_documents({})

        # -------------------------------
        # Total durians safely
        # -------------------------------
        pipeline_durians = [
            {"$group": {"_id": None, "total_durians": {"$sum": {"$ifNull": ["$durian_count", 0]}}}}
        ]
        durians_result = list(scans_collection.aggregate(pipeline_durians))
        total_durians = durians_result[0]["total_durians"] if durians_result else 0

        # -------------------------------
        # Overall success rate safely
        # -------------------------------
        pipeline_success = [
            {"$group": {"_id": None, "avg_success": {"$avg": {"$ifNull": ["$export_ready", 0]}}}}
        ]
        success_result = list(scans_collection.aggregate(pipeline_success))
        overall_success_rate = success_result[0]["avg_success"] if success_result and success_result[0]["avg_success"] is not None else 0

        # -------------------------------
        # Return JSON
        # -------------------------------
        return jsonify({
            "success": True,
            "stats": {
                "total_users": total_users,
                "total_posts": total_posts,
                "total_scans": total_scans,
                "total_durians_detected": total_durians,
                "overall_success_rate": round(overall_success_rate, 2)
            }
        }), 200

    except Exception as e:
        print("GenAnalytics error:", e)
        return jsonify({"success": False, "error": "Failed to fetch admin GenAnalytics"}), 500