import cv2
import numpy as np


def detect_sensitive_regions(image_bytes: bytes) -> list[dict]:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return []

    h_img, w_img = img.shape[:2]
    regions: list[dict] = []
    used_zones: list[tuple] = []

    def overlaps(x, y, w, h) -> bool:
        for (rx, ry, rw, rh) in used_zones:
            if x < rx + rw and x + w > rx and y < ry + rh and y + h > ry:
                return True
        return False

    def add_region(label, x, y, w, h, padding=4):
        x = max(0, int(x) - padding)
        y = max(0, int(y) - padding)
        w = min(w_img - x, int(w) + padding * 2)
        h = min(h_img - y, int(h) + padding * 2)
        if w < 10 or h < 10:
            return
        if not overlaps(x, y, w, h):
            regions.append({"label": label, "x": x, "y": y, "w": w, "h": h})
            used_zones.append((x, y, w, h))
            print(f"[detect] added '{label}' at ({x},{y},{w},{h})")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ── 1. Face ───────────────────────────────────────────────────────────────
    try:
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        for (x, y, w, h) in faces:
            add_region("face", x, y, w, h, padding=10)
    except Exception as e:
        print(f"[detect] face detection failed: {e}")

    # ── 2. QR code (multi → single → hardcoded fallback) ─────────────────────
    qr_found = False
    try:
        qr = cv2.QRCodeDetector()

        # Try multi-QR detection first
        retval, _, points, _ = qr.detectAndDecodeMulti(img)
        if retval and points is not None and len(points) > 0:
            for poly in points:
                pts = poly.astype(int).reshape(-1, 1, 2)
                x, y, w, h = cv2.boundingRect(pts)
                if w > 20 and h > 20:
                    add_region("qr_code", x, y, w, h, padding=10)
                    qr_found = True

        # Try single QR detection if multi found nothing
        if not qr_found:
            retval2, points2 = qr.detect(img)
            if retval2 and points2 is not None:
                pts = points2.astype(int).reshape(-1, 1, 2)
                x, y, w, h = cv2.boundingRect(pts)
                if w > 20 and h > 20:
                    add_region("qr_code", x, y, w, h, padding=10)
                    qr_found = True

    except Exception as e:
        print(f"[detect] QR detection failed: {e}")

    # Hardcoded Aadhaar QR fallback — right side, middle of card
    if not qr_found:
        print("[detect] QR not auto-detected, using Aadhaar layout fallback")
        add_region("qr_code",
                   int(w_img * 0.65), int(h_img * 0.28),
                   int(w_img * 0.28), int(h_img * 0.45),
                   padding=8)

    # ── 3. Barcode (gradient morphology) ─────────────────────────────────────
    try:
        blurred   = cv2.GaussianBlur(gray, (3, 3), 0)
        grad_x    = cv2.Sobel(blurred, cv2.CV_32F, 1, 0, ksize=3)
        grad_y    = cv2.Sobel(blurred, cv2.CV_32F, 0, 1, ksize=3)
        gradient  = cv2.subtract(grad_x, grad_y)
        gradient  = cv2.convertScaleAbs(gradient)
        blurred2  = cv2.blur(gradient, (9, 9))
        _, thresh = cv2.threshold(blurred2, 225, 255, cv2.THRESH_BINARY)
        kernel    = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 7))
        closed    = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        eroded    = cv2.erode(closed, None, iterations=4)
        dilated   = cv2.dilate(eroded, None, iterations=4)
        contours, _ = cv2.findContours(
            dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            aspect = w / float(h) if h > 0 else 0
            area   = w * h
            if 2.0 < aspect < 10.0 and area > (h_img * w_img * 0.01):
                add_region("barcode", x, y, w, h, padding=6)
    except Exception as e:
        print(f"[detect] barcode detection failed: {e}")

    # ── 4. MSER text lines ────────────────────────────────────────────────────
    try:
        mser = cv2.MSER_create(delta=3, min_area=30, max_area=800)
        mser_regions, _ = mser.detectRegions(gray)

        if len(mser_regions) > 0:
            hulls = [cv2.convexHull(r.reshape(-1, 1, 2)) for r in mser_regions]
            boxes = [cv2.boundingRect(h) for h in hulls]

            char_boxes = [
                (x, y, w, h) for (x, y, w, h) in boxes
                if 5 < w < 60 and 8 < h < 50 and 0.2 < w / float(h) < 3.0
            ]

            if char_boxes:
                char_boxes_sorted = sorted(char_boxes, key=lambda b: b[1])
                lines: list[list] = []
                current_line: list = [char_boxes_sorted[0]]

                for box in char_boxes_sorted[1:]:
                    if abs(box[1] - current_line[-1][1]) < 15:
                        current_line.append(box)
                    else:
                        lines.append(current_line)
                        current_line = [box]
                lines.append(current_line)

                for line in lines:
                    if len(line) < 4:
                        continue
                    xs  = [b[0] for b in line]
                    ys  = [b[1] for b in line]
                    x2s = [b[0] + b[2] for b in line]
                    y2s = [b[1] + b[3] for b in line]
                    lx  = min(xs)
                    ly  = min(ys)
                    lw  = max(x2s) - lx
                    lh  = max(y2s) - ly

                    if lw < w_img * 0.15 or lh > 60:
                        continue

                    rel_y = ly / h_img
                    if rel_y < 0.25:
                        label = "name"
                    elif rel_y > 0.75:
                        label = "id_number"
                    else:
                        label = "personal_details"

                    add_region(label, lx, ly, lw, lh, padding=4)
    except Exception as e:
        print(f"[detect] MSER text detection failed: {e}")

    # ── 5. MRZ zone (bottom 20%) ──────────────────────────────────────────────
    try:
        mrz_y    = int(h_img * 0.80)
        mrz_crop = gray[mrz_y:h_img, 0:w_img]
        edges    = cv2.Sobel(mrz_crop, cv2.CV_64F, 1, 0, ksize=3)
        density  = np.mean(np.abs(edges))
        if density > 8:
            add_region("id_number_mrz", 0, mrz_y, w_img, h_img - mrz_y, padding=2)
    except Exception as e:
        print(f"[detect] MRZ detection failed: {e}")

    # ── 6. Aadhaar hardcoded zones ────────────────────────────────────────────
    # These run unconditionally and fill in whatever MSER/cascade missed.
    # overlaps() ensures they don't double-encrypt already-covered areas.

    # Name line — right of face, top quarter
    add_region("name",
               int(w_img * 0.28), int(h_img * 0.22),
               int(w_img * 0.55), int(h_img * 0.12),
               padding=4)

    # Guardian / father name
    add_region("guardian_name",
               int(w_img * 0.28), int(h_img * 0.32),
               int(w_img * 0.45), int(h_img * 0.14),
               padding=4)

    # DOB line
    add_region("dob",
               int(w_img * 0.28), int(h_img * 0.43),
               int(w_img * 0.40), int(h_img * 0.14),
               padding=4)

    # Large Aadhaar number (centre-bottom)
    add_region("aadhaar_number",
               int(w_img * 0.10), int(h_img * 0.62),
               int(w_img * 0.80), int(h_img * 0.18),
               padding=4)

    # Footer strip — masked Aadhaar / VID
    add_region("aadhaar_footer",
               0, int(h_img * 0.82),
               w_img, h_img - int(h_img * 0.82),
               padding=2)

    # Header strip — enrollment number / timestamp
    add_region("header_id",
               0, 0,
               w_img, int(h_img * 0.15),
               padding=2)

    # ── 7. Final fallback ─────────────────────────────────────────────────────
    if len(regions) == 0:
        print("[detect] nothing found — encrypting full image")
        add_region("full_image", 0, 0, w_img, h_img)

    print(f"[detect] total {len(regions)} regions: {[r['label'] for r in regions]}")
    return regions