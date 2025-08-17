import cv2
import numpy as np

# Global variables
points = []
all_polygons = []
img_copy = None
mask = None

def click_event(event, x, y, flags, param):
    global points, img_copy

    if event == cv2.EVENT_LBUTTONDOWN:
        points.append((x, y))
        cv2.circle(img_copy, (x, y), 3, (0, 255, 0), -1)
        if len(points) > 1:
            cv2.line(img_copy, points[-2], points[-1], (255, 0, 0), 2)
        cv2.imshow("Image - Select Polygon Vertices", img_copy)

def main():
    global img_copy, points, mask, all_polygons

    # Load image
    img = cv2.imread('shadow.png')  # Replace with your image path
    if img is None:
        print("Image not found!")
        return

    img_copy = img.copy()

    cv2.imshow("Image - Select Polygon Vertices", img_copy)
    cv2.setMouseCallback("Image - Select Polygon Vertices", click_event)

    print("Click to select vertices.")
    print("Press 'n' to finish current polygon and start a new one.")
    print("Press 's' to save/fill all polygons and export mask.")
    print("Press 'q' to quit without saving.")

    while True:
        key = cv2.waitKey(1) & 0xFF

        if key == ord('n'):  # Finish current polygon and start new
            if len(points) >= 3:
                all_polygons.append(points.copy())
                points = []
                print(f"Polygon {len(all_polygons)} saved. Start a new one.")
            else:
                print("Need at least 3 points to form a polygon.")

        elif key == ord('s'):  # Save all polygons
            if len(points) >= 3:
                all_polygons.append(points.copy())  # Save last polygon too
                points = []

            if len(all_polygons) == 0:
                print("No polygons drawn.")
                continue

            # Create mask
            mask = np.zeros(img.shape[:2], dtype=np.uint8)
            for poly in all_polygons:
                pts = np.array(poly, dtype=np.int32)
                cv2.fillPoly(mask, [pts], 255) # type: ignore

            # Apply mask
            masked_img = cv2.bitwise_and(img, img, mask=mask)

            # Save outputs
            cv2.imwrite("polygon_mask.png", mask)
            cv2.imwrite("polygon_masked_image.png", masked_img)

            print(f"Saved {len(all_polygons)} polygons.")
            print("Saved polygon_mask.png and polygon_masked_image.png")
            cv2.imshow("Masked Image", masked_img)
            cv2.waitKey(0)
            break

        elif key == ord('q'):  # Quit without saving
            print("Quitting without saving.")
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()