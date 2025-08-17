# shadow_removal.py
from matplotlib import pyplot as plt
import cv2
import numpy as np
from skimage.exposure import match_histograms


def apply_dilation(mask, iterations=5):
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    for _ in range(iterations):
        mask = cv2.dilate(mask, element)
    return mask


def apply_erode(mask, iterations=2):
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    for _ in range(iterations):
        mask = cv2.erode(mask, element)
    mask = cv2.dilate(mask, element)
    return mask


def canny_detect(image):
    return cv2.Canny(image, 100, 200)


def linear_estimate(A, B):
    mean_A = np.mean(A)
    mean_B = np.mean(B)
    gain = np.sum((A - mean_A) * (B - mean_B)) / np.sum((A - mean_A) ** 2)
    bias = mean_B - gain * mean_A
    return gain, bias


def extract_image_pixels(image, mask):
    masked_image = image * (mask > 0)
    return masked_image[masked_image > 0]


def correct_channel_linear(image, gain, bias, shadow_mask):
    gain_image = np.ones_like(image, dtype=np.float32)
    bias_image = np.zeros_like(image, dtype=np.float32)

    gain_image[shadow_mask > 0] = gain
    bias_image[shadow_mask > 0] = bias

    image = image.astype(np.float32)
    corrected = (image * gain_image) + bias_image
    corrected = np.clip(corrected, 0, 255).astype(np.uint8)

    mask = shadow_mask > 0
    if np.any(mask):
        min_val = np.min(corrected[mask])
        max_val = np.max(corrected[mask])
        if max_val > min_val:
            stretched = (corrected.astype(np.float32) - min_val) * 255.0 / (max_val - min_val)
            corrected[mask] = np.clip(stretched[mask], 0, 255).astype(np.uint8)

    return corrected


def correct_channel_matching(image, contour_mask):
    contour_mask = contour_mask * 255
    dilated = apply_dilation(contour_mask)
    dilated_more = apply_dilation(contour_mask, iterations=9)
    dilated = dilated_more - dilated
    dilated_edge = canny_detect(dilated)
    contour_mask_bool = contour_mask > 0
    bright_edge_bool = dilated_edge > 0

    matched_image = image.copy().astype(np.uint32)
    shadow_pixels = image[contour_mask_bool]
    reference_pixels = image[bright_edge_bool]
    if len(reference_pixels) == 0:
        print('No Reference Pixels found, returning the original channel')
        return image
    matched_shadow = match_histograms(shadow_pixels, reference_pixels)
    matched_image[contour_mask_bool] = matched_shadow
    return matched_image


def remove_shadow(image: np.ndarray, contour_mask: np.ndarray) -> np.ndarray:
    image_shape = image.shape
    contour_mask_shape = contour_mask.shape

    if len(image_shape) < 2:
        raise Exception('Invalid image shape received: ' + str(image_shape))
    if len(contour_mask_shape) != 2:
        raise Exception('Invalid contour mask shape received: ' + str(contour_mask_shape))
    if (contour_mask_shape[0] != image_shape[0]) or (contour_mask_shape[1] != image_shape[1]):
        raise Exception('Contour mask shape and image shape do not match. '
                        'Contour Mask: ' + str(contour_mask_shape) + ' Image: ' + str(image_shape))

    # Handle single-band or multi-band images
    if len(image_shape) == 2:  # Single-band image
        shadow_corrected = correct_channel_matching(image=image, contour_mask=contour_mask)
    else:  # Multi-band image
        shadow_corrected = np.zeros_like(image)
        for i in range(image_shape[2]):  # Process each band
            channel = image[:, :, i]
            shadow_corrected[:, :, i] = correct_channel_matching(image=channel, contour_mask=contour_mask)

    return shadow_corrected