import sys
import cv2
import numpy as np
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QLabel, QPushButton, QFileDialog,
    QVBoxLayout, QWidget, QHBoxLayout
)
from PyQt5.QtGui import QPixmap, QImage, QPainter, QPen
from PyQt5.QtCore import Qt, QPoint
import rasterio
from driver import run
import os

# Suppress QT_DEVICE_PIXEL_RATIO warning by setting recommended environment variable
os.environ["QT_AUTO_SCREEN_SCALE_FACTOR"] = "1"

class ImageLabel(QLabel):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlignment(Qt.AlignTop)
        self.setMouseTracking(True)
        self.setFocusPolicy(Qt.StrongFocus)
        self.image = None
        self.qimage = None
        self.current_polygon = []
        self.all_polygons = []

    def set_image(self, image_path):
        self.image_path = image_path
        # Load GeoTIFF or regular image
        if image_path.lower().endswith('.tif') or image_path.lower().endswith('.tiff'):
            with rasterio.open(image_path) as src:
                # Read first 3 bands for visualization (or all if less than 3)
                bands = min(src.count, 3)
                image = src.read([1, 2, 3] if bands >= 3 else list(range(1, bands + 1)))
                # Transpose to (height, width, channels)
                image = np.transpose(image, (1, 2, 0))
                # Ensure uint8 for display
                if image.dtype != np.uint8:
                    image = (image / np.max(image) * 255).astype(np.uint8)
                # If single band, duplicate to RGB
                if len(image.shape) == 2 or image.shape[2] == 1:
                    image = np.stack([image.squeeze()] * 3, axis=-1)
        else:
            image = cv2.imread(image_path)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        self.image = image
        h, w, _ = self.image.shape
        # Ensure image is contiguous and in uint8 format for QImage
        image = np.ascontiguousarray(image, dtype=np.uint8)
        self.qimage = QImage(image.data, w, h, 3 * w, QImage.Format_RGB888)
        pixmap = QPixmap.fromImage(self.qimage)
        self.setPixmap(pixmap)
        self.setFixedSize(pixmap.size())  # Match QLabel size to image
        self.current_polygon.clear()
        self.all_polygons.clear()

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton and self.image is not None:
            x = event.pos().x()
            y = event.pos().y()
            if 0 <= x < self.image.shape[1] and 0 <= y < self.image.shape[0]:
                self.current_polygon.append((x, y))
                self.update()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_N:
            if self.current_polygon:
                self.all_polygons.append(self.current_polygon.copy())
                self.current_polygon.clear()
                self.update()

    def paintEvent(self, event):
        super().paintEvent(event)
        if self.image is None:
            return

        painter = QPainter(self)
        painter.setPen(QPen(Qt.red, 2))

        def to_points(poly):
            return [QPoint(int(x), int(y)) for (x, y) in poly]

        for poly in self.all_polygons:
            if len(poly) >= 2:
                pts = to_points(poly)
                for i in range(len(pts) - 1):
                    painter.drawLine(pts[i], pts[i + 1])
                painter.drawLine(pts[-1], pts[0])

        if self.current_polygon:
            pts = to_points(self.current_polygon)
            for i in range(len(pts) - 1):
                painter.drawLine(pts[i], pts[i + 1])
            for pt in pts:
                painter.drawEllipse(pt, 3, 3)

    def get_mask(self):
        mask = np.zeros(self.image.shape[:2], dtype=np.uint8)
        for poly in self.all_polygons:
            if len(poly) >= 3:
                pts = np.array(poly, dtype=np.int32)
                cv2.fillPoly(mask, [pts], 255)
        return mask


class ShadowRemoverUI(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Shadow Removal Tool")
        self.image_path = None

        self.image_label = ImageLabel()

        self.load_button = QPushButton("Load Image")
        self.done_button = QPushButton("Done (Save Mask)")
        self.remove_button = QPushButton("Remove Shadow")

        self.load_button.clicked.connect(self.load_image)
        self.done_button.clicked.connect(self.save_mask)
        self.remove_button.clicked.connect(self.remove_shadow)

        layout = QVBoxLayout()
        layout.addWidget(self.image_label)

        button_layout = QHBoxLayout()
        button_layout.addWidget(self.load_button)
        button_layout.addWidget(self.done_button)
        button_layout.addWidget(self.remove_button)

        layout.addLayout(button_layout)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

    def load_image(self):
        path, _ = QFileDialog.getOpenFileName(self, "Select Image", "", "Images (*.png *.jpg *.jpeg *.tif *.tiff)")
        if path:
            self.image_path = path
            self.image_label.set_image(path)

    def save_mask(self):
        if not self.image_path:
            return
        mask = self.image_label.get_mask()
        # Save mask temporarily in memory
        self.mask = mask
        print("[INFO] Mask created in memory")

    def remove_shadow(self):
        if not self.image_path or not hasattr(self, 'mask'):
            print("[ERROR] Load image and create mask first.")
            return
        save_path, _ = QFileDialog.getSaveFileName(self, "Save Corrected Image", "", "GeoTIFF Files (*.tif *.tiff);;PNG Files (*.png)")
        if save_path:
            result = run(self.image_path, self.mask)
            if self.image_path.lower().endswith('.tif') or self.image_path.lower().endswith('.tiff'):
                # Save as GeoTIFF with metadata
                with rasterio.open(self.image_path) as src:
                    meta = src.meta.copy()
                    meta.update({
                        'count': result.shape[2] if len(result.shape) == 3 else 1,
                        'dtype': result.dtype
                    })
                    with rasterio.open(save_path, 'w', **meta) as dst:
                        if len(result.shape) == 3:
                            result = np.transpose(result, (2, 0, 1))  # Rasterio expects (bands, height, width)
                            for i in range(result.shape[0]):
                                dst.write(result[i], i + 1)
                        else:
                            dst.write(result, 1)
            else:
                # Save as regular image
                cv2.imwrite(save_path, cv2.cvtColor(result, cv2.COLOR_RGB2BGR))
            print(f"[INFO] Corrected image saved to {save_path}")


def main():
    app = QApplication(sys.argv)
    win = ShadowRemoverUI()
    win.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()