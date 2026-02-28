# backend/authapi/auth.py
from flask import request, jsonify
from db import users_collection, upload_user_pfp
from passlib.context import CryptContext
from jose import jwt
from bson.objectid import ObjectId
from functools import wraps
import datetime
import os

# ---------------------------
# Password hashing
# ---------------------------
pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")

# ---------------------------
# JWT config
# ---------------------------
JWT_SECRET = "8282fcd97e60e2e51005e284bd45f8b692d4ab4cd7916fe9e9ace2e375a5c8d8"
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# ---------------------------
# Helper functions
# ---------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except:
        return password == hashed

def get_current_admin():
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user or user.get("role") != "admin":
            return None
        return user
    except:
        return None

# ---------------------------
# JWT decorators
# ---------------------------

def jwt_required(f):
    """Decorator to require a valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"success": False, "error": "Authorization header missing"}), 401
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            request.user_id = payload.get("sub")
        except Exception as e:
            return jsonify({"success": False, "error": "Invalid or expired token"}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @jwt_required
    def decorated(*args, **kwargs):
        user = users_collection.find_one({"_id": ObjectId(request.user_id)})
        if not user or user.get("role") != "admin":
            return jsonify({"success": False, "error": "Admin access required"}), 403
        request.user = user
        return f(*args, **kwargs)
    return decorated

# ---------------------------
# Authentication functions
# ---------------------------

def signup_user(name: str, email: str, password: str, confirm_password: str):
    if password != confirm_password:
        return {"error": "Passwords do not match"}
    if users_collection.find_one({"email": email}):
        return {"error": "User already exists"}
    hashed = hash_password(password)
    users_collection.insert_one({
        "name": name,
        "email": email,
        "password": hashed,
        "role": "user",
        "isLoggedIn": False,
        "photoProfile": "https://via.placeholder.com/120",
        "createdAt": datetime.datetime.utcnow()
    })
    return {"success": True, "message": "User registered successfully"}

def login_user(email: str, password: str):
    user = users_collection.find_one({"email": email})
    if not user or not verify_password(password, user["password"]):
        return {"error": "Invalid credentials"}
    if not user.get("isActive", True):
        return {"error": "User is deactivated. Please contact support."}
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"isLoggedIn": True, "lastLogin": datetime.datetime.utcnow()}}
    )
    payload = {
        "sub": str(user["_id"]),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "success": True,
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role", "user"),
            "photoProfile": user.get("photoProfile", "https://via.placeholder.com/120")
        }
    }

# ---------------------------
# Signup with profile picture
# ---------------------------

def signup_user_with_pfp(name, email, password, confirm_password, photo_file=None):
    if password != confirm_password:
        return {"error": "Passwords do not match"}
    if users_collection.find_one({"email": email}):
        return {"error": "User already exists"}
    hashed = hash_password(password)
    user_doc = {
        "name": name,
        "email": email,
        "password": hashed,
        "role": "user",
        "isLoggedIn": True,
        "createdAt": datetime.datetime.utcnow(),
        "lastLogin": datetime.datetime.utcnow()
    }
    result = users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)
    photo_data = None

    if photo_file:
        try:
            photo_file.seek(0)
            image_data = photo_file.read()
            upload_result = upload_user_pfp(
                image_data=image_data,
                user_id=user_id,
                username=name,
                delete_old=False
            )
            if upload_result.get("success"):
                photo_data = {
                    "photoProfile": upload_result.get("photoProfile") or upload_result.get("url"),
                    "photoThumbnail": upload_result.get("photoThumbnail") or upload_result.get("thumbnail"),
                    "photoPublicId": upload_result.get("photoPublicId") or upload_result.get("public_id")
                }
            else:
                default_url = f"https://ui-avatars.com/api/?name={name[:2]}&background=random&color=fff&size=400"
                photo_data = {"photoProfile": default_url, "photoThumbnail": default_url}
        except Exception as e:
            default_url = f"https://ui-avatars.com/api/?name={name[:2]}&background=random&color=fff&size=400"
            photo_data = {"photoProfile": default_url, "photoThumbnail": default_url}
    else:
        default_url = f"https://ui-avatars.com/api/?name={name[:2]}&background=random&color=fff&size=400"
        photo_data = {"photoProfile": default_url, "photoThumbnail": default_url}

    if photo_data:
        users_collection.update_one({"_id": result.inserted_id}, {"$set": photo_data})

    user = users_collection.find_one({"_id": result.inserted_id})
    payload = {
        "sub": str(user["_id"]),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {
        "success": True,
        "message": "User registered successfully",
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user.get("role", "user"),
            "photoProfile": user.get("photoProfile"),
            "photoThumbnail": user.get("photoThumbnail"),
            "photoPublicId": user.get("photoPublicId"),
            "createdAt": user["createdAt"]
        }
    }