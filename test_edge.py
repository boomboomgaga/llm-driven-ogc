import cv2
import numpy as np
from matplotlib import pyplot as plt
from skimage.exposure import match_histograms

# TODO : User Draw contour
# TODO : Region filling
# TODO : Masking image and extracting pixel intenstiy for both
# TODO : Calculating gain and bias
# TODO : Apply the gain and bias on all pixel in the selected region

def apply_dilation(image):
	shape = cv2.MORPH_CROSS
	element = cv2.getStructuringElement(shape, (3,3), (1,1))
	print('Here111')
	for i in range(5):
		print('Dilating')
		image = cv2.dilate(image,element)
	return image

def apply_erode(image):
	shape = cv2.MORPH_CROSS
	element = cv2.getStructuringElement(shape, (3,3), (1,1))
	print('Here111')
	for i in range(2):
		print('Eroding')
		image = cv2.erode(image,element)
	image = cv2.dilate(image,element)
	return image

def edges_detect(image):
	edges_x = cv2.Sobel(image, cv2.CV_64F, 1,0,ksize=3)
	edges_y = cv2.Sobel(image, cv2.CV_64F, 0,1,ksize=3)
	magnitude = np.sqrt(edges_x**2 + edges_y**2)
	edge_image = np.uint8(255 * magnitude / np.max(magnitude))
	# val1 = np.max(edge_image[edge_image!=0])
	# threshold_image = edge_image[edge_image>=val1]
	return edge_image

def canny_detect(image):
	edges = cv2.Canny(image,100,200)
	return edges

def linear_estimate(A,B):
	mean_A = np.mean(A)
	mean_B = np.mean(B)
	gain = np.sum((A - mean_A) * (B - mean_B)) / np.sum((A - mean_A) ** 2)
	bias = mean_B - gain * mean_A
	return gain,bias

def extract_image_pixels(image,mask):
	plt.imshow(image)
	plt.show()
	plt.imshow(mask)
	plt.show()
	masked_image = image*mask
	return list(masked_image[masked_image>0])

def remove_shadow_linear(image, gain, bias, shadow_mask):
    # Prepare gain and bias images
    gain_image = shadow_mask.copy().astype(np.float32)
    bias_image = shadow_mask.copy().astype(np.float32)

    gain_image[gain_image > 0] = gain
    gain_image[gain_image == 0] = 1
    bias_image[bias_image > 0] = bias

    # Visualize
    plt.imshow(gain_image, cmap='gray')
    plt.title("Gain Image")
    plt.show()

    plt.imshow(bias_image, cmap='gray')
    plt.title("Bias Image")
    plt.show()

    # Apply gain and bias
    image = image.astype(np.float32)
    shadow_removed = (image * gain_image) + bias_image
    shadow_removed = np.clip(shadow_removed, 0, 255).astype(np.uint8)
    mask = shadow_mask > 0
    masked_pixels = shadow_removed[mask]
    
    if len(masked_pixels) > 0:
        p_min = np.min(masked_pixels)
        p_max = np.max(masked_pixels)

        print(f"Stretching range: min={p_min}, max={p_max}")
        if p_max > p_min:
            stretched = (shadow_removed.astype(np.float32) - p_min) * 255.0 / (p_max - p_min)
            shadow_removed[mask] = np.clip(stretched[mask], 0, 255).astype(np.uint8)
    plt.imshow(shadow_removed, cmap='gray')
    plt.title("After Histogram Stretching")
    plt.show()

    return shadow_removed

def remove_shadow_matching(actual, composed, shadow_mask):
    actual = actual.astype(np.uint8)
    shadow_mask_bool = shadow_mask > 0
    composed_bool = composed > 0

    shadow_pixels = actual[shadow_mask_bool]
    reference_pixels = actual[composed_bool]

    print(f"# Shadow pixels: {len(shadow_pixels)}")
    print(f"# Reference (edge) pixels: {len(reference_pixels)}")

    if len(shadow_pixels) == 0 or len(reference_pixels) == 0:
        print("Error: Empty pixel set for matching.")
        return actual

    matched_image = actual.copy().astype(np.float32)
    
    matched_shadow = match_histograms(shadow_pixels, reference_pixels)

    matched_image[shadow_mask_bool] = matched_shadow

    matched_image = np.clip(matched_image, 0, 255).astype(np.uint8)
    plt.figure(figsize=(12, 4))
    plt.subplot(1, 3, 1)
    plt.imshow(actual, cmap='gray')
    plt.title("Original Image")

    plt.subplot(1, 3, 2)
    plt.imshow(shadow_mask, cmap='gray')
    plt.title("Shadow Mask")

    plt.subplot(1, 3, 3)
    plt.imshow(matched_image, cmap='gray')
    plt.title("After Histogram Matching")
    plt.show()
    return matched_image


image = cv2.imread('polygon_mask.png')
image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
plt.imshow(image)
plt.show()

actual = cv2.imread('shadow.png')
actual = cv2.cvtColor(actual, cv2.COLOR_BGR2GRAY)

# Now single pixel wide edges are being extracted.
# Erode the image and extract pixels
# Compose the same image to see how it looks.
erode = apply_erode(image)
dilate = apply_dilation(image)
erode_edge = canny_detect(erode)
dilate_edge = canny_detect(dilate)

shadow_pixels = extract_image_pixels(actual, erode_edge)
bright_pixels = extract_image_pixels(actual, dilate_edge)

print(len(shadow_pixels))
print(len(bright_pixels))

truncate = min(len(shadow_pixels), len(bright_pixels))
shadow_pixels = shadow_pixels[:truncate]
bright_pixels = bright_pixels[:truncate]

print(len(shadow_pixels))
print(len(bright_pixels))

gain,bias = linear_estimate(shadow_pixels,bright_pixels)
print(gain,bias)
composed = dilate_edge + erode_edge
# a = remove_shadow(actual,gain,bias,image)
a = remove_shadow_matching(actual,dilate_edge,image)
plt.imshow(a)
plt.show()
plt.imshow(composed)
plt.show()