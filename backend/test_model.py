from ultralytics import YOLO

model = YOLO("model/pothole_model/weights/best.pt")

results = model("test_image.jpg")

for r in results:
    print(f"Detections found: {len(r.boxes)}")
    for box in r.boxes:
        print(f"Confidence: {float(box.conf[0]):.2f}")

results[0].save("test_result.jpg")
print("Test Complete! Check test_result.jpg")
