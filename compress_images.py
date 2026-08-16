import os
from PIL import Image

def compress_to_webp(directory, max_size_mb=1.0, max_dimension=1920, quality=82):
    """
    Convert every image in `directory` to WebP.

    - Files already smaller than max_size_mb are still converted to WebP
      if they are not already in that format, so the whole images/ folder
      ends up uniform.
    - Originals are removed after a successful conversion.
    - Dimensions are capped at max_dimension on the longest side.
    """
    max_bytes  = max_size_mb * 1024 * 1024
    converted  = 0
    saved_bytes = 0

    for root, dirs, files in os.walk(directory):
        for file in files:
            ext = file.lower().rsplit('.', 1)[-1]
            if ext not in ('jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'):
                continue

            filepath   = os.path.join(root, file)
            webp_path  = os.path.splitext(filepath)[0] + '.webp'

            # Skip if already a .webp file and it is small enough
            if ext == 'webp' and os.path.getsize(filepath) <= max_bytes:
                print(f"  [skip] {filepath} already WebP and within size limit")
                continue

            original_size = os.path.getsize(filepath)
            print(f"Converting {filepath} ({original_size / 1024 / 1024:.2f} MB) -> WebP ...")

            try:
                with Image.open(filepath) as img:
                    # Flatten transparency for formats that need it
                    if img.mode in ('RGBA', 'LA', 'P'):
                        bg = Image.new('RGB', img.size, (255, 255, 255))
                        bg.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                        img = bg
                    elif img.mode != 'RGB':
                        img = img.convert('RGB')

                    # Cap dimensions
                    w, h = img.size
                    if w > max_dimension or h > max_dimension:
                        if w >= h:
                            img = img.resize((max_dimension, int(max_dimension * h / w)),
                                             Image.Resampling.LANCZOS)
                        else:
                            img = img.resize((int(max_dimension * w / h), max_dimension),
                                             Image.Resampling.LANCZOS)

                    img.save(webp_path, format='WEBP', quality=quality,
                             method=6,        # best compression (slow but one-time)
                             lossless=False)

                new_size = os.path.getsize(webp_path)
                saved    = original_size - new_size
                saved_bytes += saved
                converted += 1
                print(f"  -> {new_size / 1024 / 1024:.2f} MB  (saved {saved / 1024:.0f} KB)")

                # Remove original only if it was not already a .webp
                if ext != 'webp' and os.path.abspath(filepath) != os.path.abspath(webp_path):
                    os.remove(filepath)

            except Exception as e:
                print(f"  [ERROR] {filepath}: {e}")

    print(f"\nDone! Converted {converted} images to WebP.")
    print(f"Total space saved: {saved_bytes / 1024 / 1024:.2f} MB")


if __name__ == '__main__':
    target_dir = os.path.join(os.getcwd(), 'public', 'images')
    compress_to_webp(target_dir)
