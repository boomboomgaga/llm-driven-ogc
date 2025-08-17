from shadow_removal import *
import cv2
import numpy as np
import rasterio
from matplotlib import pyplot as plt


def load_image(image_path, mask=False):
    if image_path.lower().endswith('.tif') or image_path.lower().endswith('.tiff'):
        with rasterio.open(image_path) as src:
            image = src.read()  # Read all bands
            image = np.transpose(image, (1, 2, 0))  # Convert to (height, width, bands)
            if mask:
                # For mask, return first band as grayscale
                return image[:, :, 0].astype(np.uint8)
            return image
    else:
        image = cv2.imread(image_path)
        if mask:
            return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def get_polygons(mask):
    mask = (mask * 255).astype(np.uint8) if mask.max() <= 1 else mask
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return len(contours), contours


def get_shadow_masks(mask, polygons):
    binary_mask = (mask > 0).astype(np.uint8)
    masks = list()
    for polygon in polygons:
        msk = np.zeros_like(binary_mask, dtype=np.uint8)
        cv2.drawContours(msk, [polygon], -1, 1, thickness=cv2.FILLED)
        masks.append(msk)
    return masks


def run(image_path, mask):
    image = load_image(image_path=image_path)
    if isinstance(mask, str):
        mask = load_image(image_path=mask, mask=True)
    
    count, polygons = get_polygons(mask)
    polygon_masks = get_shadow_masks(mask, polygons)
    
    # Process each band for shadow removal
    for shadow in polygon_masks:
        image = remove_shadow(image, shadow)
    
    return image


if __name__ == '__main__':
    run('shadow.tif', 'polygon_mask.tif')