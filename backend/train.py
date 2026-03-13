from ultralytics import YOLO

model = YOLO("yolov8n.pt")

results = model.train(
    data="E:/TDP/pothole-system/backend/dataset/Pot Hole Detection.v1i.yolov8/data.yaml",
    epochs=30,
    imgsz=640,
    batch=8,
    name="pothole_model",
    project="E:/TDP/pothole-system/backend/model",
    patience=10,
    save=True,
    device="cpu"
)

print("✅ Training Complete!")
print("Best weights saved at: E:/TDP/pothole-system/backend/model/pothole_model/weights/best.pt")
