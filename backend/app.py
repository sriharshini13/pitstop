# PitStop — Road Intelligence Backend
# Flask API + YOLOv8 pothole detection

from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import base64, io, uuid, datetime, math
from PIL import Image

app = Flask(__name__)
CORS(app)

# If the file is in a folder named 'weights' inside your current folder:
model = YOLO("model/pothole_model/weights/best.pt")

potholes_db = []

def get_severity(conf):
    if conf > 0.75:
        return "severe"
    elif conf > 0.50:
        return "moderate"
    else:
        return "minor"

def calculate_distance(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

@app.route("/detect", methods=["POST"])
def detect():
    try:
        data = request.json
        img_data = base64.b64decode(data["image"])
        image = Image.open(io.BytesIO(img_data))
        results = model(image, conf=0.4)
        detections = []
        for r in results:
            for box in r.boxes:
                conf = float(box.conf[0])
                if conf > 0.4:
                    detections.append({
                        "confidence": round(conf, 2),
                        "bbox": box.xyxy[0].tolist()
                    })
        if detections and "lat" in data and "lng" in data:
            pothole = {
                "id": str(uuid.uuid4())[:8],
                "lat": float(data["lat"]),
                "lng": float(data["lng"]),
                "confidence": max(d["confidence"] for d in detections),
                "severity": get_severity(max(d["confidence"] for d in detections)),
                "timestamp": datetime.datetime.now().isoformat(),
                "repairStatus": "pending",
                "source": "camera"
            }
            potholes_db.append(pothole)
        return jsonify({
            "detected": len(detections) > 0,
            "count": len(detections),
            "detections": detections
        })
    except Exception as e:
        return jsonify({"error": str(e), "detected": False}), 500

@app.route("/sensor", methods=["POST"])
def sensor():
    try:
        data = request.json
        x = float(data.get("x", 0))
        y = float(data.get("y", 0))
        z = float(data.get("z", 0))
        lat = float(data.get("lat", 0))
        lng = float(data.get("lng", 0))
        magnitude = math.sqrt(x**2 + y**2 + z**2)
        pothole_detected = magnitude > 15
        if pothole_detected:
            existing = False
            for p in potholes_db:
                if calculate_distance(lat, lng, p["lat"], p["lng"]) < 10:
                    existing = True
                    break
            if not existing:
                conf = min(0.99, magnitude / 30)
                pothole = {
                    "id": str(uuid.uuid4())[:8],
                    "lat": lat,
                    "lng": lng,
                    "confidence": round(conf, 2),
                    "severity": get_severity(conf),
                    "timestamp": datetime.datetime.now().isoformat(),
                    "repairStatus": "pending",
                    "source": "sensor"
                }
                potholes_db.append(pothole)
        return jsonify({
            "detected": pothole_detected,
            "magnitude": round(magnitude, 2),
            "threshold": 15
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/potholes", methods=["GET"])
def get_potholes():
    return jsonify(potholes_db)

@app.route("/nearby", methods=["GET"])
def nearby():
    try:
        lat = float(request.args.get("lat"))
        lng = float(request.args.get("lng"))
        radius = float(request.args.get("radius", 500))
        nearby_list = []
        for p in potholes_db:
            dist = calculate_distance(lat, lng, p["lat"], p["lng"])
            if dist < radius:
                nearby_list.append({**p, "distance": round(dist)})
        nearby_list.sort(key=lambda x: x["distance"])
        return jsonify(nearby_list)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/warning", methods=["GET"])
def warning():
    try:
        lat = float(request.args.get("lat"))
        lng = float(request.args.get("lng"))
        warning_radius = 300
        warnings = []
        for p in potholes_db:
            dist = calculate_distance(lat, lng, p["lat"], p["lng"])
            if dist < warning_radius and p["repairStatus"] != "repaired":
                warnings.append({**p, "distance": round(dist)})
        warnings.sort(key=lambda x: x["distance"])
        return jsonify({
            "hasWarning": len(warnings) > 0,
            "warnings": warnings,
            "nearest": warnings[0] if warnings else None
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/route", methods=["GET"])
def route():
    try:
        start_lat = float(request.args.get("start_lat"))
        start_lng = float(request.args.get("start_lng"))
        end_lat = float(request.args.get("end_lat"))
        end_lng = float(request.args.get("end_lng"))

        # Direct route - straight line
        direct_route = [
            [start_lat, start_lng],
            [(start_lat + end_lat) / 2, (start_lng + end_lng) / 2],
            [end_lat, end_lng]
        ]

        # Alternate route - goes slightly north then to destination
        alt_route = [
            [start_lat, start_lng],
            [start_lat + 0.010, start_lng + 0.005],
            [start_lat + 0.015, start_lng + 0.012],
            [end_lat, end_lng]
        ]

        def count_potholes_on_route(route_points):
            count = 0
            score = 0
            for p in potholes_db:
                if p["repairStatus"] == "repaired":
                    continue
                for i in range(len(route_points) - 1):
                    p1 = route_points[i]
                    p2 = route_points[i + 1]
                    mid_lat = (p1[0] + p2[0]) / 2
                    mid_lng = (p1[1] + p2[1]) / 2
                    dist = calculate_distance(p["lat"], p["lng"], mid_lat, mid_lng)
                    if dist < 200:
                        count += 1
                        score += 3 if p["severity"] == "severe" else 2 if p["severity"] == "moderate" else 1
                        break
            return count, score

        direct_count, direct_score = count_potholes_on_route(direct_route)
        alt_count, alt_score = count_potholes_on_route(alt_route)

        return jsonify({
            "directRoute": {
                "points": direct_route,
                "potholeCount": direct_count,
                "dangerScore": direct_score,
                "recommended": direct_score <= alt_score
            },
            "alternateRoute": {
                "points": alt_route,
                "potholeCount": alt_count,
                "dangerScore": alt_score,
                "recommended": alt_score < direct_score
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/stats", methods=["GET"])
def stats():
    total = len(potholes_db)
    severe = sum(1 for p in potholes_db if p["severity"] == "severe")
    moderate = sum(1 for p in potholes_db if p["severity"] == "moderate")
    minor = sum(1 for p in potholes_db if p["severity"] == "minor")
    pending = sum(1 for p in potholes_db if p["repairStatus"] == "pending")
    under_maintenance = sum(1 for p in potholes_db if p["repairStatus"] == "under maintenance")
    repaired = sum(1 for p in potholes_db if p["repairStatus"] == "repaired")
    camera_detected = sum(1 for p in potholes_db if p.get("source") == "camera")
    sensor_detected = sum(1 for p in potholes_db if p.get("source") == "sensor")
    demo_detected = sum(1 for p in potholes_db if p.get("source") == "demo")
    return jsonify({
        "total": total,
        "severe": severe,
        "moderate": moderate,
        "minor": minor,
        "pending": pending,
        "underMaintenance": under_maintenance,
        "repaired": repaired,
        "cameraDetected": camera_detected,
        "sensorDetected": sensor_detected,
        "demoDetected": demo_detected
    })

@app.route("/potholes/<id>/status", methods=["PUT"])
def update_status(id):
    try:
        status = request.json.get("status")
        for p in potholes_db:
            if p["id"] == id:
                p["repairStatus"] = status
                return jsonify({"success": True})
        return jsonify({"error": "Not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/add_demo", methods=["POST"])
def add_demo():
    # Real Visakhapatnam road coordinates
    demo_potholes = [
        {"lat": 17.7241, "lng": 83.3022, "severity": "severe", "confidence": 0.91},
        {"lat": 17.7215, "lng": 83.2998, "severity": "moderate", "confidence": 0.63},
        {"lat": 17.7260, "lng": 83.3045, "severity": "minor", "confidence": 0.45},
        {"lat": 17.7198, "lng": 83.3078, "severity": "severe", "confidence": 0.88},
        {"lat": 17.7275, "lng": 83.2965, "severity": "moderate", "confidence": 0.71},
        {"lat": 17.7190, "lng": 83.3100, "severity": "minor", "confidence": 0.42},
        {"lat": 17.7300, "lng": 83.2940, "severity": "severe", "confidence": 0.85},
        {"lat": 17.7235, "lng": 83.3055, "severity": "moderate", "confidence": 0.68},
        {"lat": 17.7250, "lng": 83.3010, "severity": "severe", "confidence": 0.92},
        {"lat": 17.7220, "lng": 83.3035, "severity": "minor", "confidence": 0.48},
    ]
    for p in demo_potholes:
        potholes_db.append({
            "id": str(uuid.uuid4())[:8],
            "lat": p["lat"],
            "lng": p["lng"],
            "confidence": p["confidence"],
            "severity": p["severity"],
            "timestamp": datetime.datetime.now().isoformat(),
            "repairStatus": "pending",
            "source": "demo"
        })
    return jsonify({"success": True, "added": len(demo_potholes)})

@app.route("/reset", methods=["DELETE"])
def reset():
    potholes_db.clear()
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(debug=True, port=5000)